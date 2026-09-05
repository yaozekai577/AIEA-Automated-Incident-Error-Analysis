---
name: im-webhook-routing
description: Build Feishu and DingTalk webhook clients with service-level routing engine, retry mechanism, and audit logging. Use when integrating IM bot notifications (Feishu/DingTalk) into Java Spring Boot applications, designing multi-recipient message routing, or building notification systems with per-service webhook configuration.
---

# IM Webhook Client & Routing Engine

## Architecture

```
通知请求 (event, analysis, ticket)
    │
    ▼
查询 notify_routing 表
  findByServiceAndChannel(service, channel)
    │
    ├─ 匹配到且 enabled=true 且 webhookUrl 非空
    │   → 使用专属 Webhook
    │
    └─ 未匹配 / 已禁用 / webhookUrl 为空
        → fallback 到全局 Webhook (application.yaml)
           feishu  → feishu.webhook-url
           dingtalk → dingtalk.webhook-url
    │
    ▼
推送消息 (带重试, 最多 3 次)
    │
    ▼
记录 notify_record (审计追溯)
```

## Database Schema

```sql
-- 通知路由规则表
CREATE TABLE notify_routing (
    id          BIGINT NOT NULL AUTO_INCREMENT,
    service     VARCHAR(128) NOT NULL COMMENT '业务服务名',
    channel     VARCHAR(32)  NOT NULL DEFAULT 'feishu' COMMENT 'feishu/dingtalk',
    webhook_url VARCHAR(512) NOT NULL COMMENT 'IM 机器人 Webhook 地址',
    description VARCHAR(255) NULL,
    enabled     TINYINT(1)   NOT NULL DEFAULT 1,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_service_channel (service, channel)  -- 同服务同渠道仅一条
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 通知推送记录表
CREATE TABLE notify_record (
    id          BIGINT NOT NULL AUTO_INCREMENT,
    event_id    BIGINT NOT NULL,
    channel     VARCHAR(32) NULL COMMENT 'feishu/dingtalk',
    payload     TEXT NULL COMMENT '推送报文',
    http_status INT NULL COMMENT '推送 HTTP 状态码',
    sent_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_event_id (event_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

## YAML Configuration

```yaml
feishu:
  webhook-url: https://open.feishu.cn/open-apis/bot/v2/hook/xxx  # 全局默认

dingtalk:
  webhook-url:    # 可选，留空则不推送钉钉

pipeline:
  notify-channel: feishu       # feishu / dingtalk / none
  notify-enabled: true
  notify-max-retries: 3        # 失败重试次数
  detail-base-url: http://localhost:8080  # 详情链接前缀
```

## Feishu Client

Send interactive cards with `lark_md` syntax:

```java
@Component
public class FeishuClient {

    private final RestTemplate restTemplate;
    private final FeishuProperties properties;

    /**
     * Send interactive card to specified webhook
     */
    public Map<String, Object> sendCard(String title, String content, String webhookUrl) {
        Map<String, Object> card = new HashMap<>();

        // Card header
        Map<String, Object> header = new HashMap<>();
        Map<String, Object> headerTitle = Map.of("tag", "plain_text", "content", title);
        header.put("title", headerTitle);
        header.put("template", "green");  // 绿色头部
        card.put("header", header);

        // Card body (supports lark_md)
        Map<String, Object> element = new HashMap<>();
        element.put("tag", "div");
        element.put("text", Map.of("tag", "lark_md", "content", content));
        card.put("elements", List.of(element));

        Map<String, Object> requestBody = Map.of(
            "msg_type", "interactive",
            "card", card
        );

        return send(requestBody, webhookUrl);
    }

