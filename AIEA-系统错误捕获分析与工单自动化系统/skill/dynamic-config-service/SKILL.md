---
name: dynamic-config-service
description: Build a dynamic configuration service with three-level priority (DB > YAML > default) supporting runtime hot-update without restart. Use when designing configurable Spring Boot applications, implementing runtime-editable settings, or needing DB-backed configuration that overrides static YAML with API-level management.
---

# Dynamic Config Service (DB > YAML > Default)

## Architecture

```
读取配置请求 (config_key)
    │
    ▼
Level 1: DB (system_config 表) — 有值？→ 返回 DB 值（最高优先级）
    │ null / blank
    ▼
Level 2: application.yaml (@ConfigurationProperties) — 有值？→ 返回 yaml 值
    │ null
    ▼
Level 3: 代码默认值 — 返回默认值
```

**Key benefit**: Modify config via API/frontend at runtime — no restart needed. DB values override YAML.

## Database Schema

```sql
CREATE TABLE system_config (
    config_key    VARCHAR(128) NOT NULL COMMENT '配置键 (如 llm.model)',
    config_value  TEXT         NULL     COMMENT '配置值',
    description   VARCHAR(255) NULL     COMMENT '描述',
    updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (config_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

## JPA Entity

```java
@Entity
@Table(name = "system_config")
public class SystemConfig {

    @Id
    @Column(name = "config_key", length = 128)
    private String configKey;

    @Column(name = "config_value", columnDefinition = "TEXT")
    private String configValue;

    private String description;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    @PreUpdate
    void preUpdate() { this.updatedAt = LocalDateTime.now(); }

    // getters / setters
}
```

## Repository

```java
public interface SystemConfigRepository extends JpaRepository<SystemConfig, String> {
    // PK = config_key, findById inherited
}
```

## YAML Properties (Level 2)

```java
@Component
@ConfigurationProperties(prefix = "llm")
@Data
public class LlmProperties {
    private String baseUrl = "https://dashscope.aliyuncs.com/compatible-mode/v1";
    private String apiKey;
    private String model = "qwen-plus";
    private int timeout = 30000;
    private int analysisCacheTtl = 3600;
}
```

```yaml
llm:
  base-url: https://dashscope.aliyuncs.com/compatible-mode/v1
  api-key: sk-xxx
  model: qwen-plus
  timeout: 30000
  analysis-cache-ttl: 3600
```

## Core Service

```java
@Service
public class SystemConfigService {

    // Known config keys
    public static final String KEY_LLM_BASE_URL = "llm.base-url";
    public static final String KEY_LLM_API_KEY  = "llm.api-key";
    public static final String KEY_LLM_MODEL    = "llm.model";
    public static final String KEY_LLM_CACHE_TTL = "llm.analysis-cache-ttl";

    private final SystemConfigRepository configRepository;
    private final LlmProperties llmProperties;  // YAML fallback

    // ===== Read: DB > YAML > Default =====

    /** Read DB value, return null if not found */
    private String getDbValue(String key) {
        return configRepository.findById(key)
                .map(SystemConfig::getConfigValue)
                .orElse(null);
    }

    public String getLlmBaseUrl() {
        String dbVal = getDbValue(KEY_LLM_BASE_URL);
        if (dbVal != null && !dbVal.isBlank()) return dbVal;
        return llmProperties.getBaseUrl();  // YAML fallback
    }

    public String getLlmApiKey() {
        String dbVal = getDbValue(KEY_LLM_API_KEY);
        if (dbVal != null && !dbVal.isBlank()) return dbVal;
        return llmProperties.getApiKey();
    }

    public String getLlmModel() {
        String dbVal = getDbValue(KEY_LLM_MODEL);
        if (dbVal != null && !dbVal.isBlank()) return dbVal;
        return llmProperties.getModel();
    }

    public int getLlmAnalysisCacheTtl() {
        String dbVal = getDbValue(KEY_LLM_CACHE_TTL);
        if (dbVal != null && !dbVal.isBlank()) {
            try {
                return Integer.parseInt(dbVal.trim());
            } catch (NumberFormatException e) {
                log.warn("DB 配置格式非法: {}={}, 使用 yaml 值", KEY_LLM_CACHE_TTL, dbVal);
            }
        }
        return llmProperties.getAnalysisCacheTtl();
    }

