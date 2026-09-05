package com.yzk.aiea.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 错误上报响应体
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ErrorReportResponse {

    /** 事件 ID */
    private Long id;

    /** 错误指纹 */
    private String fingerprint;

    /** 处理状态 */
    private String status;

    /** 是否被抑制（冷却窗口内的重复上报） */
    private boolean suppressed;

    /** 冷却窗口内命中次数 */
    private int hitCount;

    /** 提示信息 */
    private String message;
}
