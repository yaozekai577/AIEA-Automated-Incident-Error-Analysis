package com.yzk.aiea.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;

/**
 * Redis 配置
 * <p>
 * 使用 StringRedisTemplate（key/value 均为 String），序列化无歧义、可读性好。
 * 复杂对象由调用方自行 JSON 序列化。
 */
@Configuration
@ConditionalOnClass(RedisConnectionFactory.class)
public class RedisConfig {

    @Bean
    public StringRedisTemplate stringRedisTemplate(RedisConnectionFactory connectionFactory) {
        StringRedisTemplate template = new StringRedisTemplate();
        template.setConnectionFactory(connectionFactory);
        // 连接失败不抛异常到启动流程，运行时操作失败由各 Service 降级处理
        template.afterPropertiesSet();
        return template;
    }

    /**
     * 指纹冷却键前缀
     */
    public static final String DEDUP_PREFIX = "aiea:dedup:";

    /**
     * 限流键前缀
     */
    public static final String RATE_LIMIT_PREFIX = "aiea:ratelimit:";

    /**
     * LLM 分析缓存键前缀
     */
    public static final String LLM_CACHE_PREFIX = "aiea:llm:analysis:";
}
