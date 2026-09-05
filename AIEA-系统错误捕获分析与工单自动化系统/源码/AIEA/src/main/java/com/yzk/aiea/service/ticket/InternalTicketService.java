package com.yzk.aiea.service.ticket;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.yzk.aiea.entity.AnalysisResult;
import com.yzk.aiea.entity.ErrorEvent;
import com.yzk.aiea.entity.InternalTicket;
import com.yzk.aiea.entity.TicketLog;
import com.yzk.aiea.integration.LlmClient;
import com.yzk.aiea.repository.ErrorEventRepository;
import com.yzk.aiea.repository.InternalTicketRepository;
import com.yzk.aiea.repository.TicketLogRepository;

/**
 * 内置工单服务
 * 状态流转: OPEN -> IN_PROGRESS -> RESOLVED -> CLOSED
 *          OPEN/IN_PROGRESS -> IGNORED
 *          RESOLVED/CLOSED/IGNORED -> IN_PROGRESS (REOPEN)
 */
@Service
public class InternalTicketService {

    private static final Logger log = LoggerFactory.getLogger(InternalTicketService.class);

    private static final List<String> CLOSED_STATUSES = Arrays.asList("CLOSED", "IGNORED");

    private final InternalTicketRepository ticketRepository;
    private final TicketLogRepository ticketLogRepository;
    private final ErrorEventRepository errorEventRepository;
    private final LlmClient llmClient;

    public InternalTicketService(InternalTicketRepository ticketRepository,
                                  TicketLogRepository ticketLogRepository,
                                  ErrorEventRepository errorEventRepository,
                                  LlmClient llmClient) {
        this.ticketRepository = ticketRepository;
        this.ticketLogRepository = ticketLogRepository;
        this.errorEventRepository = errorEventRepository;
        this.llmClient = llmClient;
    }

    /**
     * 为错误事件创建或复用工单（同指纹未关闭则复用）
     * @param analysis AI分析结果（用于生成标题），可为null
     */
    @Transactional
    public InternalTicket createOrReuse(ErrorEvent event, AnalysisResult analysis) {
        // 同指纹有未关闭工单则复用
        Optional<InternalTicket> existing = ticketRepository
                .findFirstByFingerprintAndStatusNotIn(event.getFingerprint(), CLOSED_STATUSES);
        if (existing.isPresent()) {
            log.info("复用已有工单: ticketId={}, eventId={}", existing.get().getId(), event.getId());
            return existing.get();
        }

        // 创建新工单
        InternalTicket ticket = new InternalTicket();
        ticket.setEventId(event.getId());
        ticket.setFingerprint(event.getFingerprint());
        ticket.setTitle(buildAiTitle(event, analysis));
        ticket.setStatus("OPEN");
        ticket.setPriority(judgePriority(event));
        ticket = ticketRepository.save(ticket);

        // 记录日志
        saveLog(ticket.getId(), "CREATE", null, ticket.getStatus(), null, "自动创建工单");

        log.info("创建内置工单: ticketId={}, eventId={}", ticket.getId(), event.getId());
        return ticket;
    }

    /**
     * 记录错误复发（冷却窗口内重复上报时调用）
     * <p>
     * 同指纹存在未关闭工单时，在工单时间线中追加复发日志；
     * 若工单已被标记为 RESOLVED 但错误仍在复发，则自动重开工单。
     * 已 CLOSED / IGNORED 的工单不会被动，避免打扰已明确处理的结论。
     *
     * @param fingerprint 错误指纹
     * @param hitCount    冷却窗口内累计命中次数
     */
    @Transactional
    public void recordRecurrence(String fingerprint, int hitCount) {
        try {
            Optional<InternalTicket> existing = ticketRepository
                    .findFirstByFingerprintAndStatusNotIn(fingerprint, CLOSED_STATUSES);
            if (existing.isEmpty()) {
                return;
            }
            InternalTicket ticket = existing.get();

            if ("RESOLVED".equals(ticket.getStatus())) {
                // 工单已解决但错误仍在复发 → 自动重开
                String oldStatus = ticket.getStatus();
                ticket.setStatus("IN_PROGRESS");
                ticket.setResolvedAt(null);
                ticket.setClosedAt(null);
                ticketRepository.save(ticket);
                saveLog(ticket.getId(), "REOPEN", oldStatus, "IN_PROGRESS", null,
                        "错误再次发生（冷却窗口内第" + hitCount + "次合并），自动重开工单");
                log.info("工单自动重开(错误复发): ticketId={}, fingerprint={}, hitCount={}",
                        ticket.getId(), fingerprint, hitCount);
            } else {
                // 工单 OPEN / IN_PROGRESS → 追加复发日志
                saveLog(ticket.getId(), "RECURRENCE", null, null, null,
                        "错误再次发生（冷却窗口内第" + hitCount + "次合并）");
                log.info("记录工单复发: ticketId={}, fingerprint={}, hitCount={}",
                        ticket.getId(), fingerprint, hitCount);
            }
        } catch (Exception e) {
            log.warn("记录工单复发失败(不影响主流程): fingerprint={}, error={}", fingerprint, e.getMessage());
        }
    }

