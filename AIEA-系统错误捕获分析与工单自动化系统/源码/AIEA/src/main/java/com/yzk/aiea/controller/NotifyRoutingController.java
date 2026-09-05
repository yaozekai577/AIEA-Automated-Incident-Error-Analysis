package com.yzk.aiea.controller;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.yzk.aiea.entity.NotifyRouting;
import com.yzk.aiea.integration.DingTalkClient;
import com.yzk.aiea.integration.FeishuClient;
import com.yzk.aiea.repository.NotifyRoutingRepository;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/**
 * 通知路由规则管理（多 IM 机器人：飞书 + 钉钉）
 * <p>
 * 按业务服务名 + 通知渠道路由到不同的 IM 群机器人。
 * 同一服务可配两条规则：一条 feishu、一条 dingtalk。
 * 未配置路由的服务 fallback 到全局 webhook。
 */
@RestController
@RequestMapping("/api/v1/notify-routing")
@Tag(name = "通知路由", description = "多 IM 机器人路由规则：服务名 + 渠道 → Webhook 映射")
public class NotifyRoutingController {

    private final NotifyRoutingRepository notifyRoutingRepository;
    private final FeishuClient feishuClient;
    private final DingTalkClient dingTalkClient;

    public NotifyRoutingController(NotifyRoutingRepository notifyRoutingRepository,
                                   FeishuClient feishuClient,
                                   DingTalkClient dingTalkClient) {
        this.notifyRoutingRepository = notifyRoutingRepository;
        this.feishuClient = feishuClient;
        this.dingTalkClient = dingTalkClient;
    }

    /** 查询全部路由规则 */
    @GetMapping
    @Operation(summary = "路由规则列表", description = "查看所有服务级 IM Webhook 路由规则")
    public List<NotifyRouting> list() {
        return notifyRoutingRepository.findAll();
    }

    /** 新建路由规则 */
    @PostMapping
    @Operation(summary = "新建路由规则", description = "为指定服务名 + 渠道配置专属 Webhook")
    public NotifyRouting create(@RequestBody NotifyRouting body) {
        if (body.getService() == null || body.getService().isBlank()) {
            throw new IllegalArgumentException("service 不能为空");
        }
        if (body.getWebhookUrl() == null || body.getWebhookUrl().isBlank()) {
            throw new IllegalArgumentException("webhookUrl 不能为空");
        }
        // channel 默认 feishu
        if (body.getChannel() == null || body.getChannel().isBlank()) {
            body.setChannel("feishu");
        }
        if (notifyRoutingRepository.existsByServiceAndChannel(body.getService(), body.getChannel())) {
            throw new IllegalArgumentException(
                    "该服务+渠道已存在路由规则: " + body.getService() + "/" + body.getChannel());
        }
        if (body.getEnabled() == null) {
            body.setEnabled(true);
        }
        return notifyRoutingRepository.save(body);
    }

    /** 更新路由规则 */
    @PutMapping("/{id}")
    @Operation(summary = "更新路由规则", description = "修改指定路由规则的 Webhook、描述、启用状态等")
    public NotifyRouting update(@PathVariable Long id, @RequestBody NotifyRouting body) {
        NotifyRouting existing = notifyRoutingRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("路由规则不存在: id=" + id));

        // 如果改了 service 或 channel，检查不冲突
        String newService = body.getService() != null && !body.getService().isBlank()
                ? body.getService() : existing.getService();
        String newChannel = body.getChannel() != null && !body.getChannel().isBlank()
                ? body.getChannel() : existing.getChannel();
        if (!newService.equals(existing.getService()) || !newChannel.equals(existing.getChannel())) {
            NotifyRouting conflict = notifyRoutingRepository
                    .findByServiceAndChannel(newService, newChannel).orElse(null);
            if (conflict != null && !conflict.getId().equals(id)) {
                throw new IllegalArgumentException(
                        "服务+渠道已被其他规则占用: " + newService + "/" + newChannel);
            }
        }
        if (body.getService() != null && !body.getService().isBlank()) {
            existing.setService(body.getService());
        }
        if (body.getChannel() != null && !body.getChannel().isBlank()) {
            existing.setChannel(body.getChannel());
        }
        if (body.getWebhookUrl() != null && !body.getWebhookUrl().isBlank()) {
            existing.setWebhookUrl(body.getWebhookUrl());
        }
        if (body.getDescription() != null) {
            existing.setDescription(body.getDescription());
        }
        if (body.getEnabled() != null) {
            existing.setEnabled(body.getEnabled());
        }
        return notifyRoutingRepository.save(existing);
    }

    /** 删除路由规则 */
    @DeleteMapping("/{id}")
    @Operation(summary = "删除路由规则", description = "删除后该服务+渠道将 fallback 到全局 Webhook")
    public Map<String, Object> delete(@PathVariable Long id) {
        if (!notifyRoutingRepository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "路由规则不存在: id=" + id);
        }
        notifyRoutingRepository.deleteById(id);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("deleted", true);
        result.put("id", id);
        return result;
    }

    /** 测试指定路由规则的 Webhook 连通性（按 channel 选择飞书或钉钉客户端） */
    @PostMapping("/{id}/test")
    @Operation(summary = "测试路由 Webhook", description = "向该路由规则配置的 IM 机器人发送一条测试消息")
    public Map<String, Object> testWebhook(@PathVariable Long id) {
        NotifyRouting routing = notifyRoutingRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("路由规则不存在: id=" + id));

        if (!Boolean.TRUE.equals(routing.getEnabled())) {
            Map<String, Object> resp = new LinkedHashMap<>();
            resp.put("success", false);
            resp.put("error", "该路由规则已禁用，无法测试");
            return resp;
        }

        String channel = routing.getChannel() != null ? routing.getChannel() : "feishu";
        String msg = "🔔 路由测试: service=" + routing.getService()
                + ", channel=" + channel + " 机器人连通性正常";

        Map<String, Object> sendResult;
        if ("dingtalk".equalsIgnoreCase(channel)) {
            sendResult = dingTalkClient.sendMarkdown("AIEA 路由测试", msg, routing.getWebhookUrl());
        } else {
            sendResult = feishuClient.sendText(msg, routing.getWebhookUrl());
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("service", routing.getService());
        response.put("channel", channel);
        response.put("webhookUrl", routing.getWebhookUrl());
        response.put("success", sendResult.get("success"));
        response.put("httpStatus", sendResult.get("httpStatus"));
        if (sendResult.containsKey("error")) {
            response.put("error", sendResult.get("error"));
        }
        return response;
    }
}
