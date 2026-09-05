package com.yzk.aiea.service.redis;

import java.time.Duration;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.yzk.aiea.entity.AnalysisResult;

/**
 * 基于 Redis 的 LLM 分析结果缓存
 * <p>
 * 同指纹的错误在 TTL 窗口内复用已有分析结果，避免重复消耗 LLM Token。
 * 缓存的是不含 eventId 的分析摘要，命中后调用方需自行设置 eventId 再落库。
 * <p>
 * Redis 不可用时降级返回 empty（缓存 miss），不影响主链路。
 */
@Service
public class LlmAnalysisCacheService {

    private static final Logger log = LoggerFactory.getLogger(LlmAnalysisCacheService.class);

    private static final String CACHE_PREFIX = "aiea:llm:analysis:";

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    public LlmAnalysisCacheService(StringRedisTemplate redisTemplate,
                                    ObjectMapper objectMapper) {
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
    }

    /**
     * 从缓存获取同指纹的分析结果
     *
     * @param fingerprint 错误指纹
     * @param ttlSeconds  缓存 TTL（秒），0 表示不启用缓存
     * @return 缓存的分析结果（eventId 未设置），未命中返回 null
     */
    public AnalysisResult get(String fingerprint, int ttlSeconds) {
        if (ttlSeconds <= 0) {
            return null;
        }
        String key = CACHE_PREFIX + fingerprint;
        try {
            String json = redisTemplate.opsForValue().get(key);
            if (json == null || json.isBlank()) {
                return null;
            }
            AnalysisResult cached = objectMapper.readValue(json, AnalysisResult.class);
            log.info("LLM 分析缓存命中: fingerprint={}", fingerprint);
            return cached;
        } catch (Exception e) {
            log.warn("Redis 分析缓存读取失败: fingerprint={}, error={}", fingerprint, e.getMessage());
            return null;
        }
    }

    /**
     * 将分析结果写入缓存
     *
     * @param fingerprint 错误指纹
     * @param result      分析结果（eventId 不会被缓存）
     * @param ttlSeconds  缓存 TTL（秒），0 表示不启用缓存
     */
    public void put(String fingerprint, AnalysisResult result, int ttlSeconds) {
        if (ttlSeconds <= 0 || result == null) {
            return;
        }
        String key = CACHE_PREFIX + fingerprint;
        try {
            // 缓存副本，清除 eventId 避免混淆
            AnalysisResult copy = new AnalysisResult();
            copy.setRootCause(result.getRootCause());
            copy.setSuggestions(result.getSuggestions());
            copy.setConfidence(result.getConfidence());
            copy.setModel(result.getModel());
            copy.setRawResponse(result.getRawResponse());
            copy.setCreatedAt(result.getCreatedAt());

            String json = objectMapper.writeValueAsString(copy);
            redisTemplate.opsForValue().set(key, json, Duration.ofSeconds(ttlSeconds));
            log.info("LLM 分析结果已缓存: fingerprint={}, ttl={}s", fingerprint, ttlSeconds);
        } catch (Exception e) {
            log.warn("Redis 分析缓存写入失败: fingerprint={}, error={}", fingerprint, e.getMessage());
        }
    }
}