    private Map<String, Object> send(Map<String, Object> body, String webhookUrl) {
        Map<String, Object> result = new HashMap<>();
        result.put("success", false);

        if (webhookUrl == null || webhookUrl.isBlank()) {
            result.put("error", "飞书 webhook-url 未配置");
            return result;
        }

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);

            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                webhookUrl, HttpMethod.POST, entity,
                new ParameterizedTypeReference<>() {}
            );

            result.put("httpStatus", response.getStatusCode().value());

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                // 飞书返回 code=0 表示成功
                int code = (Integer) response.getBody().getOrDefault("code", -1);
                result.put("success", code == 0);
                result.put("feishuCode", code);
                result.put("feishuMsg", response.getBody().get("msg"));
            } else {
                result.put("error", "HTTP " + response.getStatusCode());
            }
        } catch (HttpStatusCodeException e) {
            result.put("httpStatus", e.getStatusCode().value());
            result.put("error", e.getStatusText());
        } catch (Exception e) {
            result.put("error", e.getClass().getSimpleName() + ": " + e.getMessage());
        }

        return result;
    }
}
```

## DingTalk Client

Send Markdown messages:

```java
@Component
public class DingTalkClient {

    private final RestTemplate restTemplate;
    private final DingTalkProperties properties;

    public Map<String, Object> sendMarkdown(String title, String text, String webhookUrl) {
        Map<String, Object> result = new HashMap<>();
        result.put("success", false);

        if (webhookUrl == null || webhookUrl.isBlank()) {
            result.put("skipped", true);
            result.put("error", "钉钉 webhook-url 未配置");
            return result;
        }

        try {
            Map<String, Object> body = Map.of(
                "msgtype", "markdown",
                "markdown", Map.of("title", title, "text", text)
            );

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                webhookUrl, HttpMethod.POST,
                new HttpEntity<>(body, headers),
                new ParameterizedTypeReference<>() {}
            );

            result.put("httpStatus", response.getStatusCode().value());
            if (response.getBody() != null) {
                Object errcode = response.getBody().get("errcode");
                // errcode=0 或 null 表示成功
                boolean ok = errcode == null || Integer.valueOf(0).equals(errcode)
                        || "0".equals(String.valueOf(errcode));
                result.put("success", ok);
            }
        } catch (Exception e) {
            result.put("error", e.getMessage());
        }

        return result;
    }
}
```

## Notify Service (Routing + Retry + Audit)

```java
@Service
public class NotifyService {

    private final FeishuClient feishuClient;
    private final DingTalkClient dingTalkClient;
    private final NotifyRoutingRepository routingRepository;
    private final NotifyRecordRepository recordRepository;
    private final PipelineProperties pipelineProperties;
    private final FeishuProperties feishuProperties;
    private final DingTalkProperties dingTalkProperties;
    private final ObjectMapper objectMapper;

