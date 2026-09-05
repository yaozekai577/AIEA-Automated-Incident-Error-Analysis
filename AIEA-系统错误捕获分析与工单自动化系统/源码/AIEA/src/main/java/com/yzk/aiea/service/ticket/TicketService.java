package com.yzk.aiea.service.ticket;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.yzk.aiea.config.JiraProperties;
import com.yzk.aiea.entity.AnalysisResult;
import com.yzk.aiea.entity.ErrorEvent;
import com.yzk.aiea.entity.JiraTicket;
import com.yzk.aiea.integration.JiraClient;
import com.yzk.aiea.repository.ErrorEventRepository;
import com.yzk.aiea.repository.JiraTicketRepository;

/**
 * Jira 建单服务（同指纹冷却内幂等复用）
 */
@Service
public class TicketService {

    private static final Logger log = LoggerFactory.getLogger(TicketService.class);

    private final JiraClient jiraClient;
    private final JiraProperties jiraProperties;
    private final JiraTicketRepository jiraTicketRepository;
    private final ErrorEventRepository errorEventRepository;

    public TicketService(JiraClient jiraClient,
                         JiraProperties jiraProperties,
                         JiraTicketRepository jiraTicketRepository,
                         ErrorEventRepository errorEventRepository) {
        this.jiraClient = jiraClient;
        this.jiraProperties = jiraProperties;
        this.jiraTicketRepository = jiraTicketRepository;
        this.errorEventRepository = errorEventRepository;
    }

    @Transactional
    public Optional<JiraTicket> createOrReuse(ErrorEvent event, AnalysisResult analysis) {
        if ("local".equalsIgnoreCase(event.getEnv()) && !jiraProperties.isEnableForLocal()) {
            log.info("local 环境跳过建单: eventId={}", event.getId());
            return Optional.empty();
        }

        // 同指纹已有工单则复用（不重复插入，避免 jira_key 唯一约束冲突）
        List<ErrorEvent> sameFp = errorEventRepository.findByFingerprint(event.getFingerprint());
        for (ErrorEvent e : sameFp) {
            List<JiraTicket> tickets = jiraTicketRepository.findByEventId(e.getId());
            if (!tickets.isEmpty()) {
                JiraTicket existing = tickets.get(0);
                log.info("复用已有 Jira: {} for eventId={}", existing.getJiraKey(), event.getId());
                return Optional.of(existing);
            }
        }

        String summary = "[" + event.getEnv() + "][" + event.getService() + "] "
                + truncate(event.getMessage(), 180);
        String description = buildDescription(event, analysis);
        List<String> labels = new ArrayList<>();
        labels.add("aiea");
        labels.add(safeLabel(event.getEnv()));
        labels.add(safeLabel(event.getService()));

        Map<String, Object> created = jiraClient.createIssue(summary, description, labels);
        if (!Boolean.TRUE.equals(created.get("success"))) {
            log.warn("建单失败: eventId={}, result={}", event.getId(), created);
            return Optional.empty();
        }

        JiraTicket ticket = new JiraTicket();
        ticket.setEventId(event.getId());
        ticket.setJiraKey(String.valueOf(created.get("jiraKey")));
        ticket.setProject(String.valueOf(created.getOrDefault("project", jiraProperties.getProjectKey())));
        ticket.setUrl(String.valueOf(created.get("url")));
        ticket.setCreatedAt(LocalDateTime.now());
        jiraTicketRepository.save(ticket);
        log.info("创建 Jira 成功: {} eventId={}", ticket.getJiraKey(), event.getId());
        return Optional.of(ticket);
    }

    private String buildDescription(ErrorEvent event, AnalysisResult analysis) {
        StringBuilder sb = new StringBuilder();
        sb.append("自动创建 by AIEA\n\n");
        sb.append("Fingerprint: ").append(event.getFingerprint()).append("\n");
        sb.append("Service: ").append(event.getService()).append("\n");
        sb.append("Env: ").append(event.getEnv()).append("\n\n");
        sb.append("Message:\n").append(nullToEmpty(event.getMessage())).append("\n\n");
        if (analysis != null) {
            sb.append("AI Root Cause:\n").append(nullToEmpty(analysis.getRootCause())).append("\n\n");
            sb.append("Suggestions:\n").append(nullToEmpty(analysis.getSuggestions())).append("\n\n");
            sb.append("Confidence: ").append(analysis.getConfidence()).append("\n\n");
        }
        sb.append("Stack:\n").append(truncate(nullToEmpty(event.getStack()), 8000));
        return sb.toString();
    }

    private String safeLabel(String s) {
        if (s == null) {
            return "unknown";
        }
        return s.replaceAll("[^a-zA-Z0-9_\\-]", "_");
    }

    private String truncate(String s, int max) {
        if (s == null) {
            return "";
        }
        return s.length() <= max ? s : s.substring(0, max);
    }

    private String nullToEmpty(String s) {
        return s == null ? "" : s;
    }
}
