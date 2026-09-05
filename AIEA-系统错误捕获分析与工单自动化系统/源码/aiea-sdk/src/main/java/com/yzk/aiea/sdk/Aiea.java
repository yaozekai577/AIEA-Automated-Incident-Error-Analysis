package com.yzk.aiea.sdk;

import java.io.OutputStream;
import java.io.PrintStream;
import java.io.UnsupportedEncodingException;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.atomic.AtomicBoolean;

import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * AIEA 错误上报 SDK（轻量、异步、无 Spring 依赖）
 * <pre>
 * Aiea.init(AieaConfig.builder()
 *     .serverUrl("http://localhost:8080")
 *     .apiToken("tok_xxx")  // 在 AIEA「服务注册」页面获取
 *     .service("order-service")
 *     .env("local")
 *     .build());
 * Aiea.capture(exception);
 * </pre>
 */
public final class Aiea {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final AtomicBoolean INIT = new AtomicBoolean(false);
    private static volatile AieaConfig config;
    private static ExecutorService executor;

    /**
     * UTF-8 编码的输出流，避免 Windows 控制台 GBK 编码导致中文乱码。
     * 无论平台默认编码是什么，所有 SDK 日志均以 UTF-8 输出。
     */
    private static final PrintStream out;
    private static final PrintStream err;
    static {
        PrintStream tmpOut = System.out;
        PrintStream tmpErr = System.err;
        try {
            tmpOut = new PrintStream(System.out, true, "UTF-8");
            tmpErr = new PrintStream(System.err, true, "UTF-8");
        } catch (UnsupportedEncodingException e) {
            // UTF-8 是 Java 规范保证支持的编码，理论上不会走到这里
            // 降级使用平台默认编码
        }
        out = tmpOut;
        err = tmpErr;
    }

    private Aiea() {
    }

    public static void init(AieaConfig cfg) {
        if (cfg == null) {
            throw new IllegalArgumentException("config required");
        }
        config = cfg;
        if (executor == null) {
            ThreadFactory tf = r -> {
                Thread t = new Thread(r, "aiea-sdk-reporter");
                t.setDaemon(true);
                return t;
            };
            executor = Executors.newFixedThreadPool(2, tf);
        }
        INIT.set(true);
        out.println("[AIEA] SDK 初始化成功 → " + cfg.getServerUrl()
                + " | service=" + cfg.getService()
                + " | env=" + cfg.getEnv());
    }

    public static void capture(Throwable error) {
        capture(error, null);
    }

    public static void capture(Throwable error, Map<String, Object> extraContext) {
        if (!INIT.get() || error == null) {
            return;
        }
        AieaConfig cfg = config;
        Map<String, Object> body = new HashMap<>();
        body.put("env", cfg.getEnv());
        body.put("service", cfg.getService());
        body.put("message", sanitize(error.toString()));
        body.put("stack", sanitize(stackTrace(error)));

        Map<String, Object> context = new HashMap<>();
        context.put("hostname", hostname());
        context.put("thread", Thread.currentThread().getName());
        context.put("releaseVersion", cfg.getReleaseVersion());
        if (extraContext != null) {
            context.putAll(extraContext);
        }
        body.put("context", context);

        out.println("[AIEA] 错误上报中: " + error.getClass().getName()
                + ": " + error.getMessage()
                + " → " + cfg.getServerUrl());

        executor.execute(() -> postQuietly(cfg, body));
    }

    private static void postQuietly(AieaConfig cfg, Map<String, Object> body) {
        HttpURLConnection conn = null;
        try {
            String endpoint = trimSlash(cfg.getServerUrl()) + "/api/v1/errors";
            byte[] payload = MAPPER.writeValueAsBytes(body);
            conn = (HttpURLConnection) new URL(endpoint).openConnection();
            conn.setConnectTimeout(cfg.getConnectTimeoutMs());
            conn.setReadTimeout(cfg.getReadTimeoutMs());
            conn.setRequestMethod("POST");
            conn.setDoOutput(true);
            conn.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            if (cfg.getApiToken() != null && !cfg.getApiToken().trim().isEmpty()) {
                conn.setRequestProperty("X-AIEA-Token", cfg.getApiToken());
            }
            try (OutputStream os = conn.getOutputStream()) {
                os.write(payload);
            }
            int code = conn.getResponseCode();
            if (code >= 400) {
                err.println("[aiea-sdk] 上报失败 HTTP " + code);
            } else {
                out.println("[AIEA] 上报成功 HTTP " + code);
            }
        } catch (Exception e) {
            err.println("[aiea-sdk] report error: " + e.getMessage());
        } finally {
            if (conn != null) {
                conn.disconnect();
            }
        }
    }

    private static String stackTrace(Throwable t) {
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
        return sb.length() > 32000 ? sb.substring(0, 32000) : sb.toString();
    }

    private static String sanitize(String s) {
        if (s == null) {
            return null;
        }
        return s.replaceAll("(?i)(bearer\\s+)[a-zA-Z0-9._\\-]+", "$1***")
                .replaceAll("(?i)(password|token|api[_-]?key)\\s*[=:]\\s*\\S+", "$1=***");
    }

    private static String hostname() {
        try {
            return java.net.InetAddress.getLocalHost().getHostName();
        } catch (Exception e) {
            return "unknown";
        }
    }

    private static String trimSlash(String url) {
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }
}
