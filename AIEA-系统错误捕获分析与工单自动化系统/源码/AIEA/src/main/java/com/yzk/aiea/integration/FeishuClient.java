package com.yzk.aiea.integration;

import java.util.HashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;

import com.yzk.aiea.config.FeishuProperties;

/**
 * 飞书自定义机器人 Webhook 客户端
 * <p>
 * 封装了向飞书群聊发送消息的能力，支持文本消息和交互卡片。
 */
@Component
public class FeishuClient {

    private static final Logger log = LoggerFactory.getLogger(FeishuClient.class);

    private final RestTemplate restTemplate;
    private final FeishuProperties feishuProperties;

    public FeishuClient(@Qualifier("llmRestTemplate") RestTemplate restTemplate,
                        FeishuProperties feishuProperties) {
        this.restTemplate = restTemplate;
        this.feishuProperties = feishuProperties;
    }

    /**
     * 发送文本消息到默认飞书群（全局 webhook）
     *
     * @param text 文本内容
     * @return 包含推送结果的 Map (success, httpStatus, error 等)
     */
    public Map<String, Object> sendText(String text) {
        return sendText(text, feishuProperties.getWebhookUrl());
    }

    /**
     * 发送文本消息到指定飞书群（自定义 webhook）
     *
     * @param text       文本内容
     * @param webhookUrl 目标飞书机器人 Webhook 地址
     * @return 包含推送结果的 Map
     */
    public Map<String, Object> sendText(String text, String webhookUrl) {
        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("msg_type", "text");
        requestBody.put("content", Map.of("text", text));
        return send(requestBody, webhookUrl);
    }

    /**
     * 发送交互卡片到默认飞书群（全局 webhook）
     *
     * @param title   卡片标题
     * @param content 卡片正文 (支持 lark_md 语法)
     * @return 包含推送结果的 Map
     */
    public Map<String, Object> sendCard(String title, String content) {
        return sendCard(title, content, feishuProperties.getWebhookUrl());
    }

    /**
     * 发送交互卡片到指定飞书群（自定义 webhook）
     *
     * @param title      卡片标题
     * @param content    卡片正文 (支持 lark_md 语法)
     * @param webhookUrl 目标飞书机器人 Webhook 地址
     * @return 包含推送结果的 Map
     */
    public Map<String, Object> sendCard(String title, String content, String webhookUrl) {
        Map<String, Object> card = new HashMap<>();

        // 卡片头部
        Map<String, Object> header = new HashMap<>();
        Map<String, Object> headerTitle = new HashMap<>();
        headerTitle.put("tag", "plain_text");
        headerTitle.put("content", title);
        header.put("title", headerTitle);
        header.put("template", "green");
        card.put("header", header);

        // 卡片正文
        Map<String, Object> element = new HashMap<>();
        element.put("tag", "div");
        Map<String, Object> elementText = new HashMap<>();
        elementText.put("tag", "lark_md");
        elementText.put("content", content);
        element.put("text", elementText);

        card.put("elements", java.util.List.of(element));

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("msg_type", "interactive");
        requestBody.put("card", card);

        return send(requestBody, webhookUrl);
    }

    /**
     * 发送请求到飞书 Webhook
     *
     * @param requestBody 飞书消息体
     * @param webhookUrl  目标 Webhook 地址
     */
    private Map<String, Object> send(Map<String, Object> requestBody, String webhookUrl) {
        Map<String, Object> result = new HashMap<>();
        result.put("success", false);
        result.put("webhookUrl", webhookUrl);

        if (webhookUrl == null || webhookUrl.isBlank()) {
            result.put("error", "飞书 webhook-url 未配置");
            return result;
        }

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

            log.info("发送飞书消息: msg_type={}, webhook={}", requestBody.get("msg_type"),
                    webhookUrl.length() > 60 ? webhookUrl.substring(0, 60) + "..." : webhookUrl);

            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    webhookUrl,
                    HttpMethod.POST,
                    entity,
                    new ParameterizedTypeReference<Map<String, Object>>() {}
            );

            result.put("httpStatus", response.getStatusCode().value());

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Map<String, Object> body = response.getBody();
                // 飞书返回 code=0 表示成功
                int code = body.get("code") instanceof Integer i ? i : -1;
                result.put("success", code == 0);
                result.put("feishuCode", code);
                result.put("feishuMsg", body.get("msg"));
                result.put("rawResponse", body);
            } else {
                result.put("error", "HTTP " + response.getStatusCode());
                result.put("rawResponse", response.getBody());
            }

        } catch (HttpStatusCodeException e) {
            log.error("飞书推送失败: HTTP {}", e.getStatusCode().value());
            result.put("httpStatus", e.getStatusCode().value());
            result.put("error", e.getStatusText());
            result.put("errorBody", e.getResponseBodyAsString());
        } catch (Exception e) {
            log.error("飞书推送异常", e);
            result.put("error", e.getClass().getSimpleName() + ": " + e.getMessage());
        }

        return result;
    }
}
