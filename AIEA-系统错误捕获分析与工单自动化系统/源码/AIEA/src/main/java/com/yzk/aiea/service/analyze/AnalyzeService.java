package com.yzk.aiea.service.analyze;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.yzk.aiea.entity.AnalysisResult;
import com.yzk.aiea.entity.ErrorEvent;
import com.yzk.aiea.integration.LlmClient;
import com.yzk.aiea.repository.AnalysisResultRepository;
import com.yzk.aiea.service.SystemConfigService;
import com.yzk.aiea.service.redis.LlmAnalysisCacheService;
import com.yzk.aiea.util.SensitiveDataSanitizer;

/**
 * 根因分析服务
 * <p>
 * 分析优先级：
 * <ol>
 *   <li>同 eventId 已分析过 → 直接返回（DB 去重）</li>
 *   <li>同指纹 Redis 缓存命中 → 复用结果（节省 LLM Token）</li>
 *   <li>调用 LLM 分析 → 落库 + 写缓存</li>
 * </ol>
 */
@Service
public class AnalyzeService {

    private static final Logger log = LoggerFactory.getLogger(AnalyzeService.class);

    private static final String SYSTEM_PROMPT = """
            你是资深 Java 线上故障排查专家。请仅基于用户提供的异常信息做根因分析。
            若信息不足，明确写出不确定点与建议补充的排查项。
            禁止虚构不存在的类/方法。不要给出删库、关闭鉴权等高危操作。
            必须只输出一个 JSON 对象，字段如下：
            {
              "root_cause": "根因说明",
              "impact": "影响面",
              "suggestions": ["修复建议1", "修复建议2", "修复建议3"],
              "related_files": ["可能相关文件或类"],
              "confidence": 0.0,
              "need_more_info": ["如需补充的信息"]
            }
            confidence 取值 0~1。
            """;

    private final LlmClient llmClient;
    private final AnalysisResultRepository analysisResultRepository;
    private final ObjectMapper objectMapper;
    private final SystemConfigService configService;
    private final LlmAnalysisCacheService llmAnalysisCacheService;

    public AnalyzeService(LlmClient llmClient,
                          AnalysisResultRepository analysisResultRepository,
                          ObjectMapper objectMapper,
                          SystemConfigService configService,
                          LlmAnalysisCacheService llmAnalysisCacheService) {
        this.llmClient = llmClient;
        this.analysisResultRepository = analysisResultRepository;
        this.objectMapper = objectMapper;
        this.configService = configService;
        this.llmAnalysisCacheService = llmAnalysisCacheService;
    }

    public AnalysisResult analyze(ErrorEvent event) {
        // 1. 同 eventId 已分析过 → 直接返回
        Optional<AnalysisResult> existing = analysisResultRepository.findByEventId(event.getId());
        if (existing.isPresent()) {
            return existing.get();
        }

        // 2. 同指纹 Redis 缓存命中 → 复用（节省 LLM Token）
        AnalysisResult cached = llmAnalysisCacheService.get(event.getFingerprint(), configService.getLlmAnalysisCacheTtl());
        if (cached != null) {
            cached.setEventId(event.getId());
            log.info("分析缓存命中，复用结果: eventId={}, fingerprint={}", event.getId(), event.getFingerprint());
            return analysisResultRepository.save(cached);
        }

        // 3. 调用 LLM 分析
        String userPrompt = buildUserPrompt(event);
        Optional<String> rawOpt = llmClient.chat(SYSTEM_PROMPT, userPrompt);

        AnalysisResult result = new AnalysisResult();
        result.setEventId(event.getId());
        result.setModel(llmClient.getModel());
        result.setCreatedAt(LocalDateTime.now());

        if (rawOpt.isEmpty()) {
            fillFallback(result, event, "LLM 调用失败或超时，已降级为规则摘要。");
            AnalysisResult saved = analysisResultRepository.save(result);
            llmAnalysisCacheService.put(event.getFingerprint(), saved, configService.getLlmAnalysisCacheTtl());
            return saved;
        }

        String raw = rawOpt.get();
        result.setRawResponse(raw);
        JsonNode node = llmClient.parseJsonContent(raw);
        if (node == null) {
            Optional<String> retry = llmClient.chat(SYSTEM_PROMPT,
                    userPrompt + "\n\n上一次输出无法解析为 JSON，请只输出合法 JSON。");
            if (retry.isPresent()) {
                raw = retry.get();
                result.setRawResponse(raw);
                node = llmClient.parseJsonContent(raw);
            }
        }

        if (node == null) {
            fillFallback(result, event, "LLM 返回无法解析，已降级。原始摘要：" + truncate(raw, 500));
            AnalysisResult saved = analysisResultRepository.save(result);
            llmAnalysisCacheService.put(event.getFingerprint(), saved, configService.getLlmAnalysisCacheTtl());
            return saved;
        }

        result.setRootCause(text(node, "root_cause"));
        result.setSuggestions(toJsonArray(node.get("suggestions")));
        result.setConfidence(parseConfidence(node.get("confidence")));
        if (result.getRootCause() == null || result.getRootCause().isBlank()) {
            fillFallback(result, event, "LLM 未给出根因，已降级。");
        }

        log.info("分析完成: eventId={}, confidence={}", event.getId(), result.getConfidence());
        AnalysisResult saved = analysisResultRepository.save(result);
        // 写入 Redis 缓存，同指纹后续上报可复用
        llmAnalysisCacheService.put(event.getFingerprint(), saved, configService.getLlmAnalysisCacheTtl());
        return saved;
    }

