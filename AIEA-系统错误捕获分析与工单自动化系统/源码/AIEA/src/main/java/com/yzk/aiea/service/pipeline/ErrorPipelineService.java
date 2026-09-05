package com.yzk.aiea.service.pipeline;

import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import com.yzk.aiea.config.PipelineProperties;
import com.yzk.aiea.entity.AnalysisResult;
import com.yzk.aiea.entity.ErrorEvent;
import com.yzk.aiea.entity.JiraTicket;
import com.yzk.aiea.repository.ErrorEventRepository;
import com.yzk.aiea.service.analyze.AnalyzeService;
import com.yzk.aiea.service.notify.NotifyService;
import com.yzk.aiea.service.redis.RedisDedupService;
import com.yzk.aiea.service.ticket.InternalTicketService;
import com.yzk.aiea.service.ticket.TicketService;

/**
 * 异步闭环：分析 → 建单 → 通知
 * <p>
 * 合并命中次数从 Redis 获取（主引擎），Redis 不可用时返回 0。
 */
@Service
public class ErrorPipelineService {

    private static final Logger log = LoggerFactory.getLogger(ErrorPipelineService.class);

    private final PipelineProperties pipelineProperties;
    private final ErrorEventRepository errorEventRepository;
    private final AnalyzeService analyzeService;
    private final TicketService ticketService;
    private final InternalTicketService internalTicketService;
    private final NotifyService notifyService;
    private final RedisDedupService redisDedupService;

    public ErrorPipelineService(PipelineProperties pipelineProperties,
                                ErrorEventRepository errorEventRepository,
                                AnalyzeService analyzeService,
                                TicketService ticketService,
                                InternalTicketService internalTicketService,
                                NotifyService notifyService,
                                RedisDedupService redisDedupService) {
        this.pipelineProperties = pipelineProperties;
        this.errorEventRepository = errorEventRepository;
        this.analyzeService = analyzeService;
        this.ticketService = ticketService;
        this.internalTicketService = internalTicketService;
        this.notifyService = notifyService;
        this.redisDedupService = redisDedupService;
    }

    @Async("pipelineExecutor")
    public void processAsync(Long eventId) {
        if (!pipelineProperties.isEnabled()) {
            log.info("流水线关闭，跳过 eventId={}", eventId);
            return;
        }
        try {
            process(eventId);
        } catch (Exception e) {
            log.error("流水线异常 eventId={}", eventId, e);
            markFailed(eventId);
        }
    }

    public void process(Long eventId) {
        ErrorEvent event = errorEventRepository.findById(eventId)
                .orElseThrow(() -> new IllegalArgumentException("事件不存在: " + eventId));

        event.setStatus("ANALYZING");
        errorEventRepository.save(event);

        AnalysisResult analysis = analyzeService.analyze(event);

        // 创建内置工单（不依赖外部 Jira）
        try {
            internalTicketService.createOrReuse(event, analysis);
        } catch (Exception e) {
            log.warn("内置工单创建失败 eventId={}: {}", eventId, e.getMessage());
        }

        Optional<JiraTicket> ticketOpt = Optional.empty();
        try {
            ticketOpt = ticketService.createOrReuse(event, analysis);
        } catch (Exception e) {
            log.warn("Jira建单失败（不影响通知流程） eventId={}: {}", eventId, e.getMessage());
        }
        if (ticketOpt.isPresent()) {
            event.setStatus("TICKETED");
            errorEventRepository.save(event);
        }

        // 从 Redis 获取冷却窗口内的合并命中次数
        int mergedHits = redisDedupService.getHitCount(event.getFingerprint());

        boolean notified = notifyService.notify(event, analysis, ticketOpt.orElse(null), mergedHits);
        if (notified) {
            event.setStatus("NOTIFIED");
        } else if (ticketOpt.isEmpty()) {
            // 建单与通知都失败，标记 FAILED；若已建单则保持 TICKETED
            if (!"TICKETED".equals(event.getStatus())) {
                event.setStatus("FAILED");
            }
        }
        // 成功闭环优先：有工单且通知成功 -> NOTIFIED；有工单通知失败 -> TICKETED
        if (ticketOpt.isPresent() && notified) {
            event.setStatus("NOTIFIED");
        }
        errorEventRepository.save(event);
        log.info("流水线完成: eventId={}, status={}", eventId, event.getStatus());
    }

    private void markFailed(Long eventId) {
        errorEventRepository.findById(eventId).ifPresent(e -> {
            e.setStatus("FAILED");
            errorEventRepository.save(e);
        });
    }
}
