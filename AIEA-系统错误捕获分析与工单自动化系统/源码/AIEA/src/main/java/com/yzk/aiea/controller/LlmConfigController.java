package com.yzk.aiea.controller;

import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.yzk.aiea.service.SystemConfigService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/**
 * 大模型配置管理（前端可编辑）
 * <p>
 * 读取优先级：DB (system_config 表) > application.yaml。
 * API Key 永远不返回明文，只返回是否已配置。
 */
@RestController
@RequestMapping("/api/v1/llm-config")
@Tag(name = "LLM 配置", description = "大模型配置的前端读写（API Key 脱敏）")
public class LlmConfigController {

    private final SystemConfigService configService;

    public LlmConfigController(SystemConfigService configService) {
        this.configService = configService;
    }

    /**
     * 读取当前生效的 LLM 配置（API Key 脱敏）
     */
    @GetMapping
    @Operation(summary = "查看 LLM 配置", description = "返回当前生效的 LLM 配置，API Key 仅返回是否已配置")
    public Map<String, Object> get() {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("baseUrl", configService.getLlmBaseUrl());
        map.put("model", configService.getLlmModel());
        map.put("apiKeyConfigured", configService.isLlmApiKeyConfigured());
        map.put("analysisCacheTtl", configService.getLlmAnalysisCacheTtl());
        return map;
    }

    /**
     * 更新 LLM 配置
     * <p>
     * 所有字段可选，null/缺失=不修改，空字符串=清除（仅 apiKey 支持清除）。
     */
    @PutMapping
    @Operation(summary = "更新 LLM 配置", description = "修改 LLM 的 Base URL / API Key / 模型 / 缓存 TTL，立即生效")
    public Map<String, Object> update(@RequestBody Map<String, Object> body) {
        String baseUrl = body.containsKey("baseUrl") ? (String) body.get("baseUrl") : null;
        String apiKey = body.containsKey("apiKey") ? (String) body.get("apiKey") : null;
        String model = body.containsKey("model") ? (String) body.get("model") : null;
        Integer cacheTtl = null;
        if (body.containsKey("analysisCacheTtl") && body.get("analysisCacheTtl") != null) {
            cacheTtl = ((Number) body.get("analysisCacheTtl")).intValue();
            if (cacheTtl < 0 || cacheTtl > 86400) {
                throw new IllegalArgumentException("analysisCacheTtl 须在 0~86400 秒之间");
            }
        }

        configService.updateLlmConfig(baseUrl, apiKey, model, cacheTtl);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("updated", true);
        result.put("baseUrl", configService.getLlmBaseUrl());
        result.put("model", configService.getLlmModel());
        result.put("apiKeyConfigured", configService.isLlmApiKeyConfigured());
        result.put("analysisCacheTtl", configService.getLlmAnalysisCacheTtl());
        return result;
    }
}
