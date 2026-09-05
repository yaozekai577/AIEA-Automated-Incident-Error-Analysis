package com.yzk.aiea.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * 飞书机器人配置属性
 * 对应 application.yaml 中的 feishu.* 配置项
 */
@Component
@ConfigurationProperties(prefix = "feishu")
@Data
public class FeishuProperties {

    /** 飞书自定义机器人 Webhook 地址 */
    private String webhookUrl;
}
