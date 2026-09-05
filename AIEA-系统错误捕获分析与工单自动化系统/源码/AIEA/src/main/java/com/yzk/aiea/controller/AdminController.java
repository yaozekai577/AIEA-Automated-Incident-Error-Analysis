package com.yzk.aiea.controller;

import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.yzk.aiea.config.FeishuProperties;
import com.yzk.aiea.config.IngestProperties;
import com.yzk.aiea.config.JiraProperties;
import com.yzk.aiea.config.PipelineProperties;
import com.yzk.aiea.repository.NotifyRoutingRepository;
import com.yzk.aiea.repository.ServiceRegistryRepository;
import com.yzk.aiea.service.SystemConfigService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/**
 * 只读配置视图（脱敏），避免把密钥写进代码即可运维核对
 */
@RestController
@RequestMapping("/api/v1/admin")
@Tag(name = "管理配置", description = "查看当前生效配置（密钥脱敏）")
public class AdminController {

    private final IngestProperties ingestProperties;
    private final SystemConfigService configService;
    private final FeishuProperties feishuProperties;
    private final JiraProperties jiraProperties;
    private final PipelineProperties pipelineProperties;
    private final NotifyRoutingRepository notifyRoutingRepository;
    private final ServiceRegistryRepository serviceRegistryRepository;

    public AdminController(IngestProperties ingestProperties,
                           SystemConfigService configService,
                           FeishuProperties feishuProperties,
                           JiraProperties jiraProperties,
                           PipelineProperties pipelineProperties,
                           NotifyRoutingRepository notifyRoutingRepository,
                           ServiceRegistryRepository serviceRegistryRepository) {
        this.ingestProperties = ingestProperties;
        this.configService = configService;
        this.feishuProperties = feishuProperties;
        this.jiraProperties = jiraProperties;
        this.pipelineProperties = pipelineProperties;
        this.notifyRoutingRepository = notifyRoutingRepository;
        this.serviceRegistryRepository = serviceRegistryRepository;
    }

    @GetMapping("/config")
    @Operation(summary = "查看运行配置")
    public Map<String, Object> config() {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("ingest.registeredServices", serviceRegistryRepository.count());
        map.put("ingest.enabledServices", serviceRegistryRepository.findAll().stream()
                .filter(r -> Boolean.TRUE.equals(r.getEnabled())).count());
        map.put("ingest.dedupCooldownSeconds", ingestProperties.getDedupCooldownSeconds());
        map.put("ingest.rateLimitEnabled", ingestProperties.isRateLimitEnabled());
        map.put("ingest.globalQps", ingestProperties.getGlobalQps());
        map.put("ingest.perServiceQps", ingestProperties.getPerServiceQps());
        map.put("llm.baseUrl", configService.getLlmBaseUrl());
        map.put("llm.model", configService.getLlmModel());
        map.put("llm.apiKeyConfigured", configService.isLlmApiKeyConfigured());
        map.put("llm.analysisCacheTtl", configService.getLlmAnalysisCacheTtl());
        map.put("feishu.webhookConfigured", notBlank(feishuProperties.getWebhookUrl()));
        map.put("jira.enabled", jiraProperties.isEnabled());
        map.put("jira.baseUrl", jiraProperties.getBaseUrl());
        map.put("jira.projectKey", jiraProperties.getProjectKey());
        map.put("jira.enableForLocal", jiraProperties.isEnableForLocal());
        map.put("jira.mockWhenUnconfigured", jiraProperties.isMockWhenUnconfigured());
        map.put("pipeline.enabled", pipelineProperties.isEnabled());
        map.put("pipeline.notifyChannel", pipelineProperties.getNotifyChannel());
        map.put("pipeline.notifyEnabled", pipelineProperties.isNotifyEnabled());
        map.put("pipeline.detailBaseUrl", pipelineProperties.getDetailBaseUrl());
        map.put("notifyRouting.totalRules", notifyRoutingRepository.count());
        map.put("notifyRouting.enabledRules", notifyRoutingRepository.findAll().stream()
                .filter(r -> Boolean.TRUE.equals(r.getEnabled())).count());
        return map;
    }

    private boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }
}