    /** API Key 是否已配置 (DB 或 yaml 任一处有值) */
    public boolean isLlmApiKeyConfigured() {
        String key = getLlmApiKey();
        return key != null && !key.isBlank();
    }

    // ===== Write: upsert to DB =====

    /** Write DB (upsert) */
    private void setDbValue(String key, String value, String description) {
        SystemConfig config = configRepository.findById(key).orElse(new SystemConfig());
        config.setConfigKey(key);
        config.setConfigValue(value);
        if (description != null) config.setDescription(description);
        configRepository.save(config);
        // Log: mask sensitive keys
        log.info("系统配置已更新: {} = {}", key,
                key.contains("key") || key.contains("token") ? "***" : value);
    }

    /**
     * Batch update LLM config
     * @param baseUrl   null/blank = skip
     * @param apiKey    null = skip, "" = clear
     * @param model     null/blank = skip
     * @param cacheTtl  null = skip
     */
    public void updateLlmConfig(String baseUrl, String apiKey,
                                 String model, Integer cacheTtl) {
        if (baseUrl != null && !baseUrl.isBlank())
            setDbValue(KEY_LLM_BASE_URL, baseUrl.trim(), "大模型 API Base URL");
        if (apiKey != null)
            setDbValue(KEY_LLM_API_KEY, apiKey.isBlank() ? null : apiKey.trim(), "大模型 API Key");
        if (model != null && !model.isBlank())
            setDbValue(KEY_LLM_MODEL, model.trim(), "大模型名称");
        if (cacheTtl != null)
            setDbValue(KEY_LLM_CACHE_TTL, String.valueOf(cacheTtl), "LLM 分析缓存 TTL(秒)");
    }
}
```

## REST API (Hot Update)

```java
@RestController
@RequestMapping("/api/v1/llm-config")
public class LlmConfigController {

    @GetMapping
    public Map<String, Object> getConfig() {
        return Map.of(
            "baseUrl", configService.getLlmBaseUrl(),
            "apiKeyConfigured", configService.isLlmApiKeyConfigured(),  // 不返回明文
            "model", configService.getLlmModel(),
            "analysisCacheTtl", configService.getLlmAnalysisCacheTtl()
        );
    }

    @PutMapping
    public Map<String, Object> updateConfig(@RequestBody Map<String, Object> body) {
        configService.updateLlmConfig(
            (String) body.get("baseUrl"),
            (String) body.get("apiKey"),
            (String) body.get("model"),
            body.get("analysisCacheTtl") instanceof Number n ? n.intValue() : null
        );
        return Map.of("updated", true);
    }
}
```

## Security: Sensitive Value Masking

```java
// Read API never returns plaintext API Key:
"apiKeyConfigured": true / false  ← 只返回是否已配置

// Write API: null = skip, "" = clear, non-blank = update
// Log output masks keys containing "key" or "token":
log.info("系统配置已更新: {} = {}", key,
    key.contains("key") || key.contains("token") ? "***" : value);
```

## Type-Safe Read Pattern

For non-String types (int, boolean), parse with fallback:

```java
public int getIntConfig(String key, int yamlDefault) {
    String dbVal = getDbValue(key);
    if (dbVal != null && !dbVal.isBlank()) {
        try {
            return Integer.parseInt(dbVal.trim());
        } catch (NumberFormatException e) {
            log.warn("DB 配置格式非法: {}={}, 使用 yaml 值", key, dbVal);
        }
    }
    return yamlDefault;
}
```

## Extending to New Config Keys

1. Add a `KEY_XXX` constant
2. Add a `getXxx()` method following the DB > YAML > default pattern
3. Add to `updateLlmConfig()` if writable
4. Add to the read/write API if needed

No restart required — changes take effect on next read.

## Key Design Decisions

1. **DB as override, not replacement**: YAML remains the baseline; DB only overrides when set
2. **Blank vs null**: Blank string treated as "not set" on read; on write, blank string means "clear DB value"
3. **No caching in memory**: Every read queries DB directly — ensures immediate effect after update
4. **Upsert pattern**: `findById().orElse(new())` then set all fields — handles both insert and update
5. **Sensitive masking**: Keys containing "key" or "token" are masked in logs and never returned in plaintext