    /**
     * 认领工单
     */
    @Transactional
    public InternalTicket claim(Long ticketId, String assignee) {
        InternalTicket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new IllegalArgumentException("工单不存在: " + ticketId));

        String oldAssignee = ticket.getAssignee();
        String oldStatus = ticket.getStatus();

        ticket.setAssignee(assignee);
        if ("OPEN".equals(ticket.getStatus())) {
            ticket.setStatus("IN_PROGRESS");
        }
        ticket = ticketRepository.save(ticket);

        saveLog(ticketId, "CLAIM", oldAssignee, assignee, null, "认领工单");
        if (!oldStatus.equals(ticket.getStatus())) {
            saveLog(ticketId, "STATUS", oldStatus, ticket.getStatus(), null, "状态变更");
        }
        return ticket;
    }

    /**
     * 解决工单
     */
    @Transactional
    public InternalTicket resolve(Long ticketId, String resolution, String operator) {
        InternalTicket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new IllegalArgumentException("工单不存在: " + ticketId));

        String oldStatus = ticket.getStatus();
        ticket.setStatus("RESOLVED");
        ticket.setResolution(resolution);
        ticket.setResolvedAt(LocalDateTime.now());
        if (ticket.getAssignee() == null) {
            ticket.setAssignee(operator);
        }
        ticket = ticketRepository.save(ticket);

        saveLog(ticketId, "RESOLVE", oldStatus, "RESOLVED", operator, resolution);
        return ticket;
    }

    /**
     * 关闭工单
     */
    @Transactional
    public InternalTicket close(Long ticketId, String operator) {
        InternalTicket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new IllegalArgumentException("工单不存在: " + ticketId));

        String oldStatus = ticket.getStatus();
        ticket.setStatus("CLOSED");
        ticket.setClosedAt(LocalDateTime.now());
        ticket = ticketRepository.save(ticket);

        saveLog(ticketId, "CLOSE", oldStatus, "CLOSED", operator, "关闭工单");
        return ticket;
    }

    /**
     * 忽略工单
     */
    @Transactional
    public InternalTicket ignore(Long ticketId, String operator, String remark) {
        InternalTicket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new IllegalArgumentException("工单不存在: " + ticketId));

        String oldStatus = ticket.getStatus();
        ticket.setStatus("IGNORED");
        ticket.setClosedAt(LocalDateTime.now());
        ticket = ticketRepository.save(ticket);

        saveLog(ticketId, "IGNORE", oldStatus, "IGNORED", operator, remark);
        return ticket;
    }

    /**
     * 重新打开工单
     */
    @Transactional
    public InternalTicket reopen(Long ticketId, String operator, String remark) {
        InternalTicket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new IllegalArgumentException("工单不存在: " + ticketId));

        String oldStatus = ticket.getStatus();
        ticket.setStatus("IN_PROGRESS");
        ticket.setResolvedAt(null);
        ticket.setClosedAt(null);
        ticket = ticketRepository.save(ticket);

        saveLog(ticketId, "REOPEN", oldStatus, "IN_PROGRESS", operator, remark);
        return ticket;
    }

    /**
     * 变更优先级
     */
    @Transactional
    public InternalTicket changePriority(Long ticketId, String priority, String operator) {
        InternalTicket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new IllegalArgumentException("工单不存在: " + ticketId));

        String oldPriority = ticket.getPriority();
        ticket.setPriority(priority);
        ticket = ticketRepository.save(ticket);

        saveLog(ticketId, "PRIORITY", oldPriority, priority, operator, "变更优先级");
        return ticket;
    }

    /**
     * 查询工单详情（含操作日志）
     */
    @Transactional(readOnly = true)
    public TicketDetail getDetail(Long ticketId) {
        InternalTicket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new IllegalArgumentException("工单不存在: " + ticketId));
        List<TicketLog> logs = ticketLogRepository.findByTicketIdOrderByCreatedAtAsc(ticketId);
        return new TicketDetail(ticket, logs);
    }

    /**
     * 查询所有工单（可按状态过滤）
     */
    @Transactional(readOnly = true)
    public List<InternalTicket> list(String status, String assignee) {
        if (status != null && !status.isBlank()) {
            return ticketRepository.findByStatus(status);
        }
        if (assignee != null && !assignee.isBlank()) {
            return ticketRepository.findByAssignee(assignee);
        }
        return ticketRepository.findAll();
    }

    /**
     * 根据事件 ID 查询工单
     */
    @Transactional(readOnly = true)
    public List<InternalTicket> findByEventId(Long eventId) {
        return ticketRepository.findByEventId(eventId);
    }

    // ====== 内部方法 ======

    /**
     * 调用 LLM 生成简短工单标题，失败时降级为拼接标题
     */
    private String buildAiTitle(ErrorEvent event, AnalysisResult analysis) {
        String fallback = buildTitle(event);
        try {
            String systemPrompt = "你是一个工单标题生成助手。根据错误信息生成一个简短明了的中文工单标题，不超过30个字，不要包含环境和服务名前缀，直接输出标题文本，不要加引号或标点符号。";

            StringBuilder userPrompt = new StringBuilder();
            userPrompt.append("服务: ").append(event.getService()).append("\n");
            userPrompt.append("环境: ").append(event.getEnv()).append("\n");
            userPrompt.append("异常类型: ").append(event.getMessage() != null ? event.getMessage() : "未知").append("\n");

            // 截取堆栈前 500 字符作为上下文
            if (event.getStack() != null) {
                String stack = event.getStack().length() > 500 ? event.getStack().substring(0, 500) : event.getStack();
                userPrompt.append("堆栈摘要: ").append(stack).append("\n");
            }

            if (analysis != null && analysis.getRootCause() != null) {
                userPrompt.append("AI根因分析: ").append(analysis.getRootCause()).append("\n");
            }

            userPrompt.append("\n请生成一个简短的工单标题。示例:\n");
            userPrompt.append("- 数组越界异常\n");
            userPrompt.append("- 空指针访问导致服务崩溃\n");
            userPrompt.append("- 数据库连接池耗尽\n");
            userPrompt.append("- 指标详情接口数组越界");

            Optional<String> aiResult = llmClient.chat(systemPrompt, userPrompt.toString());
            if (aiResult.isPresent()) {
                String title = aiResult.get().trim();
                // 清理可能的引号和换行
                title = title.replaceAll("^[\"\u201c\u201d]+|[\"\u201c\u201d]+$", "");
                title = title.replaceAll("[\r\n]", "");
                if (title.length() > 50) {
                    title = title.substring(0, 50);
                }
                if (!title.isBlank()) {
                    log.info("AI生成工单标题: {}", title);
                    return title;
                }
            }
        } catch (Exception e) {
            log.warn("AI生成工单标题失败，降级为拼接标题: {}", e.getMessage());
        }
        return fallback;
    }

    private String buildTitle(ErrorEvent event) {
        String msg = event.getMessage() != null ? event.getMessage() : "未知异常";
        if (msg.length() > 120) msg = msg.substring(0, 120);
        return "[" + event.getEnv() + "][" + event.getService() + "] " + msg;
    }

    private String judgePriority(ErrorEvent event) {
        String msg = event.getMessage() != null ? event.getMessage().toLowerCase() : "";
        if (msg.contains("outofmemory") || msg.contains("oom") || msg.contains("deadlock")) {
            return "P0";
        }
        if (msg.contains("nullpointer") || msg.contains("sqlexception") || msg.contains("connection")) {
            return "P1";
        }
        return "P2";
    }

    private void saveLog(Long ticketId, String action, String oldValue, String newValue,
                         String operator, String remark) {
        TicketLog logEntry = new TicketLog();
        logEntry.setTicketId(ticketId);
        logEntry.setAction(action);
        logEntry.setOldValue(oldValue);
        logEntry.setNewValue(newValue);
        logEntry.setOperator(operator);
        logEntry.setRemark(remark);
        ticketLogRepository.save(logEntry);
    }

    /**
     * 工单详情 DTO（含操作日志）
     */
    public static class TicketDetail {
        private final InternalTicket ticket;
        private final List<TicketLog> logs;

        public TicketDetail(InternalTicket ticket, List<TicketLog> logs) {
            this.ticket = ticket;
            this.logs = logs;
        }

        public InternalTicket getTicket() { return ticket; }
        public List<TicketLog> getLogs() { return logs; }
    }
}
