package com.yzk.aiea.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * 告警抑制/冷却规则
 * 对应 init.sql: suppress_rule (fingerprint 为主键)
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "suppress_rule")
public class SuppressRule {

    @Id
    @Column(name = "fingerprint", nullable = false, length = 64)
    private String fingerprint;

    @Column(name = "cooldown_sec", nullable = false)
    private Integer cooldownSec = 600;

    @Column(name = "last_fired_at")
    private LocalDateTime lastFiredAt;

    @Column(name = "hit_count", nullable = false)
    private Integer hitCount = 0;
}
