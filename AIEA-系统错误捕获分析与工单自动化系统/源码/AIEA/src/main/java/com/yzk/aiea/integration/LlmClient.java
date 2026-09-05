package com.yzk.aiea.integration;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

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

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yzk.aiea.service.SystemConfigService;

/**
 * OpenAI 兼容协议大模型客户端
 */
@Component
public class LlmClient {

    private static final Logger log = LoggerFactory.getLogger(LlmClient.class);

    private final RestTemplate restTemplate;
    private final SystemConfigService configService;
    private final ObjectMapper objectMapper;

    public LlmClient(@Qualifier("llmRestTemplate") RestTemplate restTemplate,
                     SystemConfigService configService,
                     ObjectMapper objectMapper) {
        this.restTemplate = restTemplate;
        this.configService = configService;
        this.objectMapper = objectMapper;
    }

    /**
     * 调用 chat/completions，返回助手文本内容
     */
    public Optional<String> chat(String systemPrompt, String userPrompt) {
        try {
            Map<String, Object> body = new HashMap<>();
            body.put("model", configService.getLlmModel());
            body.put("temperature", 0.2);
            body.put("messages", List.of(
                    Map.of("role", "system", "content", systemPrompt),
                    Map.of("role", "user", "content", userPrompt)
            ));

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(configService.getLlmApiKey());

            String url = trimSlash(configService.getLlmBaseUrl()) + "/chat/completions";
            log.info("调用 LLM: model={}, url={}", configService.getLlmModel(), url);

            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    new HttpEntity<>(body, headers),
                    new ParameterizedTypeReference<>() {}
            );

            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                log.warn("LLM 响应异常: status={}", response.getStatusCode());
                return Optional.empty();
            }

            Object choicesObj = response.getBody().get("choices");
            if (!(choicesObj instanceof List<?> choices) || choices.isEmpty()) {
                return Optional.empty();
            }
            Object first = choices.get(0);
            if (!(first instanceof Map<?, ?> choice)) {
                return Optional.empty();
            }
            Object message = choice.get("message");
            if (!(message instanceof Map<?, ?> msg)) {
                return Optional.empty();
            }
            Object content = msg.get("content");
            return content == null ? Optional.empty() : Optional.of(String.valueOf(content));
        } catch (Exception e) {
            log.error("LLM 调用失败: {}", e.getMessage(), e);
            return Optional.empty();
        }
    }

    public JsonNode parseJsonContent(String content) {
        try {
            String json = extractJson(content);
            return objectMapper.readTree(json);
        } catch (Exception e) {
            log.warn("解析 LLM JSON 失败: {}", e.getMessage());
            return null;
        }
    }

    private String extractJson(String content) {
        String trimmed = content.trim();
        if (trimmed.startsWith("```")) {
            int firstNl = trimmed.indexOf('\n');
            int lastFence = trimmed.lastIndexOf("```");
            if (firstNl > 0 && lastFence > firstNl) {
                trimmed = trimmed.substring(firstNl + 1, lastFence).trim();
            }
        }
        int start = trimmed.indexOf('{');
        int end = trimmed.lastIndexOf('}');
        if (start >= 0 && end > start) {
            return trimmed.substring(start, end + 1);
        }
        return trimmed;
    }

    private String trimSlash(String url) {
        if (url == null) {
            return "";
        }
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }

    public String getModel() {
        return configService.getLlmModel();
    }
}
