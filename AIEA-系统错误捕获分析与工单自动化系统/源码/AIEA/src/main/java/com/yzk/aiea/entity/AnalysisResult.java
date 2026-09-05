package com.yzk.aiea.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 大模型根因分析结果
 * 对应 init.sql: analysis_result (event_id 为主键，关联 error_event)
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "analysis_result")
public class AnalysisResult {

    @Id
    @Column(name = "event_id", nullable = false)
    private Long eventId;

    @Column(name = "root_cause", columnDefinition = "TEXT")
    private String rootCause;

    @Column(name = "suggestions", columnDefinition = "json")
    private String suggestions;

    @Column(name = "confidence", precision = 5, scale = 4)
    private BigDecimal confidence;

    @Column(name = "model", length = 128)
    private String model;

    @Column(name = "raw_response", columnDefinition = "TEXT")
    private String rawResponse;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void prePersist() {
        if (this.createdAt == null) {
            this.createdAt = LocalDateTime.now();
        }
    }
}
