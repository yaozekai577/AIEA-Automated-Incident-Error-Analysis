---
name: lightweight-java-sdk
description: Build a lightweight Java SDK with no Spring dependency, async HTTP reporting via daemon thread pool, built-in sensitive data sanitization, stack trace truncation, and Builder pattern configuration. Use when designing Java SDKs for error reporting, metrics collection, or any async HTTP client library that must work in legacy Java 8+ environments without framework dependencies.
---

# Lightweight Java SDK Framework

## Design Constraints

| Constraint | Implementation |
|-----------|---------------|
| No Spring dependency | Only Jackson (`jackson-databind`) |
| Java 8+ compatible | `maven.compiler.source=1.8` |
| Non-blocking | 2-thread daemon thread pool |
| Built-in sanitization | Bearer Token / password / api_key regex |
| Stack truncation | 32,000 chars max |
| HTTP client | `HttpURLConnection` (JDK native) |

## pom.xml

```xml
<project>
    <groupId>com.yzk</groupId>
    <artifactId>aiea-sdk</artifactId>
    <version>0.0.1-SNAPSHOT</version>

    <properties>
        <maven.compiler.source>1.8</maven.compiler.source>
        <maven.compiler.target>1.8</maven.compiler.target>
    </properties>

    <dependencies>
        <!-- Only dependency: Jackson -->
        <dependency>
            <groupId>com.fasterxml.jackson.core</groupId>
            <artifactId>jackson-databind</artifactId>
            <version>2.16.1</version>
        </dependency>
    </dependencies>
</project>
```

## Config (Builder Pattern)

```java
public final class AieaConfig {

    private final String serverUrl;
    private final String apiToken;
    private final String service;
    private final String env;
    private final String releaseVersion;
    private final int connectTimeoutMs;
    private final int readTimeoutMs;

    private AieaConfig(Builder b) {
        this.serverUrl       = b.serverUrl;
        this.apiToken        = b.apiToken;
        this.service         = b.service;
        this.env             = b.env;
        this.releaseVersion  = b.releaseVersion;
        this.connectTimeoutMs = b.connectTimeoutMs;
        this.readTimeoutMs   = b.readTimeoutMs;
    }

    public static Builder builder() { return new Builder(); }

    // getters...

    public static final class Builder {
        // Sensible defaults
        private String serverUrl       = "http://localhost:8080";
        private String apiToken        = "";
        private String service         = "unknown-service";
        private String env             = "local";
        private String releaseVersion  = "0.0.1";
        private int    connectTimeoutMs = 2000;
        private int    readTimeoutMs    = 3000;

        public Builder serverUrl(String v)       { this.serverUrl = v; return this; }
        public Builder apiToken(String v)        { this.apiToken = v; return this; }
        public Builder service(String v)         { this.service = v; return this; }
        public Builder env(String v)             { this.env = v; return this; }
        public Builder releaseVersion(String v)  { this.releaseVersion = v; return this; }
        public Builder connectTimeoutMs(int v)   { this.connectTimeoutMs = v; return this; }
        public Builder readTimeoutMs(int v)      { this.readTimeoutMs = v; return this; }

        public AieaConfig build() { return new AieaConfig(this); }
    }
}
```

## SDK Entry Point

```java
public final class Aiea {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final AtomicBoolean INIT = new AtomicBoolean(false);
    private static volatile AieaConfig config;
    private static ExecutorService executor;

    private Aiea() {}

    /**
     * Initialize SDK (call once at application startup)
     */
    public static void init(AieaConfig cfg) {
        if (cfg == null) throw new IllegalArgumentException("config required");
        config = cfg;
        if (executor == null) {
            ThreadFactory tf = r -> {
                Thread t = new Thread(r, "aiea-sdk-reporter");
                t.setDaemon(true);  // daemon: doesn't block JVM shutdown
                return t;
            };
            executor = Executors.newFixedThreadPool(2, tf);
        }
        INIT.set(true);
        System.out.println("[AIEA] SDK 初始化成功 → " + cfg.getServerUrl()
                + " | service=" + cfg.getService()
                + " | env=" + cfg.getEnv());
    }

    /**
     * Capture and report exception (async, non-blocking)
     */
    public static void capture(Throwable error) {
        capture(error, null);
    }

    /**
     * Capture with extra context (async, non-blocking)
     */
    public static void capture(Throwable error, Map<String, Object> extraContext) {
        if (!INIT.get() || error == null) return;

        AieaConfig cfg = config;
        Map<String, Object> body = new HashMap<>();
        body.put("env", cfg.getEnv());
        body.put("service", cfg.getService());
        body.put("message", sanitize(error.toString()));
        body.put("stack", sanitize(stackTrace(error)));

        // Auto-collect runtime context
        Map<String, Object> context = new HashMap<>();
        context.put("hostname", hostname());
        context.put("thread", Thread.currentThread().getName());
        context.put("releaseVersion", cfg.getReleaseVersion());
        if (extraContext != null) context.putAll(extraContext);
        body.put("context", context);

        executor.execute(() -> postQuietly(cfg, body));
    }

    // ===== HTTP reporting (async, silent on failure) =====

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
                System.err.println("[aiea-sdk] 上报失败 HTTP " + code);
            }
        } catch (Exception e) {
            System.err.println("[aiea-sdk] report error: " + e.getMessage());
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    // ===== Stack trace → String (with cause chain + truncation) =====

    private static String stackTrace(Throwable t) {
        StringBuilder sb = new StringBuilder();
        for (Throwable cur = t; cur != null; cur = cur.getCause()) {
            if (sb.length() > 0) sb.append("Caused by: ");
            sb.append(cur).append('\n');
            for (StackTraceElement el : cur.getStackTrace()) {
                sb.append("\tat ").append(el).append('\n');
            }
        }
        return sb.length() > 32000 ? sb.substring(0, 32000) : sb.toString();
    }

    // ===== Sensitive data sanitization =====

    private static String sanitize(String s) {
        if (s == null) return null;
        return s
            // Bearer token: "Bearer abc123" → "Bearer ***"
            .replaceAll("(?i)(bearer\\s+)[a-zA-Z0-9._\\-]+", "$1***")
            // Key-value: "password=secret" → "password=***"
            .replaceAll("(?i)(password|token|api[_-]?key)\\s*[=:]\\s*\\S+", "$1=***");
    }

    // ===== Utilities =====

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
```

