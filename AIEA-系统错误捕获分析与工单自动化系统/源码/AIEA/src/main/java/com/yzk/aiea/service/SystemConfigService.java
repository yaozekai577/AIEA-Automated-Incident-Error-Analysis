package com.yzk.aiea.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.yzk.aiea.config.LlmProperties;
import com.yzk.aiea.entity.SystemConfig;
import com.yzk.aiea.repository.SystemConfigRepository;

/**
 * 系统动态配置服务
 * <p>
 * 读取优先级：DB (system_config 表) > application.yaml > 代码默认值。
 * 修改配置后立即生效，无需重启服务。
 */
@Service
public class SystemConfigService {

    private static final Logger log = LoggerFactory.getLogger(SystemConfigService.class);

    // LLM 配置键
    public static final String KEY_LLM_BASE_URL = "llm.base-url";
    public static final String KEY_LLM_API_KEY = "llm.api-key";
    public static final String KEY_LLM_MODEL = "llm.model";
    public static final String KEY_LLM_CACHE_TTL = "llm.analysis-cache-ttl";

    private final SystemConfigRepository configRepository;
    private final LlmProperties llmProperties;

    public SystemConfigService(SystemConfigRepository configRepository,
                               LlmProperties llmProperties) {
        this.configRepository = configRepository;
        this.llmProperties = llmProperties;
    }

    // ===== 通用方法 =====

    /** 读 DB 值，DB 没有返回 null */
    private String getDbValue(String key) {
        return configRepository.findById(key)
                .map(SystemConfig::getConfigValue)
                .orElse(null);
    }

    /** 写 DB（upsert） */
    private void setDbValue(String key, String value, String description) {
        SystemConfig config = configRepository.findById(key).orElse(new SystemConfig());
        config.setConfigKey(key);
        config.setConfigValue(value);
        if (description != null) {
            config.setDescription(description);
        }
        configRepository.save(config);
        log.info("系统配置已更新: {} = {}", key, key.contains("key") || key.contains("token") ? "***" : value);
    }

    // ===== LLM 配置读取（DB 优先，yaml 兜底） =====

    /** LLM Base URL */
    public String getLlmBaseUrl() {
        String dbVal = getDbValue(KEY_LLM_BASE_URL);
        if (dbVal != null && !dbVal.isBlank()) {
            return dbVal;
        }
        return llmProperties.getBaseUrl();
    }

    /** LLM API Key */
    public String getLlmApiKey() {
        String dbVal = getDbValue(KEY_LLM_API_KEY);
        if (dbVal != null && !dbVal.isBlank()) {
            return dbVal;
        }
        return llmProperties.getApiKey();
    }

    /** LLM 模型名 */
    public String getLlmModel() {
        String dbVal = getDbValue(KEY_LLM_MODEL);
        if (dbVal != null && !dbVal.isBlank()) {
            return dbVal;
        }
        return llmProperties.getModel();
    }

    /** LLM 分析缓存 TTL（秒） */
    public int getLlmAnalysisCacheTtl() {
        String dbVal = getDbValue(KEY_LLM_CACHE_TTL);
        if (dbVal != null && !dbVal.isBlank()) {
            try {
                return Integer.parseInt(dbVal.trim());
            } catch (NumberFormatException e) {
                log.warn("DB 中 {} 格式非法: {}, 使用 yaml 值", KEY_LLM_CACHE_TTL, dbVal);
            }
        }
        return llmProperties.getAnalysisCacheTtl();
    }

    /** API Key 是否已配置（DB 或 yaml 任一处有值即可） */
    public boolean isLlmApiKeyConfigured() {
        String key = getLlmApiKey();
        return key != null && !key.isBlank();
    }

    // ===== LLM 配置修改 =====

    /**
     * 批量更新 LLM 配置
     *
     * @param baseUrl       Base URL（null/空=不修改）
     * @param apiKey        API Key（null/空=不修改，空字符串=清除）
     * @param model         模型名（null/空=不修改）
     * @param cacheTtl      缓存TTL（null=不修改）
     */
    public void updateLlmConfig(String baseUrl, String apiKey, String model, Integer cacheTtl) {
        if (baseUrl != null && !baseUrl.isBlank()) {
            setDbValue(KEY_LLM_BASE_URL, baseUrl.trim(), "大模型 API Base URL");
        }
        if (apiKey != null) {
            // 空字符串表示清除，非空表示更新
            setDbValue(KEY_LLM_API_KEY, apiKey.isBlank() ? null : apiKey.trim(), "大模型 API Key");
        }
        if (model != null && !model.isBlank()) {
            setDbValue(KEY_LLM_MODEL, model.trim(), "大模型名称");
        }
        if (cacheTtl != null) {
            setDbValue(KEY_LLM_CACHE_TTL, String.valueOf(cacheTtl), "同指纹 LLM 分析缓存 TTL(秒)");
        }
    }
}
