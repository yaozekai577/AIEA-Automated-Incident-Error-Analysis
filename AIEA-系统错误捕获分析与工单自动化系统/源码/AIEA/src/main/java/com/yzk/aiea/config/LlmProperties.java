package com.yzk.aiea.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * 大模型 API 配置属性
 * 对应 application.yaml 中的 llm.* 配置项
 */
@Component
@ConfigurationProperties(prefix = "llm")
@Data
public class LlmProperties {

    /** 大模型 API Base URL (OpenAI 兼容格式) */
    private String baseUrl;

    /** API Key */
    private String apiKey;

    /** 模型名称 */
    private String model;

    /** 超时时间(毫秒) */
    private int timeout = 30000;

    /** 同指纹 LLM 分析结果缓存 TTL（秒），0 表示不缓存 */
    private int analysisCacheTtl = 3600;
}
