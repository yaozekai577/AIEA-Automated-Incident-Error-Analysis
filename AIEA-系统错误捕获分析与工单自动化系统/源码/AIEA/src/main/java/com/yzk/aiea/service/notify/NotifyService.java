package com.yzk.aiea.service.notify;

import java.time.LocalDateTime;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.yzk.aiea.config.DingTalkProperties;
import com.yzk.aiea.config.FeishuProperties;
import com.yzk.aiea.config.PipelineProperties;
import com.yzk.aiea.entity.AnalysisResult;
import com.yzk.aiea.entity.ErrorEvent;
import com.yzk.aiea.entity.JiraTicket;
import com.yzk.aiea.entity.NotifyRecord;
import com.yzk.aiea.entity.NotifyRouting;
import com.yzk.aiea.integration.DingTalkClient;
import com.yzk.aiea.integration.FeishuClient;
import com.yzk.aiea.repository.NotifyRecordRepository;
import com.yzk.aiea.repository.NotifyRoutingRepository;
import com.yzk.aiea.util.SensitiveDataSanitizer;

/**
 * 协作通知服务（飞书优先，钉钉可选）
 */
@Service
public class NotifyService {

    private static final Logger log = LoggerFactory.getLogger(NotifyService.class);

    private final PipelineProperties pipelineProperties;
    private final FeishuProperties feishuProperties;
    private final DingTalkProperties dingTalkProperties;
    private final FeishuClient feishuClient;
    private final DingTalkClient dingTalkClient;
    private final NotifyRecordRepository notifyRecordRepository;
    private final NotifyRoutingRepository notifyRoutingRepository;
    private final ObjectMapper objectMapper;

    public NotifyService(PipelineProperties pipelineProperties,
                         FeishuProperties feishuProperties,
                         DingTalkProperties dingTalkProperties,
                         FeishuClient feishuClient,
                         DingTalkClient dingTalkClient,
                         NotifyRecordRepository notifyRecordRepository,
                         NotifyRoutingRepository notifyRoutingRepository,
                         ObjectMapper objectMapper) {
        this.pipelineProperties = pipelineProperties;
        this.feishuProperties = feishuProperties;
        this.dingTalkProperties = dingTalkProperties;
        this.feishuClient = feishuClient;
        this.dingTalkClient = dingTalkClient;
        this.notifyRecordRepository = notifyRecordRepository;
        this.notifyRoutingRepository = notifyRoutingRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public boolean notify(ErrorEvent event, AnalysisResult analysis, JiraTicket ticket, int mergedHits) {
        if (!pipelineProperties.isNotifyEnabled()
                || "none".equalsIgnoreCase(pipelineProperties.getNotifyChannel())) {
            log.info("通知已关闭，跳过: eventId={}", event.getId());
            return true;
        }

        String title = "AIEA 错误根因分析";
        String content = buildContent(event, analysis, ticket, mergedHits);
        String channel = pipelineProperties.getNotifyChannel();

        // 按服务名 + 渠道查路由表：有路由规则则用专属机器人，否则 fallback 到全局默认
        String globalWebhookUrl;
        if ("dingtalk".equalsIgnoreCase(channel)) {
            globalWebhookUrl = dingTalkProperties.getWebhookUrl();
        } else {
            globalWebhookUrl = feishuProperties.getWebhookUrl();
        }

        String webhookUrl = globalWebhookUrl;
        String routeSource = "global";
        NotifyRouting routing = notifyRoutingRepository
                .findByServiceAndChannel(event.getService(), channel)
                .orElse(null);
        if (routing != null && Boolean.TRUE.equals(routing.getEnabled())
                && routing.getWebhookUrl() != null && !routing.getWebhookUrl().isBlank()) {
            webhookUrl = routing.getWebhookUrl();
            routeSource = "service:" + routing.getService() + ",channel:" + routing.getChannel();
            log.info("通知路由匹配: service={}, channel={}, routeId={}, desc={}",
                    event.getService(), channel, routing.getId(), routing.getDescription());
        } else {
            log.info("通知路由未匹配, fallback 到全局: service={}, channel={}",
                    event.getService(), channel);
        }

        final String finalWebhookUrl = webhookUrl;
        Map<String, Object> result = Map.of("success", false);
        int attempts = Math.max(1, pipelineProperties.getNotifyMaxRetries());
        for (int i = 1; i <= attempts; i++) {
            if ("dingtalk".equalsIgnoreCase(channel)) {
                result = dingTalkClient.sendMarkdown(title, content, finalWebhookUrl);
            } else {
                result = feishuClient.sendCard(title, content, finalWebhookUrl);
            }
            if (Boolean.TRUE.equals(result.get("success"))) {
                break;
            }
            log.warn("通知失败 attempt={}/{}: {}", i, attempts, result.get("error"));
        }

        NotifyRecord record = new NotifyRecord();
        record.setEventId(event.getId());
        record.setChannel(channel);
        record.setHttpStatus(result.get("httpStatus") instanceof Integer i ? i : null);
        record.setSentAt(LocalDateTime.now());
        try {
            record.setPayload(objectMapper.writeValueAsString(Map.of(
                    "title", title,
                    "content", content,
                    "routeSource", routeSource,
                    "webhookUrl", finalWebhookUrl == null ? "(未配置)"
                            : finalWebhookUrl.length() > 80
                            ? finalWebhookUrl.substring(0, 80) + "..." : finalWebhookUrl,
                    "result", result
            )));
        } catch (Exception e) {
            record.setPayload(content);
        }
        notifyRecordRepository.save(record);
        return Boolean.TRUE.equals(result.get("success"));
    }

    private String buildContent(ErrorEvent event, AnalysisResult analysis,
                                JiraTicket ticket, int mergedHits) {
        StringBuilder sb = new StringBuilder();
        sb.append("**环境**: ").append(event.getEnv()).append("\n");
        sb.append("**服务**: ").append(event.getService()).append("\n");
        sb.append("**摘要**: ").append(SensitiveDataSanitizer.sanitize(nullToEmpty(event.getMessage()))).append("\n");
        if (mergedHits > 0) {
            sb.append("**合并次数**: ").append(mergedHits).append("\n");
        }
        if (analysis != null) {
            sb.append("**根因(AI)**: ").append(nullToEmpty(analysis.getRootCause())).append("\n");
            sb.append("**建议**: ").append(nullToEmpty(analysis.getSuggestions())).append("\n");
            sb.append("**置信度**: ").append(analysis.getConfidence())
                    .append("（AI 建议，需人工确认）\n");
        }
        if (ticket != null) {
            sb.append("**Jira**: [").append(ticket.getJiraKey()).append("](")
                    .append(ticket.getUrl()).append(")\n");
        }
        sb.append("**详情**: ").append(pipelineProperties.getDetailBaseUrl())
                .append("/api/v1/errors/").append(event.getId()).append("\n");
        return sb.toString();
    }

    private String nullToEmpty(String s) {
        return s == null ? "" : s;
    }
}
