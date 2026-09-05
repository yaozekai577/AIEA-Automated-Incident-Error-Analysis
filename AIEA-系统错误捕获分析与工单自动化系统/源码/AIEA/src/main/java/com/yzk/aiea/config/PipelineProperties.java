package com.yzk.aiea.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * 流水线与通知配置
 */
@Component
@ConfigurationProperties(prefix = "pipeline")
@Data
public class PipelineProperties {

    /** 是否启用异步分析流水线 */
    private boolean enabled = true;

    /** 通知渠道: feishu / dingtalk / none */
    private String notifyChannel = "feishu";

    /** 是否启用通知 */
    private boolean notifyEnabled = true;

    /** 通知失败重试次数 */
    private int notifyMaxRetries = 3;

    /** 详情页 Base URL（推送到群消息中） */
    private String detailBaseUrl = "http://localhost:8080";
}
