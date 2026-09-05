package com.yzk.aiea.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Jira 工单配置
 */
@Component
@ConfigurationProperties(prefix = "jira")
@Data
public class JiraProperties {

    /** 是否启用 Jira 建单 */
    private boolean enabled = true;

    /** Jira Base URL，如 https://xxx.atlassian.net */
    private String baseUrl = "";

    /** 账号邮箱（Cloud Basic Auth） */
    private String email = "";

    /** API Token */
    private String apiToken = "";

    /** 项目 Key */
    private String projectKey = "AIEA";

    /** Issue 类型名称，默认 Bug */
    private String issueType = "Bug";

    /** local 环境是否建单 */
    private boolean enableForLocal = false;

    /** 未配置真实 Jira 时是否走 Mock（返回假 KEY） */
    private boolean mockWhenUnconfigured = true;
}
