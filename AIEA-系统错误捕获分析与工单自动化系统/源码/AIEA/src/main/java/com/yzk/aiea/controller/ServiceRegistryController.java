package com.yzk.aiea.controller;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

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

import com.yzk.aiea.entity.ServiceRegistry;
import com.yzk.aiea.repository.ServiceRegistryRepository;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/**
 * 服务注册与上报 Token 管理
 * <p>
 * 每个接入服务分配一个专属 Token，SDK 上报时需携带 X-AIEA-Token 头。
 * 支持新增、禁用、重置 Token 等操作，无需改配置文件或重启。
 * <p>
 * 安全策略：列表/更新接口返回脱敏 Token；仅创建和重置时返回完整 Token（一次性）。
 */
@RestController
@RequestMapping("/api/v1/service-registry")
@Tag(name = "服务注册", description = "管理接入服务的上报 Token（每服务一个）")
public class ServiceRegistryController {

    private final ServiceRegistryRepository repository;

    public ServiceRegistryController(ServiceRegistryRepository repository) {
        this.repository = repository;
    }

    /** 查询全部已注册服务（Token 脱敏） */
    @GetMapping
    @Operation(summary = "服务列表", description = "查看所有已注册服务，Token 脱敏显示")
    public List<Map<String, Object>> list() {
        return repository.findAll().stream()
                .map(this::toMaskedView)
                .collect(Collectors.toList());
    }

    /** 新增服务（自动生成 Token，返回完整 Token 仅此一次） */
    @PostMapping
    @Operation(summary = "注册新服务", description = "新增服务并自动生成专属上报 Token，返回完整 Token")
    public Map<String, Object> create(@RequestBody Map<String, Object> body) {
        String service = body.get("service") instanceof String s ? s.trim() : null;
        if (service == null || service.isBlank()) {
            throw new IllegalArgumentException("service 不能为空");
        }
        if (repository.existsByService(service)) {
            throw new IllegalArgumentException("服务已存在: " + service);
        }
        String description = body.get("description") instanceof String d ? d.trim() : null;

        ServiceRegistry reg = new ServiceRegistry();
        reg.setService(service);
        reg.setApiToken(generateToken());
        reg.setDescription(description);
        reg.setEnabled(true);
        repository.save(reg);

        // 创建时返回完整 Token
        Map<String, Object> view = toMaskedView(reg);
        view.put("apiToken", reg.getApiToken());
        view.put("fullTokenShown", true);
        return view;
    }

    /** 更新服务信息（描述、启用状态，Token 脱敏） */
    @PutMapping("/{id}")
    @Operation(summary = "更新服务", description = "修改描述或启用/禁用服务")
    public Map<String, Object> update(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        ServiceRegistry existing = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("服务不存在: id=" + id));

        if (body.containsKey("description")) {
            existing.setDescription(body.get("description") instanceof String d ? d.trim() : null);
        }
        if (body.containsKey("enabled")) {
            existing.setEnabled(Boolean.parseBoolean(String.valueOf(body.get("enabled"))));
        }
        repository.save(existing);
        return toMaskedView(existing);
    }

    /** 重新生成 Token（旧 Token 立即失效，返回完整新 Token 仅此一次） */
    @PostMapping("/{id}/regenerate-token")
    @Operation(summary = "重置 Token", description = "为指定服务重新生成上报 Token，旧 Token 立即失效，返回完整新 Token")
    public Map<String, Object> regenerateToken(@PathVariable Long id) {
        ServiceRegistry existing = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("服务不存在: id=" + id));
        existing.setApiToken(generateToken());
        repository.save(existing);

        // 重置时返回完整 Token
        Map<String, Object> view = toMaskedView(existing);
        view.put("apiToken", existing.getApiToken());
        view.put("fullTokenShown", true);
        return view;
    }

    /** 删除服务注册 */
    @DeleteMapping("/{id}")
    @Operation(summary = "删除服务", description = "删除后该服务的上报将被拒绝")
    public Map<String, Object> delete(@PathVariable Long id) {
        if (!repository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "服务不存在: id=" + id);
        }
        repository.deleteById(id);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("deleted", true);
        result.put("id", id);
        return result;
    }

    // ===== 内部方法 =====

    /** 转为脱敏视图（apiToken 脱敏） */
    private Map<String, Object> toMaskedView(ServiceRegistry reg) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", reg.getId());
        map.put("service", reg.getService());
        map.put("apiToken", maskToken(reg.getApiToken()));
        map.put("description", reg.getDescription());
        map.put("enabled", reg.getEnabled());
        map.put("createdAt", reg.getCreatedAt());
        map.put("updatedAt", reg.getUpdatedAt());
        return map;
    }

    /** 脱敏 Token: 保留前 5 位 + 后 3 位，中间用 * 填充 */
    private static String maskToken(String token) {
        if (token == null || token.length() <= 8) {
            return token;
        }
        return token.substring(0, 5)
                + "*".repeat(token.length() - 8)
                + token.substring(token.length() - 3);
    }

    /** 生成随机 Token: tok_ + 32位hex */
    private static String generateToken() {
        return "tok_" + UUID.randomUUID().toString().replace("-", "");
    }
}
