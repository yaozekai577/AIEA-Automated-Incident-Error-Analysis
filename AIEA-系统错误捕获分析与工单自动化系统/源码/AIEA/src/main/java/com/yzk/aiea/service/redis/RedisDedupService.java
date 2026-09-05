package com.yzk.aiea.service.redis;

import java.time.Duration;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

/**
 * 基于 Redis 的错误指纹冷却/去重服务
 * <p>
 * 核心设计：
 * <ul>
 *   <li>首次上报：SET key=0 EX=cooldown → 未被抑制</li>
 *   <li>窗口内重复：INCR key → 被抑制，返回命中次数</li>
 *   <li>窗口过期后：key 自动删除，下一次上报视为首次</li>
 * </ul>
 * Redis 不可用时降级返回「未抑制」，保证主链路不中断。
 */
@Service
public class RedisDedupService {

    private static final Logger log = LoggerFactory.getLogger(RedisDedupService.class);

    private static final String DEDUP_PREFIX = "aiea:dedup:";

    private final StringRedisTemplate redisTemplate;

    public RedisDedupService(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    /**
     * 尝试获取指纹冷却锁
     *
     * @param fingerprint     错误指纹
     * @param cooldownSeconds 冷却窗口（秒）
     * @return DedupResult：suppressed=true 表示在冷却窗口内被抑制，hitCount 为合并次数
     */
    public DedupResult checkAndMark(String fingerprint, int cooldownSeconds) {
        String key = DEDUP_PREFIX + fingerprint;
        try {
            // 尝试 SET NX（仅当 key 不存在时设置），value 初始为 0
            Boolean acquired = redisTemplate.opsForValue()
                    .setIfAbsent(key, "0", Duration.ofSeconds(cooldownSeconds));

            if (Boolean.TRUE.equals(acquired)) {
                // 首次进入，未被抑制
                return new DedupResult(false, 0);
            }

            // key 已存在 → 在冷却窗口内，原子递增命中计数
            Long hitCount = redisTemplate.opsForValue().increment(key);
            int hits = hitCount != null ? hitCount.intValue() : 1;
            log.info("指纹 {} 在冷却窗口内被抑制, 命中次数={}", fingerprint, hits);
            return new DedupResult(true, hits);

        } catch (Exception e) {
            log.warn("Redis 去重检查失败，降级放行: fingerprint={}, error={}", fingerprint, e.getMessage());
            return new DedupResult(false, 0);
        }
    }

    /**
     * 获取当前指纹的命中次数（用于通知消息中展示「合并 N 次」）
     *
     * @param fingerprint 错误指纹
     * @return 命中次数，Redis 不可用或无记录时返回 0
     */
    public int getHitCount(String fingerprint) {
        String key = DEDUP_PREFIX + fingerprint;
        try {
            String val = redisTemplate.opsForValue().get(key);
            if (val == null) {
                return 0;
            }
            return Integer.parseInt(val);
        } catch (Exception e) {
            log.warn("Redis 获取命中次数失败: fingerprint={}, error={}", fingerprint, e.getMessage());
            return 0;
        }
    }

    /**
     * 去重结果
     *
     * @param suppressed 是否被抑制
     * @param hitCount   冷却窗口内命中次数（0 表示首次）
     */
    public record DedupResult(boolean suppressed, int hitCount) {
    }
}
