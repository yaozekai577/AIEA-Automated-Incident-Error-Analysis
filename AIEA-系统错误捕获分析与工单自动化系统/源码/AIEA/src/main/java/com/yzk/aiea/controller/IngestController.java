package com.yzk.aiea.controller;

import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.yzk.aiea.dto.ErrorReportRequest;
import com.yzk.aiea.dto.ErrorReportResponse;
import com.yzk.aiea.entity.ErrorEvent;
import com.yzk.aiea.entity.ServiceRegistry;
import com.yzk.aiea.repository.ErrorEventRepository;
import com.yzk.aiea.repository.ServiceRegistryRepository;
import com.yzk.aiea.service.ingest.IngestService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

/**
 * 错误接入接口
 * <p>
 * POST /api/v1/errors   - 上报错误事件
 * GET  /api/v1/errors   - 查询错误事件列表
 */
@RestController
@RequestMapping("/api/v1/errors")
@Tag(name = "错误接入", description = "异常上报与查询")
public class IngestController {

    private static final Logger log = LoggerFactory.getLogger(IngestController.class);

    private final IngestService ingestService;
    private final ServiceRegistryRepository serviceRegistryRepository;
    private final ErrorEventRepository errorEventRepository;

    public IngestController(IngestService ingestService,
                            ServiceRegistryRepository serviceRegistryRepository,
                            ErrorEventRepository errorEventRepository) {
        this.ingestService = ingestService;
        this.serviceRegistryRepository = serviceRegistryRepository;
        this.errorEventRepository = errorEventRepository;
    }

    /**
     * 上报错误事件
     * <p>
     * 需在请求头携带 X-AIEA-Token 进行鉴权（按 service + token 配对校验）。
     * 服务需先在前端「服务注册」页面注册并获得 Token。
     */
    @PostMapping
    @Operation(summary = "上报错误事件", description = "SDK/Agent 通过此接口上报异常堆栈，需携带服务专属 Token")
    public ResponseEntity<?> reportError(
            @RequestHeader(value = "X-AIEA-Token", required = false) String token,
            @RequestBody @Valid ErrorReportRequest request) {

        // 鉴权：按 service + token 配对校验
        String service = request.getService();
        if (token == null || token.isBlank()) {
            log.warn("上报鉴权失败: 缺少 Token, service={}", service);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "缺少 X-AIEA-Token 请求头"));
        }

        ServiceRegistry reg = serviceRegistryRepository.findByService(service).orElse(null);
        if (reg == null) {
            log.warn("上报鉴权失败: 服务未注册, service={}", service);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "服务未注册: " + service + "，请先在服务注册页面添加"));
        }
        if (!Boolean.TRUE.equals(reg.getEnabled())) {
            log.warn("上报鉴权失败: 服务已禁用, service={}", service);
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "服务已被禁用: " + service));
        }
        if (!reg.getApiToken().equals(token)) {
            log.warn("上报鉴权失败: Token 不匹配, service={}", service);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Token 不匹配"));
        }

        ErrorReportResponse response = ingestService.ingest(request);
        return ResponseEntity.ok(response);
    }

    /**
     * 查询错误事件列表
     * <p>
     * 可按 fingerprint 或 status 过滤
     */
    @GetMapping
    @Operation(summary = "查询错误事件列表", description = "可按指纹或状态过滤")
    public List<ErrorEvent> listErrors(
            @RequestParam(value = "fingerprint", required = false) String fingerprint,
            @RequestParam(value = "status", required = false) String status) {

        if (fingerprint != null) {
            return errorEventRepository.findByFingerprint(fingerprint);
        }
        if (status != null) {
            return errorEventRepository.findByStatus(status);
        }
        return errorEventRepository.findAll();
    }
}