## Report Data Structure

```json
{
  "env": "local",
  "service": "order-service",
  "message": "NullPointerException: Cannot invoke method on null object",
  "stack": "java.lang.NullPointerException\n\tat com.example.OrderService.process(OrderService.java:42)\n...",
  "context": {
    "hostname": "prod-server-01",
    "thread": "http-nio-8080-exec-1",
    "releaseVersion": "1.2.0",
    "userId": "12345",
    "traceId": "abc-123"
  }
}
```

## Spring Boot Integration (Consumer Side)

The SDK itself has no Spring dependency. Consumers integrate via a `@Configuration` class:

```java
@Configuration
public class AieaSdkConfig {

    @Value("${aiea.server-url:http://localhost:8080}")
    private String serverUrl;

    @Value("${aiea.api-token:}")
    private String apiToken;

    @Value("${aiea.service:my-service}")
    private String service;

    @Value("${aiea.env:dev}")
    private String env;

    @Value("${aiea.release-version:0.0.1}")
    private String releaseVersion;

    @PostConstruct
    public void initSdk() {
        Aiea.init(AieaConfig.builder()
                .serverUrl(serverUrl)
                .apiToken(apiToken)
                .service(service)
                .env(env)
                .releaseVersion(releaseVersion)
                .build());
    }
}
```

```yaml
# application.yml (consumer)
aiea:
  server-url: http://localhost:8080
  api-token: tok_xxx
  service: order-service
  env: prod
  release-version: 1.2.0
```

## Usage Patterns

### Pattern 1: Manual capture

```java
try {
    // business logic
} catch (Exception e) {
    Aiea.capture(e);  // async, non-blocking
    throw e;          // re-throw if needed
}
```

### Pattern 2: Capture with context

```java
Aiea.capture(exception, Map.of(
    "userId", currentUserId,
    "orderId", orderId,
    "traceId", MDC.get("traceId")
));
```

### Pattern 3: Global exception handler (recommended)

```java
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(Exception.class)
    public Map<String, Object> handle(Exception e, HttpServletRequest request) {
        Map<String, Object> context = new HashMap<>();
        context.put("url", request.getRequestURL().toString());
        context.put("method", request.getMethod());
        context.put("remoteAddr", request.getRemoteAddr());

        Aiea.capture(e, context);  // auto-report all unhandled exceptions

        return Map.of("code", 500, "message", e.getMessage());
    }
}
```

## Key Design Decisions

1. **Daemon threads**: `t.setDaemon(true)` — SDK threads don't prevent JVM shutdown
2. **Fixed pool of 2**: Enough for async reporting without overwhelming the host
3. **`AtomicBoolean` init guard**: Prevents reporting before `init()` is called
4. **`volatile` config**: Safe publication of config after `init()`
5. **Silent failure**: All errors print to stderr but never throw — SDK must never crash the host app
6. **`HttpURLConnection`**: JDK native, no additional dependencies, works everywhere
7. **Stack truncation at 32KB**: Prevents OOM from extremely long stack traces
8. **Sanitization before serialization**: Sensitive data stripped before JSON conversion
9. **Full cause chain**: Walks `getCause()` to capture root exception
10. **Builder pattern with defaults**: All fields have sensible defaults, only `apiToken` truly required
