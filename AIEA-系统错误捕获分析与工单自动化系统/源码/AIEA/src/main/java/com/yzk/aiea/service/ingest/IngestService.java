package com.yzk.aiea.service.ingest;

import java.time.LocalDateTime;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.server.ResponseStatusException;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yzk.aiea.config.IngestProperties;
import com.yzk.aiea.dto.ErrorReportRequest;
import com.yzk.aiea.dto.ErrorReportResponse;
import com.yzk.aiea.entity.ErrorEvent;
import com.yzk.aiea.entity.SuppressRule;
import com.yzk.aiea.repository.ErrorEventRepository;
import com.yzk.aiea.repository.SuppressRuleRepository;
import com.yzk.aiea.service.fingerprint.FingerprintService;
import com.yzk.aiea.service.pipeline.ErrorPipelineService;
import com.yzk.aiea.service.redis.RateLimiterService;
import com.yzk.aiea.service.redis.RedisDedupService;
import com.yzk.aiea.service.ticket.InternalTicketService;
import com.yzk.aiea.util.SensitiveDataSanitizer;

/**
 * 错误接入服务
 * <p>
 * 核心流程: 限流 → 脱敏截断 → 计算指纹 → Redis 去重/冷却 → 落库 → 异步流水线
 * <p>
 * Redis 为主去重引擎（SET NX + INCR + TTL）；DB suppress_rule 表保留作为审计记录。
 * Redis 不可用时降级到 DB 查询，保证主链路不中断。
 * <p>
 * 关键设计：异步流水线通过 {@link TransactionSynchronizationManager} 在事务提交后触发，
 * 避免异步线程读不到未提交数据的问题。
 */
@Service
public class IngestService {

    private static final Logger log = LoggerFactory.getLogger(IngestService.class);

    private final ErrorEventRepository errorEventRepository;
    private final SuppressRuleRepository suppressRuleRepository;
    private final FingerprintService fingerprintService;
    private final IngestProperties ingestProperties;
    private final ObjectMapper objectMapper;
    private final ErrorPipelineService errorPipelineService;
    private final RedisDedupService redisDedupService;
    private final RateLimiterService rateLimiterService;
    private final InternalTicketService internalTicketService;

    public IngestService(ErrorEventRepository errorEventRepository,
                          SuppressRuleRepository suppressRuleRepository,
                          FingerprintService fingerprintService,
                          IngestProperties ingestProperties,
                          ObjectMapper objectMapper,
                          ErrorPipelineService errorPipelineService,
                          RedisDedupService redisDedupService,
                          RateLimiterService rateLimiterService,
                          InternalTicketService internalTicketService) {
        this.errorEventRepository = errorEventRepository;
        this.suppressRuleRepository = suppressRuleRepository;
        this.fingerprintService = fingerprintService;
        this.ingestProperties = ingestProperties;
        this.objectMapper = objectMapper;
        this.errorPipelineService = errorPipelineService;
        this.redisDedupService = redisDedupService;
        this.rateLimiterService = rateLimiterService;
        this.internalTicketService = internalTicketService;
    }

    /**
     * 处理错误上报
     *
     * @param request 错误上报请求
     * @return 上报响应（包含事件 ID、指纹、是否抑制等）
     * @throws ResponseStatusException 被限流时返回 429
     */
    @Transactional
    public ErrorReportResponse ingest(ErrorReportRequest request) {
        // 0. 限流检查（Redis INCR + EXPIRE 固定窗口）
        if (ingestProperties.isRateLimitEnabled()) {
            boolean allowed = rateLimiterService.allowRequest(
                    request.getService(),
                    ingestProperties.getGlobalQps(),
                    ingestProperties.getPerServiceQps());
            if (!allowed) {
                throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                        "请求被限流: service=" + request.getService());
            }
        }

        // 1. 脱敏 + 截断保护
        String message = truncate(SensitiveDataSanitizer.sanitize(request.getMessage()),
                ingestProperties.getMaxMessageLength());
        String stack = truncate(SensitiveDataSanitizer.sanitize(request.getStack()),
                ingestProperties.getMaxStackLength());

        // 2. 计算指纹
        String fingerprint = fingerprintService.generate(request.getService(), message, stack);
        log.info("错误上报: service={}, env={}, fingerprint={}", request.getService(), request.getEnv(), fingerprint);

