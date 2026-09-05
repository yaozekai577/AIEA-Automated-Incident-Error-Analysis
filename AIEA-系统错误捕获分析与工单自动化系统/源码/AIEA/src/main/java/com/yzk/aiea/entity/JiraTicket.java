package com.yzk.aiea.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * Jira 工单关联
 * 对应 init.sql: jira_ticket
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "jira_ticket")
public class JiraTicket {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "event_id", nullable = false)
    private Long eventId;

    @Column(name = "jira_key", nullable = false, length = 64)
    private String jiraKey;

    @Column(name = "project", length = 64)
    private String project;

    @Column(name = "url", length = 512)
    private String url;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void prePersist() {
        if (this.createdAt == null) {
            this.createdAt = LocalDateTime.now();
        }
    }
}
