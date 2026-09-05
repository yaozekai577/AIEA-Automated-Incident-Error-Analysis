package com.yzk.aiea.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * 协作推送记录（飞书/钉钉）
 * 对应 init.sql: notify_record
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "notify_record")
public class NotifyRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "event_id", nullable = false)
    private Long eventId;

    @Column(name = "channel", length = 32)
    private String channel;

    @Column(name = "payload", columnDefinition = "TEXT")
    private String payload;

    @Column(name = "http_status")
    private Integer httpStatus;

    @Column(name = "sent_at")
    private LocalDateTime sentAt;

    @PrePersist
    protected void prePersist() {
        if (this.sentAt == null) {
            this.sentAt = LocalDateTime.now();
        }
    }
}