        // 3. Redis 去重/冷却检查（主引擎）
        //    优先使用 DB 中该指纹的自定义冷却时间，否则用全局默认
        int cooldownSec = resolveCooldown(fingerprint);
        RedisDedupService.DedupResult dedupResult = redisDedupService.checkAndMark(
                fingerprint, cooldownSec);
        boolean suppressed = dedupResult.suppressed();
        int hitCount = dedupResult.hitCount();

        // 4. DB 审计记录（同步写入 suppress_rule，保留可追溯性）
        persistSuppressAudit(fingerprint, suppressed, hitCount);

        // 5. 创建错误事件并落库（无论是否抑制，都入库）
        //    抑制事件标记为 SUPPRESSED，明确告知用户该事件因冷却窗口内重复上报而被合并，
        //    避免状态停留在 RECEIVED 让用户误以为还在处理中。
        ErrorEvent event = new ErrorEvent();
        event.setFingerprint(fingerprint);
        event.setEnv(request.getEnv());
        event.setService(request.getService());
        event.setMessage(message);
        event.setStack(stack);
        event.setContextJson(serializeContext(request.getContext()));
        event.setStatus(suppressed ? "SUPPRESSED" : "RECEIVED");
        errorEventRepository.save(event);

        // 5.1 抑制事件：在已有工单上记录复发（自动重开已解决的工单）
        if (suppressed) {
            internalTicketService.recordRecurrence(fingerprint, hitCount);
        }

        log.info("错误事件已落库: id={}, fingerprint={}, suppressed={}", event.getId(), fingerprint, suppressed);

        // 6. 未抑制则在事务提交后异步进入分析→建单→通知流水线
        //    必须等事务 commit 后再触发 @Async，否则异步线程读不到未提交的数据
        if (!suppressed) {
            Long eventId = event.getId();
            if (TransactionSynchronizationManager.isSynchronizationActive()) {
                TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        log.info("事务已提交，触发异步流水线: eventId={}", eventId);
                        errorPipelineService.processAsync(eventId);
                    }
                });
            } else {
                // 无事务上下文（理论上不会走到这里），直接触发
                errorPipelineService.processAsync(eventId);
            }
        }

        String msg = suppressed
                ? "错误已入库，因冷却窗口内重复上报被抑制（hit #" + hitCount + "）"
                : "错误已入库，已触发异步分析流水线";
        return new ErrorReportResponse(event.getId(), fingerprint, event.getStatus(), suppressed, hitCount, msg);
    }

    /**
     * 解析指纹冷却时间：优先使用 DB 中该指纹的自定义值，否则用全局默认
     */
    private int resolveCooldown(String fingerprint) {
        return suppressRuleRepository.findById(fingerprint)
                .map(SuppressRule::getCooldownSec)
                .filter(sec -> sec != null && sec > 0)
                .orElse(ingestProperties.getDedupCooldownSeconds());
    }

    /**
     * 持久化 suppress_rule 审计记录
     * <p>
     * Redis 是主去重引擎，DB 表仅用于审计追溯。
     * suppressed=true 时更新命中次数；suppressed=false 时重置计数。
     * 注意：不覆盖已有的自定义 cooldownSec，仅新规则使用全局默认值。
     */
    private void persistSuppressAudit(String fingerprint, boolean suppressed, int hitCount) {
        try {
            SuppressRule rule = suppressRuleRepository.findById(fingerprint).orElse(null);
            if (rule == null) {
                rule = new SuppressRule();
                rule.setFingerprint(fingerprint);
                rule.setCooldownSec(ingestProperties.getDedupCooldownSeconds());
                rule.setLastFiredAt(LocalDateTime.now());
                rule.setHitCount(hitCount);
            } else {
                if (suppressed) {
                    rule.setHitCount(hitCount);
                } else {
                    rule.setLastFiredAt(LocalDateTime.now());
                    rule.setHitCount(0);
                    // 不覆盖已有 cooldownSec，保留用户自定义值
                }
            }
            suppressRuleRepository.save(rule);
        } catch (Exception e) {
            log.warn("suppress_rule 审计记录写入失败（不影响主流程）: fingerprint={}, error={}", fingerprint, e.getMessage());
        }
    }

    /**
     * 序列化上下文 Map 为 JSON 字符串
     */
    private String serializeContext(Map<String, Object> context) {
        if (context == null || context.isEmpty()) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(context);
        } catch (JsonProcessingException e) {
            log.warn("上下文序列化失败: {}", e.getMessage());
            return null;
        }
    }

    /**
     * 截断字符串
     */
    private String truncate(String value, int maxLength) {
        if (value == null) {
            return null;
        }
        return value.length() > maxLength ? value.substring(0, maxLength) : value;
    }
}
