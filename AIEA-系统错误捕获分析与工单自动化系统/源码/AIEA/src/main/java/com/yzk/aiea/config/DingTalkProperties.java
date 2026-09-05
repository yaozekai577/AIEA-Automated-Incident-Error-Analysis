package com.yzk.aiea.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * 钉钉机器人配置（可选通道）
 */
@Component
@ConfigurationProperties(prefix = "dingtalk")
@Data
public class DingTalkProperties {

    /** 钉钉自定义机器人 Webhook */
    private String webhookUrl = "";
}