    private String buildUserPrompt(ErrorEvent event) {
        StringBuilder sb = new StringBuilder();
        sb.append("service: ").append(event.getService()).append('\n');
        sb.append("env: ").append(event.getEnv()).append('\n');
        sb.append("fingerprint: ").append(event.getFingerprint()).append('\n');
        sb.append("message: ").append(SensitiveDataSanitizer.sanitize(event.getMessage())).append('\n');
        sb.append("stack:\n").append(SensitiveDataSanitizer.sanitize(nullToEmpty(event.getStack()))).append('\n');
        if (event.getContextJson() != null) {
            sb.append("context: ").append(SensitiveDataSanitizer.sanitize(event.getContextJson())).append('\n');
        }
        return sb.toString();
    }

    private void fillFallback(AnalysisResult result, ErrorEvent event, String reason) {
        result.setRootCause(reason + " 异常摘要: " + nullToEmpty(event.getMessage()));
        try {
            List<String> tips = new ArrayList<>();
            tips.add("核对近期发布与配置变更");
            tips.add("根据堆栈定位首个业务包帧并加日志复现");
            tips.add("检查依赖服务/DB/缓存可用性");
            result.setSuggestions(objectMapper.writeValueAsString(tips));
        } catch (Exception e) {
            result.setSuggestions("[\"请人工排查堆栈\"]");
        }
        result.setConfidence(new BigDecimal("0.2000"));
        if (result.getRawResponse() == null) {
            result.setRawResponse(reason);
        }
    }

    private String toJsonArray(JsonNode node) {
        try {
            if (node == null || !node.isArray()) {
                return "[]";
            }
            ArrayNode arr = objectMapper.createArrayNode();
            node.forEach(n -> arr.add(n.asText()));
            return objectMapper.writeValueAsString(arr);
        } catch (Exception e) {
            return "[]";
        }
    }

    private BigDecimal parseConfidence(JsonNode node) {
        if (node == null || !node.isNumber()) {
            return new BigDecimal("0.5000");
        }
        BigDecimal v = node.decimalValue();
        if (v.compareTo(BigDecimal.ZERO) < 0) {
            v = BigDecimal.ZERO;
        }
        if (v.compareTo(BigDecimal.ONE) > 0) {
            v = BigDecimal.ONE;
        }
        return v.setScale(4, RoundingMode.HALF_UP);
    }

    private String text(JsonNode node, String field) {
        JsonNode n = node.get(field);
        return n == null || n.isNull() ? null : n.asText();
    }

    private String nullToEmpty(String s) {
        return s == null ? "" : s;
    }

    private String truncate(String s, int max) {
        if (s == null) {
            return "";
        }
        return s.length() <= max ? s : s.substring(0, max);
    }
}
