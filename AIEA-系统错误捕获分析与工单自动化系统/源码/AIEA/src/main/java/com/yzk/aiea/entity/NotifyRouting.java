package com.yzk.aiea.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * 通知路由规则（服务名 + 渠道 → Webhook）
 * <p>
 * 按业务服务名 + 通知渠道将错误通知路由到不同的 IM 群机器人。
 * 同一服务可配两条规则：一条 feishu、一条 dingtalk。
 * 未配置路由的服务 fallback 到全局 webhook。
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "notify_routing",
       uniqueConstraints = @UniqueConstraint(name = "uk_service_channel",
               columnNames = {"service", "channel"}))
public class NotifyRouting {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 业务服务名（对应 error_event.service） */
    @Column(name = "service", nullable = false, length = 128)
    private String service;

    /** 通知渠道：feishu / dingtalk */
    @Column(name = "channel", nullable = false, length = 32)
    private String channel = "feishu";

    /** IM 自定义机器人 Webhook 地址 */
    @Column(name = "webhook_url", nullable = false, length = 512)
    private String webhookUrl;

    /** 描述（如：订单服务专属飞书群） */
    @Column(name = "description", length = 255)
    private String description;

    /** 是否启用 */
    @Column(name = "enabled", nullable = false)
    private Boolean enabled = true;

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
