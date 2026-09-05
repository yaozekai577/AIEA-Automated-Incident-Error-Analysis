package com.yzk.aiea.controller;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.yzk.aiea.entity.AnalysisResult;
import com.yzk.aiea.entity.ErrorEvent;
import com.yzk.aiea.entity.InternalTicket;
import com.yzk.aiea.entity.JiraTicket;
import com.yzk.aiea.entity.NotifyRecord;
import com.yzk.aiea.entity.SuppressRule;
import com.yzk.aiea.repository.AnalysisResultRepository;
import com.yzk.aiea.repository.ErrorEventRepository;
import com.yzk.aiea.repository.InternalTicketRepository;
import com.yzk.aiea.repository.JiraTicketRepository;
import com.yzk.aiea.repository.NotifyRecordRepository;
import com.yzk.aiea.repository.SuppressRuleRepository;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/**
 * 统计与告警抑制规则查询
 */
@RestController
@RequestMapping("/api/v1/stats")
@Tag(name = "统计分析", description = "告警抑制规则、全局统计概览")
public class StatsController {

    private final SuppressRuleRepository suppressRuleRepository;
    private final ErrorEventRepository errorEventRepository;
    private final AnalysisResultRepository analysisResultRepository;
    private final NotifyRecordRepository notifyRecordRepository;
    private final JiraTicketRepository jiraTicketRepository;
    private final InternalTicketRepository internalTicketRepository;

    public StatsController(SuppressRuleRepository suppressRuleRepository,
                           ErrorEventRepository errorEventRepository,
                           AnalysisResultRepository analysisResultRepository,
                           NotifyRecordRepository notifyRecordRepository,
                           JiraTicketRepository jiraTicketRepository,
                           InternalTicketRepository internalTicketRepository) {
        this.suppressRuleRepository = suppressRuleRepository;
        this.errorEventRepository = errorEventRepository;
        this.analysisResultRepository = analysisResultRepository;
        this.notifyRecordRepository = notifyRecordRepository;
        this.jiraTicketRepository = jiraTicketRepository;
        this.internalTicketRepository = internalTicketRepository;
    }

    /**
     * 告警抑制规则列表
     */
    @GetMapping("/suppress-rules")
    @Operation(summary = "告警抑制规则", description = "查看所有指纹的冷却规则、命中次数、最近触发时间")
    public List<Map<String, Object>> suppressRules() {
        List<SuppressRule> rules = suppressRuleRepository.findAll();
        List<Map<String, Object>> result = new ArrayList<>();

        for (SuppressRule rule : rules) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("fingerprint", rule.getFingerprint());
            item.put("cooldownSec", rule.getCooldownSec());
            item.put("hitCount", rule.getHitCount());
            item.put("lastFiredAt", rule.getLastFiredAt());

            // 计算是否在冷却中
            boolean inCooldown = false;
            String remainingTime = null;
            if (rule.getLastFiredAt() != null) {
                long elapsed = ChronoUnit.SECONDS.between(rule.getLastFiredAt(), LocalDateTime.now());
                if (elapsed < rule.getCooldownSec()) {
                    inCooldown = true;
                    long remaining = rule.getCooldownSec() - elapsed;
                    remainingTime = formatRemaining(remaining);
                }
            }
            item.put("inCooldown", inCooldown);
            item.put("remainingTime", remainingTime);

            // 关联错误信息
            List<ErrorEvent> events = errorEventRepository.findByFingerprint(rule.getFingerprint());
            if (!events.isEmpty()) {
                ErrorEvent latest = events.stream()
                        .max((a, b) -> a.getCreatedAt().compareTo(b.getCreatedAt()))
                        .orElse(null);
                if (latest != null) {
                    item.put("service", latest.getService());
                    item.put("message", latest.getMessage());
                    item.put("env", latest.getEnv());
                    item.put("latestCreatedAt", latest.getCreatedAt());
                }

                // 优先找一个有关联工单的事件 ID，没有则用最新事件 ID
                Long detailEventId = null;
                List<InternalTicket> tickets = internalTicketRepository
                        .findByFingerprint(rule.getFingerprint());
                if (!tickets.isEmpty()) {
                    // 收集所有有工单的事件 ID
                    java.util.Set<Long> ticketedEventIds = tickets.stream()
                            .map(InternalTicket::getEventId)
                            .collect(java.util.stream.Collectors.toSet());
                    // 在这些事件中取最新的
                    detailEventId = events.stream()
                            .filter(e -> ticketedEventIds.contains(e.getId()))
                            .max((a, b) -> a.getCreatedAt().compareTo(b.getCreatedAt()))
                            .map(ErrorEvent::getId)
                            .orElse(null);
                }
                if (detailEventId == null) {
                    detailEventId = latest != null ? latest.getId() : null;
                }
                item.put("latestEventId", detailEventId);
            }
            item.put("eventCount", events.size());

            result.add(item);
        }

        // 按命中次数降序
        result.sort((a, b) -> Integer.compare(
                (int) b.getOrDefault("hitCount", 0),
                (int) a.getOrDefault("hitCount", 0)));

