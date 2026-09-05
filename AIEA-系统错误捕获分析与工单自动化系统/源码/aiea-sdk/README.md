# AIEA SDK — 轻量错误上报 SDK

> 轻量、异步、无 Spring 依赖的 Java 错误上报 SDK，用于将业务系统异常上报到 [AIEA](../AIEA/) 服务端。

---

## 目录

1. [简介](#1-简介)
2. [特性](#2-特性)
3. [环境要求](#3-环境要求)
4. [安装](#4-安装)
5. [快速开始](#5-快速开始)
6. [配置参考](#6-配置参考)
7. [使用方式](#7-使用方式)
8. [工作原理](#8-工作原理)
9. [API 参考](#9-api-参考)

---

## 1. 简介

AIEA SDK 是 AIEA 平台的客户端组件，负责在业务系统中捕获异常并异步上报到 AIEA Server。上报后的错误会自动进入 AI 根因分析 → 群聊通知 → 工单创建的闭环流水线。

```
业务系统异常 → Aiea.capture(e) → 异步 HTTP 上报 → AIEA Server → AI分析/通知/建单
```

SDK 设计目标：**接入零侵入、上报不阻塞、依赖最小化**。

---

## 2. 特性

- **无 Spring 依赖** — 仅依赖 Jackson，可引入任何 Java 项目（Spring Boot、普通 Web、甚至纯 Java 应用）
- **异步上报** — 内置 2 线程守护线程池，`capture()` 调用立即返回，不阻塞业务线程
- **内置脱敏** — 自动过滤 Bearer Token、password/token/api_key 等敏感信息
- **堆栈截断** — 超长堆栈自动截断至 32KB，防止 OOM
- **自动采集上下文** — 自动收集 hostname、线程名、releaseVersion
- **Java 8+ 兼容** — 适配存量系统，不要求高版本 JDK

---

## 3. 环境要求

| 依赖 | 版本 | 说明 |
|------|------|------|
| JDK | 8+ | 兼容存量系统 |
| Maven | 3.x | 构建安装 |
| Jackson | 2.x | 随 Spring Boot 引入或单独引入 |
| AIEA Server | 0.0.1+ | 上报目标服务 |

---

## 4. 安装

### 4.1 从源码安装到本地 Maven 仓库

```bash
cd aiea-sdk
mvn clean install -DskipTests
```

### 4.2 在业务系统中引入依赖

```xml
<dependency>
    <groupId>com.yzk</groupId>
    <artifactId>aiea-sdk</artifactId>
    <version>0.0.1-SNAPSHOT</version>
</dependency>
```

> 如果业务系统已引入 Spring Boot，Jackson 通常已存在，无需额外添加依赖。

---

## 5. 快速开始

三步接入：初始化 → 捕获 → 完成。

```java
// 1. 初始化（应用启动时执行一次）
Aiea.init(AieaConfig.builder()
        .serverUrl("http://localhost:8080")
        .apiToken("tok_xxx")        // 在 AIEA「服务注册」页面获取
        .service("order-service")
        .env("dev")
        .build());

// 2. 捕获异常（异步上报，不阻塞）
try {
    // 业务逻辑
} catch (Exception e) {
    Aiea.capture(e);
    throw e;
}

// 3. 完成。AIEA Server 会自动进行 AI 分析、群通知、工单创建
```

---

## 6. 配置参考

`AieaConfig` 使用 Builder 模式，所有配置项及默认值如下：

| 方法 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `serverUrl(String)` | String | `http://localhost:8080` | AIEA Server 地址 |
| `apiToken(String)` | String | `""` | 上报鉴权 Token，在 AIEA「服务注册」页面获取 |
| `service(String)` | String | `unknown-service` | 当前服务名，需与注册时一致 |
| `env(String)` | String | `local` | 环境标识：`local`/`dev`/`staging`/`prod` |
| `releaseVersion(String)` | String | `0.0.1` | 当前发布版本号 |
| `connectTimeoutMs(int)` | int | `2000` | HTTP 连接超时（毫秒） |
| `readTimeoutMs(int)` | int | `3000` | HTTP 读取超时（毫秒） |

### Spring Boot 项目推荐配置方式

在 `application.yml` 中定义配置项，通过 `@Value` 注入，支持环境变量覆盖：

```yaml
###########################
##### AIEA 错误上报配置 #####
###########################
aiea:
  server-url: ${AIEA_SERVER_URL:http://localhost:8080}
  api-token: ${AIEA_API_TOKEN:tok_xxx}
  service: ${AIEA_SERVICE:my-service}
  env: ${AIEA_ENV:dev}
  release-version: ${AIEA_RELEASE_VERSION:0.0.1}
```

```java
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import com.yzk.aiea.sdk.Aiea;
import com.yzk.aiea.sdk.AieaConfig;
import javax.annotation.PostConstruct;

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

---

## 7. 使用方式

### 7.1 手动捕获上报

适合需要精细控制上报时机的场景：

```java
try {
    // 业务逻辑
} catch (Exception e) {
    Aiea.capture(e);  // 异步上报，不阻塞
    throw e;          // 按需重新抛出
}
```

### 7.2 携带额外上下文

上报时可附带业务上下文信息，便于排查：

```java
Map<String, Object> context = new HashMap<>();
context.put("userId", currentUserId);
context.put("orderId", orderId);
context.put("traceId", MDC.get("traceId"));

Aiea.capture(exception, context);
```

SDK 自动采集的上下文（无需手动添加）：

| 字段 | 来源 |
|------|------|
| `hostname` | `InetAddress.getLocalHost().getHostName()` |
| `thread` | `Thread.currentThread().getName()` |
| `releaseVersion` | `AieaConfig.releaseVersion` |

### 7.3 全局异常处理器自动上报（推荐）

注册 Spring 全局异常处理器，业务代码无需手动 `Aiea.capture()`：

```java
import com.yzk.aiea.sdk.Aiea;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import javax.servlet.http.HttpServletRequest;
import java.util.HashMap;
import java.util.Map;

/**
 * 全局异常处理器
 * <p>
 * 捕获所有 Controller 层未处理的异常，通过 AIEA SDK 自动上报到 AIEA 服务端。
 * 业务代码中抛出的异常会自动走到这里，无需手动 Aiea.capture()。
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(Exception.class)
    public Map<String, Object> handleException(Exception e, HttpServletRequest request) {
        // 上报到 AIEA，附带请求信息作为上下文
        Map<String, Object> context = new HashMap<>();
        context.put("url", request.getRequestURL().toString());
        context.put("method", request.getMethod());
        context.put("remoteAddr", request.getRemoteAddr());

        Aiea.capture(e, context);

        log.error("全局异常捕获: {}", e.getMessage(), e);

        Map<String, Object> result = new HashMap<>();
        result.put("code", 500);
        result.put("message", e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage());
        return result;
    }
}
```

### 7.4 非 Spring 项目使用

SDK 无 Spring 依赖，可直接在任何 Java 应用中使用：

```java
// 应用启动时初始化
Aiea.init(AieaConfig.builder()
        .serverUrl("http://192.168.1.100:8080")
        .apiToken("tok_xxx")
        .service("legacy-service")
        .env("prod")
        .build());

// 任意位置捕获
try {
    // ...
} catch (Exception e) {
    Aiea.capture(e);
}
```

---

## 8. 工作原理

### 上报流程

```
Aiea.capture(e)
    │
    ├─ 未初始化或 error=null → 直接返回（安全降级）
    │
    ├─ 构造请求体
    │   ├─ message: 异常 toString()，自动脱敏
    │   ├─ stack: 完整堆栈（含 Caused by 链），自动脱敏，截断至 32KB
    │   └─ context: hostname + thread + releaseVersion + 额外上下文
    │
    ├─ 提交到异步线程池（2 个 daemon 线程）
    │
    └─ HTTP POST → {serverUrl}/api/v1/errors
        ├─ Header: X-AIEA-Token: {apiToken}
        ├─ Body: JSON
        ├─ 连接超时: connectTimeoutMs (默认 2000ms)
        ├─ 读取超时: readTimeoutMs (默认 3000ms)
        └─ 失败: 仅打印 stderr 日志，不抛异常，不影响业务
```

### 内置脱敏规则

SDK 在上报前自动对 message 和 stack 进行脱敏处理：

| 规则 | 匹配 | 替换 |
|------|------|------|
| Bearer Token | `Bearer eyJhbGc...` | `Bearer ***` |
| 密钥键值 | `password=secret` / `api_key: sk-xxx` / `token: abc123` | `password=***` |

> 服务端 (AIEA Server) 会进行二次脱敏，额外覆盖邮箱、手机号等。

### 安全保障

- **不阻塞业务**：`capture()` 仅提交任务到线程池，立即返回
- **不抛异常**：HTTP 失败仅打印 stderr，不向上传播
- **未初始化安全**：未调用 `init()` 时 `capture()` 静默返回，不报错
- **守护线程**：上报线程为 daemon，不阻止 JVM 退出

---

## 9. API 参考

### `Aiea` 类

| 方法签名 | 说明 |
|----------|------|
| `static void init(AieaConfig config)` | 初始化 SDK，应用启动时调用一次 |
| `static void capture(Throwable error)` | 上报异常（无额外上下文） |
| `static void capture(Throwable error, Map<String,Object> extraContext)` | 上报异常并携带额外上下文 |

### `AieaConfig` 类

Builder 模式，通过 `AieaConfig.builder()` 创建：

| Builder 方法 | 类型 | 默认值 | 说明 |
|--------------|------|--------|------|
| `serverUrl(String)` | String | `http://localhost:8080` | AIEA Server 地址 |
| `apiToken(String)` | String | `""` | 鉴权 Token |
| `service(String)` | String | `unknown-service` | 服务名 |
| `env(String)` | String | `local` | 环境标识 |
| `releaseVersion(String)` | String | `0.0.1` | 发布版本 |
| `connectTimeoutMs(int)` | int | `2000` | 连接超时（ms） |
| `readTimeoutMs(int)` | int | `3000` | 读取超时（ms） |

---

**版本**: 0.0.1-SNAPSHOT  
**配套服务端**: [AIEA Server](../AIEA/)