    @Transactional
    public boolean notify(ErrorEvent event, AnalysisResult analysis,
                          JiraTicket ticket, int mergedHits) {
        // 0. Check if notification is enabled
        if (!pipelineProperties.isNotifyEnabled()
                || "none".equalsIgnoreCase(pipelineProperties.getNotifyChannel())) {
            return true;  // 通知关闭视为成功
        }

        String channel = pipelineProperties.getNotifyChannel();  // feishu / dingtalk
        String content = buildContent(event, analysis, ticket, mergedHits);
        String title = "AIEA 错误根因分析";

        // 1. Route resolution: service+channel → webhook (fallback to global)
        String globalWebhook = "dingtalk".equalsIgnoreCase(channel)
                ? dingTalkProperties.getWebhookUrl()
                : feishuProperties.getWebhookUrl();

        String webhookUrl = globalWebhook;
        String routeSource = "global";

        NotifyRouting routing = routingRepository
                .findByServiceAndChannel(event.getService(), channel)
                .orElse(null);

        if (routing != null && Boolean.TRUE.equals(routing.getEnabled())
                && routing.getWebhookUrl() != null && !routing.getWebhookUrl().isBlank()) {
            webhookUrl = routing.getWebhookUrl();
            routeSource = "service:" + routing.getService() + ",channel:" + routing.getChannel();
        }

        // 2. Send with retry
        final String finalUrl = webhookUrl;
        Map<String, Object> result = Map.of("success", false);
        int maxRetries = Math.max(1, pipelineProperties.getNotifyMaxRetries());

        for (int i = 1; i <= maxRetries; i++) {
            result = "dingtalk".equalsIgnoreCase(channel)
                    ? dingTalkClient.sendMarkdown(title, content, finalUrl)
                    : feishuClient.sendCard(title, content, finalUrl);
            if (Boolean.TRUE.equals(result.get("success"))) break;
            log.warn("通知失败 attempt={}/{}: {}", i, maxRetries, result.get("error"));
        }

        // 3. Audit: record to notify_record table
        NotifyRecord record = new NotifyRecord();
        record.setEventId(event.getId());
        record.setChannel(channel);
        record.setHttpStatus(result.get("httpStatus") instanceof Integer i ? i : null);
        record.setSentAt(LocalDateTime.now());
        // Store payload (truncate webhookUrl to 80 chars for security)
        record.setPayload(serializePayload(title, content, routeSource, finalUrl, result));
        recordRepository.save(record);

        return Boolean.TRUE.equals(result.get("success"));
    }
}
```

## Message Content Template

Markdown format for both Feishu (`lark_md`) and DingTalk:

```java
private String buildContent(ErrorEvent event, AnalysisResult analysis,
                            JiraTicket ticket, int mergedHits) {
    StringBuilder sb = new StringBuilder();
    sb.append("**环境**: ").append(event.getEnv()).append("\n");
    sb.append("**服务**: ").append(event.getService()).append("\n");
    sb.append("**摘要**: ").append(sanitize(event.getMessage())).append("\n");
    if (mergedHits > 0) {
        sb.append("**合并次数**: ").append(mergedHits).append("\n");
    }
    if (analysis != null) {
        sb.append("**根因(AI)**: ").append(analysis.getRootCause()).append("\n");
        sb.append("**建议**: ").append(analysis.getSuggestions()).append("\n");
        sb.append("**置信度**: ").append(analysis.getConfidence())
          .append("（AI 建议，需人工确认）\n");
    }
    if (ticket != null) {
        sb.append("**Jira**: [").append(ticket.getJiraKey()).append("](")
          .append(ticket.getUrl()).append(")\n");
    }
    sb.append("**详情**: ").append(pipelineProperties.getDetailBaseUrl())
      .append("/api/v1/errors/").append(event.getId()).append("\n");
    return sb.toString();
}
```

## Routing Rules Management API

```java
@RestController
@RequestMapping("/api/v1/notify-routing")
public class NotifyRoutingController {

    @GetMapping
    List<NotifyRouting> list() { return repository.findAll(); }

    @PostMapping
    NotifyRouting create(@RequestBody NotifyRouting body) {
        return repository.save(body);  // uk_service_channel 防重
    }

    @PutMapping("/{id}")
    NotifyRouting update(@PathVariable Long id, @RequestBody NotifyRouting body) { ... }

    @DeleteMapping("/{id}")
    void delete(@PathVariable Long id) { ... }

    @PostMapping("/{id}/test")
    Map<String, Object> test(@PathVariable Long id) {
        NotifyRouting route = repository.findById(id).orElseThrow();
        // Send a test message to this route's webhook
        return feishuClient.sendCard("测试", "连通性测试", route.getWebhookUrl());
    }
}
```

## Typical Routing Scenarios

```
order-service   + feishu    → 订单团队飞书群 Webhook A
payment-service + feishu    → 支付团队飞书群 Webhook B
order-service   + dingtalk   → 订单团队钉钉群 Webhook C
其他未配置的服务             → 全局飞书 Webhook (yaml 配置)
```

## Key Design Decisions

1. **Global fallback**: Unmatched routes always fall back to YAML-configured global webhook — no message is lost
2. **Unique constraint `(service, channel)`**: Same service + same channel can only have one route
3. **Webhook URL truncation in audit**: Stored payload truncates webhook URL to 80 chars for security
4. **Retry on failure**: Configurable max retries (default 3), stops on first success
5. **`none` channel**: Setting `notify-channel: none` disables all notifications without code changes
6. **Feishu success = `code==0`**: Feishu returns HTTP 200 even on failure; must check `code` field
7. **DingTalk success = `errcode==0`**: Same pattern; `errcode` null also means success
