---
name: llm-client-three-tier-cache
description: Build an OpenAI-compatible LLM client with three-tier caching (DB dedup, Redis fingerprint cache, real-time LLM call) and automatic fallback degradation. Use when integrating LLM (OpenAI/DashScope/DeepSeek/Zhipu) into Java Spring Boot applications, designing AI analysis pipelines, or building LLM clients with token-saving caching strategies.
---

# LLM Client with Three-Tier Cache & Fallback

## Architecture

```
分析请求 (key = fingerprint)
    │
    ▼
Level 1: DB 去重 — 同一 eventId 已分析过？→ 直接返回
    │ miss
    ▼
Level 2: Redis 缓存 — 同指纹 TTL 窗口内？→ 复用结果（节省 Token）
    │ miss
    ▼
Level 3: LLM 实时调用 — POST /chat/completions
    │
    ├─ 成功 → 解析 JSON → 落库 + 写 Redis 缓存
    └─ 失败/超时/格式异常 → 降级摘要模板 → 落库 + 写缓存
```

## Core Components

### 1. LLM HTTP Client

Call OpenAI-compatible `/chat/completions` endpoint. Works with any provider supporting this protocol.

```java
@Component
public class LlmClient {

    private final RestTemplate restTemplate;  // 带超时配置
    private final SystemConfigService configService;  // 动态读取 base-url/api-key/model

    /**
     * @return Optional.empty() 表示调用失败
     */
    public Optional<String> chat(String systemPrompt, String userPrompt) {
        try {
            Map<String, Object> body = Map.of(
                "model", configService.getLlmModel(),
                "temperature", 0.2,  // 低温度 = 确定性输出
                "messages", List.of(
                    Map.of("role", "system", "content", systemPrompt),
                    Map.of("role", "user", "content", userPrompt)
                )
            );

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(configService.getLlmApiKey());

            String url = trimSlash(configService.getLlmBaseUrl()) + "/chat/completions";

            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                url, HttpMethod.POST,
                new HttpEntity<>(body, headers),
                new ParameterizedTypeReference<>() {}
            );

            // 解析: choices[0].message.content
            return extractContent(response.getBody());
        } catch (Exception e) {
            log.error("LLM 调用失败: {}", e.getMessage());
            return Optional.empty();
        }
    }
}
```

**RestTemplate 超时配置**:

```java
@Bean
public RestTemplate llmRestTemplate(LlmProperties props) {
    SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
    factory.setConnectTimeout(props.getTimeout());  // 默认 30000ms
    factory.setReadTimeout(props.getTimeout());
    return new RestTemplate(factory);
}
```

### 2. Redis 指纹缓存

```java
@Service
public class LlmAnalysisCacheService {

    private static final String PREFIX = "llm:cache:";
    private final StringRedisTemplate redis;
    private final ObjectMapper mapper;

    /**
     * 从缓存获取（TTL > 0 时才查）
     * Redis 不可用 → 返回 null（降级为不缓存）
     */
    public AnalysisResult get(String fingerprint, int ttlSeconds) {
        if (ttlSeconds <= 0) return null;
        try {
            String json = redis.opsForValue().get(PREFIX + fingerprint);
            if (json == null || json.isBlank()) return null;
            return mapper.readValue(json, AnalysisResult.class);
        } catch (Exception e) {
            log.warn("缓存读取失败，降级: {}", e.getMessage());
            return null;  // fail-open
        }
    }

    /**
     * 写入缓存（清除 eventId 避免混淆）
     * Redis 不可用 → 静默跳过
     */
    public void put(String fingerprint, AnalysisResult result, int ttlSeconds) {
        if (ttlSeconds <= 0 || result == null) return;
        try {
            AnalysisResult copy = cloneWithoutId(result);  // 不缓存 eventId
            String json = mapper.writeValueAsString(copy);
            redis.opsForValue().set(PREFIX + fingerprint, json, Duration.ofSeconds(ttlSeconds));
        } catch (Exception e) {
            log.warn("缓存写入失败，降级: {}", e.getMessage());
        }
    }
}
```

### 3. 分析服务（编排三级缓存 + 降级）