        return result;
    }

    /**
     * 更新单指纹冷却时间
     */
    @PutMapping("/suppress-rules/{fingerprint}/cooldown")
    @Operation(summary = "更新冷却时间", description = "修改指定指纹的冷却窗口（秒），立即生效")
    public Map<String, Object> updateCooldown(
            @PathVariable String fingerprint,
            @RequestBody Map<String, Object> body) {
        int cooldownSec = ((Number) body.get("cooldownSec")).intValue();
        if (cooldownSec < 1 || cooldownSec > 86400) {
            throw new IllegalArgumentException("冷却时间须在 1~86400 秒之间");
        }

        SuppressRule rule = suppressRuleRepository.findById(fingerprint)
                .orElseThrow(() -> new IllegalArgumentException("指纹不存在: " + fingerprint));
        rule.setCooldownSec(cooldownSec);
        suppressRuleRepository.save(rule);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("fingerprint", fingerprint);
        result.put("cooldownSec", cooldownSec);
        result.put("updated", true);
        return result;
    }

    /**
     * 全局统计概览
     */
    @GetMapping("/overview")
    @Operation(summary = "全局统计概览", description = "事件总数、分析数、通知成功率、工单数、环境分布等")
    public Map<String, Object> overview() {
        Map<String, Object> stats = new LinkedHashMap<>();

        List<ErrorEvent> allErrors = errorEventRepository.findAll();
        List<AnalysisResult> allAnalyses = analysisResultRepository.findAll();
        List<NotifyRecord> allNotifies = notifyRecordRepository.findAll();
        List<JiraTicket> allTickets = jiraTicketRepository.findAll();

        // 基础计数
        stats.put("totalErrors", allErrors.size());
        stats.put("totalAnalyses", allAnalyses.size());
        stats.put("totalNotifies", allNotifies.size());
        stats.put("totalTickets", allTickets.size());

        // 唯一指纹数
        long uniqueFingerprints = allErrors.stream()
                .map(ErrorEvent::getFingerprint)
                .distinct()
                .count();
        stats.put("uniqueFingerprints", uniqueFingerprints);

        // 通知成功率
        long notifySuccess = allNotifies.stream()
                .filter(n -> n.getHttpStatus() != null && n.getHttpStatus() >= 200 && n.getHttpStatus() < 300)
                .count();
        double notifySuccessRate = allNotifies.isEmpty() ? 0 : (double) notifySuccess / allNotifies.size();
        stats.put("notifySuccessCount", notifySuccess);
        stats.put("notifyFailCount", allNotifies.size() - notifySuccess);
        stats.put("notifySuccessRate", Math.round(notifySuccessRate * 1000) / 10.0);

        // AI 分析置信度分布
        List<AnalysisResult> analysesWithConfidence = allAnalyses.stream()
                .filter(a -> a.getConfidence() != null)
                .collect(Collectors.toList());
        long highConf = analysesWithConfidence.stream()
                .filter(a -> a.getConfidence().doubleValue() >= 0.7)
                .count();
        long midConf = analysesWithConfidence.stream()
                .filter(a -> a.getConfidence().doubleValue() >= 0.4 && a.getConfidence().doubleValue() < 0.7)
                .count();
        long lowConf = analysesWithConfidence.stream()
                .filter(a -> a.getConfidence().doubleValue() < 0.4)
                .count();
        stats.put("highConfidence", highConf);
        stats.put("midConfidence", midConf);
        stats.put("lowConfidence", lowConf);

        // 环境分布
        Map<String, Long> envDist = allErrors.stream()
                .collect(Collectors.groupingBy(
                        e -> e.getEnv() != null ? e.getEnv() : "unknown",
                        Collectors.counting()));
        stats.put("envDistribution", envDist);

        // 状态分布
        Map<String, Long> statusDist = allErrors.stream()
                .collect(Collectors.groupingBy(
                        e -> e.getStatus() != null ? e.getStatus() : "unknown",
                        Collectors.counting()));
        stats.put("statusDistribution", statusDist);

        // 通知渠道分布
        Map<String, Long> channelDist = allNotifies.stream()
                .collect(Collectors.groupingBy(
                        n -> n.getChannel() != null ? n.getChannel() : "unknown",
                        Collectors.counting()));
        stats.put("channelDistribution", channelDist);

        // 按服务统计错误数
        Map<String, Long> serviceDist = allErrors.stream()
                .collect(Collectors.groupingBy(
                        e -> e.getService() != null ? e.getService() : "unknown",
                        Collectors.counting()));
        stats.put("serviceDistribution", serviceDist);

        // 抑制规则统计
        List<SuppressRule> suppressRules = suppressRuleRepository.findAll();
        long totalHits = suppressRules.stream().mapToInt(SuppressRule::getHitCount).sum();
        stats.put("suppressRuleCount", suppressRules.size());
        stats.put("totalSuppressHits", totalHits);

        // 内置工单统计
        List<InternalTicket> allInternalTickets = internalTicketRepository.findAll();
        stats.put("internalTicketTotal", allInternalTickets.size());
        long openTickets = allInternalTickets.stream().filter(t -> "OPEN".equals(t.getStatus())).count();
        long inProgressTickets = allInternalTickets.stream().filter(t -> "IN_PROGRESS".equals(t.getStatus())).count();
        long resolvedTickets = allInternalTickets.stream().filter(t -> "RESOLVED".equals(t.getStatus())).count();
        long closedTickets = allInternalTickets.stream().filter(t -> "CLOSED".equals(t.getStatus()) || "IGNORED".equals(t.getStatus())).count();
        stats.put("internalTicketOpen", openTickets);
        stats.put("internalTicketInProgress", inProgressTickets);
        stats.put("internalTicketResolved", resolvedTickets);
        stats.put("internalTicketClosed", closedTickets);

        return stats;
    }

    private String formatRemaining(long seconds) {
        if (seconds < 60) return seconds + "秒";
        if (seconds < 3600) return (seconds / 60) + "分" + (seconds % 60) + "秒";
        return (seconds / 3600) + "时" + ((seconds % 3600) / 60) + "分";
    }
}
