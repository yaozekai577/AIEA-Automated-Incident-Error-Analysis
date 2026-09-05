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
import org.springframework.web.client.RestTemplate;

import com.yzk.aiea.config.DingTalkProperties;

/**
 * 钉钉自定义机器人客户端
 */
@Component
public class DingTalkClient {

    private static final Logger log = LoggerFactory.getLogger(DingTalkClient.class);

    private final RestTemplate restTemplate;
    private final DingTalkProperties properties;

    public DingTalkClient(@Qualifier("llmRestTemplate") RestTemplate restTemplate,
                          DingTalkProperties properties) {
        this.restTemplate = restTemplate;
        this.properties = properties;
    }

    public Map<String, Object> sendMarkdown(String title, String text) {
        return sendMarkdown(title, text, properties.getWebhookUrl());
    }

    /**
     * 发送 Markdown 消息到指定钉钉群（自定义 webhook）
     *
     * @param title      消息标题
     * @param text       Markdown 正文
     * @param webhookUrl 目标钉钉机器人 Webhook 地址
     * @return 包含推送结果的 Map
     */
    public Map<String, Object> sendMarkdown(String title, String text, String webhookUrl) {
        Map<String, Object> result = new HashMap<>();
        result.put("success", false);

        if (webhookUrl == null || webhookUrl.isBlank()) {
            result.put("skipped", true);
            result.put("error", "钉钉 webhook-url 未配置");
            return result;
        }

        try {
            Map<String, Object> body = new HashMap<>();
            body.put("msgtype", "markdown");
            body.put("markdown", Map.of("title", title, "text", text));

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            log.info("发送钉钉消息: webhook={}",
                    webhookUrl.length() > 60 ? webhookUrl.substring(0, 60) + "..." : webhookUrl);

            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    webhookUrl,
                    HttpMethod.POST,
                    new HttpEntity<>(body, headers),
                    new ParameterizedTypeReference<>() {}
            );

            result.put("httpStatus", response.getStatusCode().value());
            if (response.getBody() != null) {
                Object errcode = response.getBody().get("errcode");
                boolean ok = errcode == null || Integer.valueOf(0).equals(errcode) || "0".equals(String.valueOf(errcode));
                result.put("success", ok);
                result.put("rawResponse", response.getBody());
            }
        } catch (Exception e) {
            log.error("钉钉推送失败: {}", e.getMessage(), e);
            result.put("error", e.getMessage());
        }
        return result;
    }
}
