package com.yzk.aiea.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * 错误事件（接入主表）
 * 对应 init.sql: error_event
 * 状态机: RECEIVED -> ANALYZING -> NOTIFIED -> TICKETED -> FAILED
 *         SUPPRESSED (冷却窗口内重复上报，不进入流水线)
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "error_event")
public class ErrorEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "fingerprint", nullable = false, length = 64)
    private String fingerprint;

    @Column(name = "env", nullable = false, length = 32)
    private String env = "local";

    @Column(name = "service", nullable = false, length = 128)
    private String service;

    @Column(name = "message", length = 1024)
    private String message;

    @Column(name = "stack", columnDefinition = "TEXT")
    private String stack;

    @Column(name = "context_json", columnDefinition = "json")
    private String contextJson;

    @Column(name = "status", nullable = false, length = 32)
    private String status = "RECEIVED";

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void prePersist() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = this.createdAt;
    }

    @PreUpdate
    protected void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
