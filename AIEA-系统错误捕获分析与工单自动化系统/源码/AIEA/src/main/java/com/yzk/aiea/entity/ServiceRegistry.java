package com.yzk.aiea.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * 服务注册与上报鉴权（每服务一个 Token）
 * <p>
 * SDK 上报时需携带 X-AIEA-Token 头，服务端按 service + token 配对校验。
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "service_registry",
       uniqueConstraints = {
               @UniqueConstraint(name = "uk_service", columnNames = {"service"}),
               @UniqueConstraint(name = "uk_api_token", columnNames = {"api_token"})
       })
public class ServiceRegistry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 业务服务名（对应 error_event.service） */
    @Column(name = "service", nullable = false, length = 128)
    private String service;

    /** 服务专属上报 Token */
    @Column(name = "api_token", nullable = false, length = 128)
    private String apiToken;

    /** 描述（如：订单服务） */
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
