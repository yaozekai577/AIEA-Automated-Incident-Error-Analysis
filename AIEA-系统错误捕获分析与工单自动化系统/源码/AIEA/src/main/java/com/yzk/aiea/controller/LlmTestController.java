package com.yzk.aiea.controller;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.http.HttpStatusCode;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;

import com.yzk.aiea.integration.FeishuClient;
import com.yzk.aiea.service.SystemConfigService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/**
 * 大模型连通性测试接口
 * <p>
 * 用于验证大模型 API 是否内网可达，发送一条 "你好" 消息并返回模型回复。
 */
@RestController
@RequestMapping("/api/test")
@Tag(name = "LLM 测试", description = "大模型 API 连通性与飞书推送测试")
public class LlmTestController {

    private static final Logger log = LoggerFactory.getLogger(LlmTestController.class);

    private final RestTemplate llmRestTemplate;
    private final SystemConfigService configService;
    private final FeishuClient feishuClient;

    public LlmTestController(@Qualifier("llmRestTemplate") RestTemplate llmRestTemplate,
                             SystemConfigService configService,
                             FeishuClient feishuClient) {
        this.llmRestTemplate = llmRestTemplate;
        this.configService = configService;
        this.feishuClient = feishuClient;
    }

    /**
     * 向大模型发送 "你好"，测试 API 连通性
     * <p>
     * GET /api/test/llm
     *
     * @return 包含成功状态、模型回复、原始响应的 JSON
     */
    @GetMapping("/llm")
    @Operation(summary = "大模型连通性测试", description = "发送「你好」给大模型，返回回复内容")
    @SuppressWarnings("unchecked")
    public Map<String, Object> testLlm() {
        Map<String, Object> result = new HashMap<>();
        result.put("success", false);
        result.put("baseUrl", configService.getLlmBaseUrl());
        result.put("model", configService.getLlmModel());

        try {
            // 1. 构造 OpenAI 兼容格式的请求体
            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("model", configService.getLlmModel());
            requestBody.put("messages", List.of(
                    Map.of("role", "user", "content", "你好")
            ));

            // 2. 设置请求头 (Bearer Token 认证)
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(configService.getLlmApiKey());

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

            // 3. 发送请求
            String url = configService.getLlmBaseUrl() + "/chat/completions";
            log.info("测试大模型 API 连通性: URL={}, model={}", url, configService.getLlmModel());

            ResponseEntity<Map<String, Object>> response = llmRestTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    entity,
                    new ParameterizedTypeReference<Map<String, Object>>() {}
            );

            result.put("httpStatus", response.getStatusCode().value());

            // 4. 解析响应
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Map<String, Object> body = response.getBody();
                result.put("success", true);

                // 提取模型回复内容
                List<Map<String, Object>> choices = (List<Map<String, Object>>) body.get("choices");
                if (choices != null && !choices.isEmpty()) {
                    Map<String, Object> message = (Map<String, Object>) choices.get(0).get("message");
                    if (message != null) {
                        result.put("reply", message.get("content"));
                    }
                }

                result.put("usage", body.get("usage"));
                result.put("rawResponse", body);

                // 5. LLM 调用成功后，将关键信息推送到飞书群
                if (result.containsKey("reply")) {
                    String replyText = String.valueOf(result.get("reply"));
                    Map<String, Object> usage = (Map<String, Object>) body.get("usage");
                    String cardContent = buildFeishuCardContent(
                            configService.getLlmModel(),
                            replyText,
                            usage,
                            response.getStatusCode().value()
                    );
                    Map<String, Object> notifyResult = feishuClient.sendCard(
                            "🤖 大模型连通性测试", cardContent);
                    result.put("notify", notifyResult);
                }
            } else {
                result.put("error", "HTTP " + response.getStatusCode());
                result.put("rawResponse", response.getBody());
            }

        } catch (HttpStatusCodeException e) {
            // 捕获 HTTP 错误（4xx/5xx），提取 API 返回的错误信息
            HttpStatusCode status = e.getStatusCode();
            String errorBody = e.getResponseBodyAsString();
            log.error("大模型 API 返回错误: HTTP {}, Body={}", status.value(), errorBody);
            result.put("success", false);
            result.put("httpStatus", status.value());
            result.put("error", e.getStatusText());
            result.put("errorBody", errorBody);
        } catch (Exception e) {
            log.error("大模型 API 调用失败", e);
            result.put("success", false);
            result.put("error", e.getClass().getSimpleName() + ": " + e.getMessage());
        }

        return result;
    }

    /**
     * 单独测试飞书机器人 Webhook 连通性
     * <p>
     * GET /api/test/feishu
     *
     * @return 飞书推送结果
     */
    @GetMapping("/feishu")
    @Operation(summary = "飞书机器人连通性测试", description = "发送一条测试消息到飞书群")
    public Map<String, Object> testFeishu() {
        return feishuClient.sendText("🔔 飞书机器人连通性测试: 消息推送正常");
    }

    /**
     * 构造飞书卡片正文内容 (lark_md 格式)
     */
    private String buildFeishuCardContent(String model, String reply,
                                          Map<String, Object> usage, int httpStatus) {
        StringBuilder sb = new StringBuilder();
        sb.append("**模型**: ").append(model).append("\n");
        sb.append("**HTTP状态**: ").append(httpStatus).append("\n");
        sb.append("**回复**: ").append(reply).append("\n");
        if (usage != null) {
            sb.append("**Token使用**: ").append(usage.get("total_tokens"))
              .append(" (输入: ").append(usage.get("prompt_tokens"))
              .append(", 输出: ").append(usage.get("completion_tokens")).append(")");
        }
        return sb.toString();
    }
}
