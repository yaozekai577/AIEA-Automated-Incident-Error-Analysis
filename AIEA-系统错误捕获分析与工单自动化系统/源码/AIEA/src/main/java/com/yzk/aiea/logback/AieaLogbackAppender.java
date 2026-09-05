package com.yzk.aiea.logback;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import com.fasterxml.jackson.databind.ObjectMapper;

import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.classic.spi.ThrowableProxy;
import ch.qos.logback.core.UnsynchronizedAppenderBase;

/**
 * Logback Appender：将 ERROR 日志异步上报到 AIEA
 *
 * <pre>
 * &lt;appender name="AIEA" class="com.yzk.aiea.logback.AieaLogbackAppender"&gt;
 *   &lt;serverUrl&gt;http://localhost:8080&lt;/serverUrl&gt;
 *   &lt;apiToken&gt;tok_xxx&lt;/apiToken&gt;  &lt;!-- 在 AIEA「服务注册」页面获取 --&gt;
 *   &lt;service&gt;my-service&lt;/service&gt;
 *   &lt;env&gt;local&lt;/env&gt;
 * &lt;/appender&gt;
 * </pre>
 */
public class AieaLogbackAppender extends UnsynchronizedAppenderBase<ILoggingEvent> {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final ExecutorService EXECUTOR = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "aiea-logback-appender");
        t.setDaemon(true);
        return t;
    });

    private String serverUrl = "http://localhost:8080";
    private String apiToken = "";
    private String service = "unknown-service";
    private String env = "local";

    @Override
    protected void append(ILoggingEvent event) {
        if (event == null || !event.getLevel().isGreaterOrEqual(ch.qos.logback.classic.Level.ERROR)) {
            return;
        }
        Map<String, Object> body = new HashMap<>();
        body.put("env", env);
        body.put("service", service);
        body.put("message", truncate(event.getFormattedMessage(), 1024));

        String stack = null;
        if (event.getThrowableProxy() instanceof ThrowableProxy) {
            ThrowableProxy tp = (ThrowableProxy) event.getThrowableProxy();
            if (tp.getThrowable() != null) {
                stack = stackOf(tp.getThrowable());
            }
        }
        body.put("stack", stack);

        Map<String, Object> context = new HashMap<>();
        context.put("logger", event.getLoggerName());
        context.put("thread", event.getThreadName());
        context.put("mdc", event.getMDCPropertyMap());
        body.put("context", context);

        EXECUTOR.execute(() -> post(body));
    }

    private void post(Map<String, Object> body) {
        HttpURLConnection conn = null;
        try {
            byte[] payload = MAPPER.writeValueAsBytes(body);
            conn = (HttpURLConnection) new URL(trim(serverUrl) + "/api/v1/errors").openConnection();
            conn.setConnectTimeout(2000);
            conn.setReadTimeout(3000);
            conn.setRequestMethod("POST");
            conn.setDoOutput(true);
            conn.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            if (apiToken != null && !apiToken.isBlank()) {
                conn.setRequestProperty("X-AIEA-Token", apiToken);
            }
            try (OutputStream os = conn.getOutputStream()) {
                os.write(payload);
            }
            conn.getResponseCode();
        } catch (Exception ignored) {
            // 不影响业务日志
        } finally {
            if (conn != null) {
                conn.disconnect();
            }
        }
    }

    private String stackOf(Throwable t) {
        StringBuilder sb = new StringBuilder();
        for (Throwable cur = t; cur != null; cur = cur.getCause()) {
            if (sb.length() > 0) {
                sb.append("Caused by: ");
            }
            sb.append(cur).append('\n');
            for (StackTraceElement el : cur.getStackTrace()) {
                sb.append("\tat ").append(el).append('\n');
            }
        }
        return truncate(sb.toString(), 32000);
    }

    private String truncate(String s, int max) {
        if (s == null) {
            return null;
        }
        return s.length() <= max ? s : s.substring(0, max);
    }

    private String trim(String url) {
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }

    public void setServerUrl(String serverUrl) {
        this.serverUrl = serverUrl;
    }

    public void setApiToken(String apiToken) {
        this.apiToken = apiToken;
    }

    public void setService(String service) {
        this.service = service;
    }

    public void setEnv(String env) {
        this.env = env;
    }
}
