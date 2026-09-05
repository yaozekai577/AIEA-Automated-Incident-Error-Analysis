package com.yzk.aiea.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * 系统动态配置（key-value）
 * <p>
 * 支持 LLM 等配置从前端管理，DB 优先、yaml 兜底。
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "system_config")
public class SystemConfig {

    @Id
    @Column(name = "config_key", nullable = false, length = 128)
    private String configKey;

    @Column(name = "config_value", columnDefinition = "TEXT")
    private String configValue;

    @Column(name = "description", length = 255)
    private String description;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    @PreUpdate
    protected void preSave() {
        this.updatedAt = LocalDateTime.now();
    }
}
