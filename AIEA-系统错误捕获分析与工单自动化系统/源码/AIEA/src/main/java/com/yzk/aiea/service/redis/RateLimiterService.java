package com.yzk.aiea.service.redis;

import java.time.Duration;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

/**
 * 基于 Redis 的固定窗口限流器
 * <p>
 * 支持全局 QPS 限流和每服务 QPS 限流。
 * 使用 INCR + EXPIRE 实现：首次 INCR 时设置 TTL=1s，窗口结束自动清理。
 * <p>
 * Redis 不可用时 fail-open（放行），保证主链路不中断。
 */
@Service
public class RateLimiterService {

    private static final Logger log = LoggerFactory.getLogger(RateLimiterService.class);

    private static final String RATE_LIMIT_PREFIX = "aiea:ratelimit:";
    private static final Duration WINDOW = Duration.ofSeconds(1);

    private final StringRedisTemplate redisTemplate;

    public RateLimiterService(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    /**
     * 检查是否允许通过（全局 + 每服务双重限流）
     *
     * @param service       服务名
     * @param globalQps     全局 QPS 上限
     * @param perServiceQps 每服务 QPS 上限
     * @return true=允许，false=被限流
     */
    public boolean allowRequest(String service, int globalQps, int perServiceQps) {
        long now = System.currentTimeMillis() / 1000;
        try {
            // 全局限流
            if (!checkLimit(RATE_LIMIT_PREFIX + "global:" + now, globalQps)) {
                log.warn("全局限流触发: globalQps={}", globalQps);
                return false;
            }
            // 每服务限流
            if (!checkLimit(RATE_LIMIT_PREFIX + "svc:" + service + ":" + now, perServiceQps)) {
                log.warn("服务限流触发: service={}, perServiceQps={}", service, perServiceQps);
                return false;
            }
            return true;
        } catch (Exception e) {
            log.warn("Redis 限流检查失败，降级放行: error={}", e.getMessage());
            return true;
        }
    }

    /**
     * 检查单个窗口是否在限额内
     */
    private boolean checkLimit(String key, int maxQps) {
        Long count = redisTemplate.opsForValue().increment(key);
        if (count != null && count == 1) {
            // 首次请求，设置窗口 TTL
            redisTemplate.expire(key, WINDOW);
        }
        return count == null || count <= maxQps;
    }
}
