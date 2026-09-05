package com.yzk.aiea.dto;

import java.util.Map;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * 错误上报请求体
 * <p>
 * SDK / Agent 通过 POST /api/v1/errors 上报异常信息
 */
@Data
public class ErrorReportRequest {

    /** 环境标识: local/dev/staging/prod */
    private String env = "local";

    /** 上报服务名 */
    @NotBlank(message = "service 不能为空")
    @Size(max = 128, message = "service 长度不能超过 128")
    private String service;

    /** 异常 message */
    @NotBlank(message = "message 不能为空")
    @Size(max = 1024, message = "message 长度不能超过 1024")
    private String message;

    /** 完整堆栈 */
    private String stack;

    /** 上下文信息 (版本/host/thread/MDC/traceId 等) */
    private Map<String, Object> context;
}
