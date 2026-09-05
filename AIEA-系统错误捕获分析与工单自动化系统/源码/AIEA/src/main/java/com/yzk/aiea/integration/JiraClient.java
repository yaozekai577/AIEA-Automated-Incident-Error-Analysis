package com.yzk.aiea.integration;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;

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
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestTemplate;

import com.yzk.aiea.config.JiraProperties;

/**
 * Jira REST API 客户端（最小字段建单）
 */
@Component
public class JiraClient {

    private static final Logger log = LoggerFactory.getLogger(JiraClient.class);
    private static final AtomicLong MOCK_SEQ = new AtomicLong(System.currentTimeMillis() / 1000);

    private final RestTemplate restTemplate;
    private final JiraProperties properties;

    public JiraClient(@Qualifier("llmRestTemplate") RestTemplate restTemplate,
                      JiraProperties properties) {
        this.restTemplate = restTemplate;
        this.properties = properties;
    }

    public boolean isConfigured() {
        return StringUtils.hasText(properties.getBaseUrl())
                && StringUtils.hasText(properties.getEmail())
                && StringUtils.hasText(properties.getApiToken())
                && StringUtils.hasText(properties.getProjectKey());
    }

    /**
     * 创建 Issue，返回 jiraKey / url / project / mock
     */
    public Map<String, Object> createIssue(String summary, String description, List<String> labels) {
        Map<String, Object> result = new HashMap<>();
        result.put("success", false);

        if (!properties.isEnabled()) {
            result.put("skipped", true);
            result.put("reason", "jira.enabled=false");
            return result;
        }

        if (!isConfigured()) {
            if (properties.isMockWhenUnconfigured()) {
                String key = properties.getProjectKey() + "-" + MOCK_SEQ.incrementAndGet();
                result.put("success", true);
                result.put("mock", true);
                result.put("jiraKey", key);
                result.put("project", properties.getProjectKey());
                result.put("url", "https://jira.mock.local/browse/" + key);
                log.warn("Jira 未配置，使用 Mock Issue: {}", key);
                return result;
            }
            result.put("error", "Jira 未配置");
            return result;
        }

        try {
            Map<String, Object> fields = new HashMap<>();
            fields.put("project", Map.of("key", properties.getProjectKey()));
            fields.put("summary", truncate(summary, 255));
            fields.put("description", description == null ? "" : description);
            fields.put("issuetype", Map.of("name", properties.getIssueType()));
            if (labels != null && !labels.isEmpty()) {
                fields.put("labels", labels);
            }

            Map<String, Object> body = Map.of("fields", fields);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set(HttpHeaders.AUTHORIZATION, basicAuth(properties.getEmail(), properties.getApiToken()));

            String url = trimSlash(properties.getBaseUrl()) + "/rest/api/2/issue";
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    new HttpEntity<>(body, headers),
                    new ParameterizedTypeReference<>() {}
            );

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                String key = String.valueOf(response.getBody().get("key"));
                result.put("success", true);
                result.put("jiraKey", key);
                result.put("project", properties.getProjectKey());
                result.put("url", trimSlash(properties.getBaseUrl()) + "/browse/" + key);
                result.put("raw", response.getBody());
            } else {
                result.put("error", "HTTP " + response.getStatusCode());
            }
        } catch (Exception e) {
            log.error("创建 Jira Issue 失败: {}", e.getMessage(), e);
            result.put("error", e.getMessage());
            if (properties.isMockWhenUnconfigured()) {
                String key = properties.getProjectKey() + "-F" + MOCK_SEQ.incrementAndGet();
                result.put("success", true);
                result.put("mock", true);
                result.put("jiraKey", key);
                result.put("project", properties.getProjectKey());
                result.put("url", "https://jira.mock.local/browse/" + key);
                result.put("fallback", true);
                log.warn("Jira 调用失败，降级 Mock: {}", key);
            }
        }
        return result;
    }

    private String basicAuth(String email, String token) {
        String raw = email + ":" + token;
        return "Basic " + Base64.getEncoder().encodeToString(raw.getBytes(StandardCharsets.UTF_8));
    }

    private String trimSlash(String url) {
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }

    private String truncate(String s, int max) {
        if (s == null) {
            return "";
        }
        return s.length() <= max ? s : s.substring(0, max);
    }
}
