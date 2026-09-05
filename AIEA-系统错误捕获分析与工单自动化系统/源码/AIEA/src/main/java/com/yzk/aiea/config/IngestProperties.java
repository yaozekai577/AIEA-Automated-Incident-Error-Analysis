package com.yzk.aiea.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * 错误接入配置
 */
@Component
@ConfigurationProperties(prefix = "ingest")
@Data
public class IngestProperties {

    /** 去重冷却窗口（秒），同一指纹在此窗口内不重复触发下游 */
    private int dedupCooldownSeconds = 300;

    /** 堆栈最大长度（截断保护） */
    private int maxStackLength = 32768;

    /** 消息最大长度（截断保护） */
    private int maxMessageLength = 1024;

    /** 是否启用限流（基于 Redis） */
    private boolean rateLimitEnabled = false;

    /** 全局 QPS 上限 */
    private int globalQps = 100;

    /** 每服务 QPS 上限 */
    private int perServiceQps = 20;
}
