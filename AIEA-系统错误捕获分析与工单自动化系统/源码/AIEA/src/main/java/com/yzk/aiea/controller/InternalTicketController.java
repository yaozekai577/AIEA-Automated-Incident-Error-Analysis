package com.yzk.aiea.controller;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.yzk.aiea.entity.InternalTicket;
import com.yzk.aiea.service.ticket.InternalTicketService;
import com.yzk.aiea.service.ticket.InternalTicketService.TicketDetail;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/**
 * 内置工单管理接口
 */
@RestController
@RequestMapping("/api/v1/tickets")
@Tag(name = "内置工单", description = "工单创建、认领、解决、关闭、忽略等操作")
public class InternalTicketController {

    private final InternalTicketService ticketService;

    public InternalTicketController(InternalTicketService ticketService) {
        this.ticketService = ticketService;
    }

    /**
     * 工单列表（可按状态/处理人过滤）
     */
    @GetMapping
    @Operation(summary = "工单列表", description = "可按 status / assignee 过滤")
    public List<InternalTicket> list(
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "assignee", required = false) String assignee) {
        return ticketService.list(status, assignee);
    }

    /**
     * 工单详情（含操作日志）
     */
    @GetMapping("/{id}")
    @Operation(summary = "工单详情", description = "含操作时间线")
    public ResponseEntity<?> detail(@PathVariable Long id) {
        try {
            TicketDetail detail = ticketService.getDetail(id);
            return ResponseEntity.ok(detail);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * 根据事件 ID 查询工单
     */
    @GetMapping("/by-event/{eventId}")
    @Operation(summary = "根据事件ID查询工单")
    public List<InternalTicket> byEvent(@PathVariable Long eventId) {
        return ticketService.findByEventId(eventId);
    }

    /**
     * 认领工单
     */
    @PostMapping("/{id}/claim")
    @Operation(summary = "认领工单")
    public ResponseEntity<?> claim(@PathVariable Long id, @RequestBody Map<String, String> body) {
        try {
            String assignee = body.get("assignee");
            if (assignee == null || assignee.isBlank()) {
                assignee = body.getOrDefault("operator", "anonymous");
            }
            InternalTicket ticket = ticketService.claim(id, assignee);
            return ResponseEntity.ok(ticket);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * 解决工单
     */
    @PostMapping("/{id}/resolve")
    @Operation(summary = "标记为已解决")
    public ResponseEntity<?> resolve(@PathVariable Long id, @RequestBody Map<String, String> body) {
        try {
            String resolution = body.get("resolution");
            String operator = body.getOrDefault("operator", "anonymous");
            InternalTicket ticket = ticketService.resolve(id, resolution, operator);
            return ResponseEntity.ok(ticket);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * 关闭工单
     */
    @PostMapping("/{id}/close")
    @Operation(summary = "关闭工单")
    public ResponseEntity<?> close(@PathVariable Long id, @RequestBody Map<String, String> body) {
        try {
            String operator = body.getOrDefault("operator", "anonymous");
            InternalTicket ticket = ticketService.close(id, operator);
            return ResponseEntity.ok(ticket);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * 忽略工单
     */
    @PostMapping("/{id}/ignore")
    @Operation(summary = "忽略工单")
    public ResponseEntity<?> ignore(@PathVariable Long id, @RequestBody Map<String, String> body) {
        try {
            String operator = body.getOrDefault("operator", "anonymous");
            String remark = body.get("remark");
            InternalTicket ticket = ticketService.ignore(id, operator, remark);
            return ResponseEntity.ok(ticket);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * 重新打开工单
     */
    @PostMapping("/{id}/reopen")
    @Operation(summary = "重新打开工单")
    public ResponseEntity<?> reopen(@PathVariable Long id, @RequestBody Map<String, String> body) {
        try {
            String operator = body.getOrDefault("operator", "anonymous");
            String remark = body.get("remark");
            InternalTicket ticket = ticketService.reopen(id, operator, remark);
            return ResponseEntity.ok(ticket);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * 变更优先级
     */
    @PostMapping("/{id}/priority")
    @Operation(summary = "变更优先级")
    public ResponseEntity<?> changePriority(@PathVariable Long id, @RequestBody Map<String, String> body) {
        try {
            String priority = body.get("priority");
            String operator = body.getOrDefault("operator", "anonymous");
            InternalTicket ticket = ticketService.changePriority(id, priority, operator);
            return ResponseEntity.ok(ticket);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", e.getMessage()));
        }
    }
}