```java
@Service
public class AnalyzeService {

    public AnalysisResult analyze(ErrorEvent event) {
        String fingerprint = event.getFingerprint();

        // Level 1: DB 去重
        Optional<AnalysisResult> existing = repo.findByEventId(event.getId());
        if (existing.isPresent()) return existing.get();

        // Level 2: Redis 缓存
        int ttl = configService.getLlmAnalysisCacheTtl();  // 0 = 不缓存
        AnalysisResult cached = cacheService.get(fingerprint, ttl);
        if (cached != null) {
            cached.setEventId(event.getId());
            return repo.save(cached);  // 落库关联当前事件
        }

        // Level 3: LLM 调用
        String userPrompt = buildPrompt(event);
        Optional<String> raw = llmClient.chat(SYSTEM_PROMPT, userPrompt);

        AnalysisResult result = new AnalysisResult();
        result.setEventId(event.getId());
        result.setModel(llmClient.getModel());

        if (raw.isEmpty()) {
            fillFallback(result, event, "LLM 调用失败或超时");
        } else {
            JsonNode node = llmClient.parseJsonContent(raw.get());
            if (node == null) {
                // 重试一次
                Optional<String> retry = llmClient.chat(SYSTEM_PROMPT,
                    userPrompt + "\n\n上一次输出无法解析为 JSON，请只输出合法 JSON。");
                if (retry.isPresent()) node = llmClient.parseJsonContent(retry.get());
            }
            if (node == null) {
                fillFallback(result, event, "LLM 返回无法解析");
            } else {
                result.setRootCause(text(node, "root_cause"));
                result.setSuggestions(toJsonArray(node.get("suggestions")));
                result.setConfidence(parseConfidence(node.get("confidence")));
                if (result.getRootCause() == null || result.getRootCause().isBlank()) {
                    fillFallback(result, event, "LLM 未给出根因");
                }
            }
        }

        AnalysisResult saved = repo.save(result);
        cacheService.put(fingerprint, saved, ttl);
        return saved;
    }
}
```

## System Prompt Design

```
你是资深 Java 线上故障排查专家。请仅基于用户提供的异常信息做根因分析。
若信息不足，明确写出不确定点与建议补充的排查项。
禁止虚构不存在的类/方法。不要给出删库、关闭鉴权等高危操作。
必须只输出一个 JSON 对象，字段如下：
{
  "root_cause": "根因说明",
  "impact": "影响面",
  "suggestions": ["修复建议1", "修复建议2", "修复建议3"],
  "related_files": ["可能相关文件或类"],
  "confidence": 0.0,
  "need_more_info": ["如需补充的信息"]
}
confidence 取值 0~1。
```

**Safety constraints**: 禁止虚构类/方法、禁止高危操作建议、必须输出 JSON、信息不足时声明不确定。

## Fallback Degradation Template

When LLM fails, returns timeout, or returns unparseable output:

```java
private void fillFallback(AnalysisResult result, ErrorEvent event, String reason) {
    result.setRootCause(reason + " 异常摘要: " + nullToEmpty(event.getMessage()));
    result.setSuggestions("""
        ["核对近期发布与配置变更",
         "根据堆栈定位首个业务包帧并加日志复现",
         "检查依赖服务/DB/缓存可用性"]""");
    result.setConfidence(new BigDecimal("0.2000"));  // 低置信度
    if (result.getRawResponse() == null) result.setRawResponse(reason);
}
```

## JSON Response Parser

LLM output may contain markdown code blocks or extra text. Extract JSON robustly:

```java
public JsonNode parseJsonContent(String content) {
    String trimmed = content.trim();
    // 去除 ``` 代码块标记
    if (trimmed.startsWith("```")) {
        int firstNl = trimmed.indexOf('\n');
        int lastFence = trimmed.lastIndexOf("```");
        if (firstNl > 0 && lastFence > firstNl) {
            trimmed = trimmed.substring(firstNl + 1, lastFence).trim();
        }
    }
    // 提取 { ... } JSON 部分
    int start = trimmed.indexOf('{');
    int end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
        return objectMapper.readTree(trimmed.substring(start, end + 1));
    }
    return null;
}
```

## Supported LLM Providers

| Provider | Base URL | Model Example |
|----------|----------|---------------|
| 阿里云百炼/DashScope | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-plus` |
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` |
| OpenAI | `https://api.openai.com/v1` | `gpt-4o` |
| 智谱 AI | `https://open.bigmodel.cn/api/paas/v4` | `glm-4` |

Switching providers only requires changing `base-url` / `api-key` / `model` config — no code changes.

## Degradation Matrix

| Failure | Strategy | Impact |
|---------|----------|--------|
| LLM timeout/unreachable | Fallback to rule-based summary | Quality lower, main flow continues |
| LLM returns non-JSON | Retry once → fallback summary | Same as above |
| Redis cache miss/unavailable | Call LLM directly | Higher token cost |
| DB write failure | Not caught (should not happen) | — |

## Configuration

```yaml
llm:
  base-url: https://dashscope.aliyuncs.com/compatible-mode/v1
  api-key: sk-xxx
  model: qwen-plus
  timeout: 30000              # ms
  analysis-cache-ttl: 3600    # seconds, 0=disabled
```

## Key Design Decisions

1. **`temperature=0.2`**: Low temperature for deterministic, reproducible analysis output
2. **Cache without eventId**: Redis caches analysis by fingerprint only; eventId is set per-event on cache hit
3. **Retry once on parse failure**: Append "请只输出合法 JSON" prompt, then parse again
4. **Confidence clamping**: Parse to BigDecimal, clamp to [0, 1], scale to 4 decimal places
5. **Fail-open on Redis**: All Redis operations wrapped in try-catch, degrade silently
