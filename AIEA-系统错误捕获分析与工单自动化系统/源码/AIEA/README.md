# AIEA — AI 错误根因分析与工单自动化平台

> **AIEA** = AI Error Analysis  
> 把「发现错误 → AI 根因分析 → 群聊通知 → 工单跟进」全自动化的端到端工具链。

---

## 目录

1. [系统简介](#1-系统简介)
2. [系统架构](#2-系统架构)
3. [模块说明](#3-模块说明)
4. [技术栈](#4-技术栈)
5. [数据库设计](#5-数据库设计)
6. [快速开始](#6-快速开始)
7. [业务系统对接指南](#7-业务系统对接指南)
8. [API 接口文档](#8-api-接口文档)
9. [配置参考](#9-配置参考)
10. [前端管理控制台](#10-前端管理控制台)
11. [常见问题](#11-常见问题)

---

## 1. 系统简介

### 1.1 解决什么问题

线上与本地开发环境的异常往往依赖人工排查：翻日志、群里同步、手填 Jira。流程长、重复劳动多，同类错误反复出现时缺少沉淀。AIEA 将这一流程自动化：

| 能力 | 说明 |
|------|------|
| **错误捕获** | 通过轻量 SDK 或 Logback Appender 自动上报异常堆栈 |
| **智能去重** | 堆栈指纹归一化 + Redis 冷却窗口，同类错误不刷屏 |
| **AI 根因分析** | 调用大模型（OpenAI 兼容协议）生成结构化根因报告与修复建议 |
| **协作推送** | 自动推送飞书/钉钉群聊卡片消息，含摘要 + AI 分析 + 工单链接 |
| **工单闭环** | 自动创建内置工单（可选 Jira），支持认领、解决、关闭、重开全流程 |
| **管理控制台** | React Web UI，可视化管理服务注册、通知路由、LLM 配置、告警规则 |

### 1.2 核心处理流水线

```
业务系统异常
    │
    ▼ SDK / Logback Appender 异步 HTTP 上报
┌───────────────────────────────────────────────┐
│              AIEA Server                      │
│                                               │
│  1. 鉴权 (X-AIEA-Token, 按服务名+Token校验)    │
│  2. 限流 (全局QPS + 每服务QPS, Redis固定窗口)   │
│  3. 脱敏截断 (Bearer/密码/手机号/邮箱)          │
│  4. 指纹计算 (堆栈归一化 → SHA-256)             │
│  5. Redis去重/冷却 (SET NX + INCR + TTL)       │
│  6. 落库 error_event                           │
│  7. 事务提交后触发异步流水线 ──────────────┐     │
│                                          │     │
│  ┌──── 异步流水线 (ErrorPipelineService) ──┤    │
│  │  a. LLM根因分析 (缓存复用, 降级兜底)     │    │
│  │  b. 创建内置工单 (AI生成标题, 智能定级)   │   │
│  │  c. 创建Jira工单 (可选, 幂等复用)        │   │
│  │  d. 群聊通知 (飞书/钉钉, 路由规则, 重试)  │   │
│  └──────────────────────────────────────────┘ │
└───────────────────────────────────────────────┘
    │
    ▼
  MySQL (事件/分析/工单/通知记录)
  Redis (指纹冷却/限流/分析缓存)
  飞书/钉钉群
  Jira (可选)
```

### 1.3 事件状态机

```
RECEIVED → ANALYZING → TICKETED → NOTIFIED
    │          │          │
    │          ▼          ▼
    └────► FAILED ◄──────┘
    │
    ▼
SUPPRESSED (冷却窗口内重复上报，不触发下游)
```

---

## 2. 系统架构

### 2.1 整体架构

```
┌─────────────────┐   ┌──────────────────────┐
│ 业务 Java 服务   │   │ 本地服务 / 存量系统   │
│  + aiea-sdk     │   │  + Logback Appender  │
└────────┬────────┘   └──────────┬───────────┘
         │ HTTP 上报             │ HTTP 上报
         └───────────┬───────────┘
                     ▼
         ┌───────────────────────┐
         │     AIEA Server       │
         │  (Spring Boot 3.3)    │
         │                       │
         │  Ingest → Fingerprint │
         │  → Dedup → Pipeline   │
         │  → Analyze → Notify   │
         │  → Ticket             │
         └───────┬───────────────┘
                 │
     ┌───────────┼───────────┬────────────┐
     ▼           ▼           ▼            ▼
  MySQL 8    Redis 7    LLM API     飞书/钉钉
                        (OpenAI兼容)   Jira (可选)
```

### 2.2 仓库结构

```
ai开发比赛/
├── AIEA/                          # 主服务 (Spring Boot)
│   ├── pom.xml
│   └── src/main/java/com/yzk/aiea/
│       ├── AieaApplication.java          # 启动类
│       ├── config/                       # 配置类
│       │   ├── AsyncConfig.java          # 异步线程池
│       │   ├── LlmConfig.java           # LLM RestTemplate
│       │   ├── LlmProperties.java        # LLM 配置属性
│       │   ├── FeishuProperties.java     # 飞书配置
│       │   ├── DingTalkProperties.java   # 钉钉配置
│       │   ├── JiraProperties.java       # Jira 配置
│       │   ├── IngestProperties.java     # 接入配置
│       │   ├── PipelineProperties.java   # 流水线配置
│       │   └── RedisConfig.java          # Redis 配置
│       ├── controller/                   # REST API
│       │   ├── IngestController.java      # 错误上报与查询
│       │   ├── ServiceRegistryController # 服务注册与Token管理
│       │   ├── EventQueryController      # 事件详情与重试
│       │   ├── InternalTicketController  # 内置工单管理
│       │   ├── NotifyRoutingController   # 通知路由管理
│       │   ├── LlmConfigController       # LLM 配置管理
│       │   ├── LlmTestController         # LLM/飞书连通性测试
│       │   ├── StatsController           # 统计与告警规则
│       │   ├── AdminController           # 运行配置查看
│       │   └── GlobalExceptionHandler   # 全局异常处理
│       ├── dto/                          # 请求/响应 DTO
│       ├── entity/                       # JPA 实体
│       ├── integration/                  # 外部集成客户端
│       │   ├── LlmClient.java             # OpenAI 兼容 LLM
│       │   ├── FeishuClient.java         # 飞书机器人
│       │   ├── DingTalkClient.java       # 钉钉机器人
│       │   └── JiraClient.java           # Jira REST API
│       ├── logback/                      # Logback Appender
│       ├── repository/                   # JPA Repository
│       ├── service/                      # 核心业务逻辑
│       │   ├── ingest/IngestService      # 错误接入
│       │   ├── fingerprint/              # 指纹算法
│       │   ├── analyze/AnalyzeService    # LLM 根因分析
│       │   ├── notify/NotifyService       # 协作通知
│       │   ├── ticket/                   # 工单服务
│       │   │   ├── TicketService         # Jira 建单
│       │   │   └── InternalTicketService # 内置工单
│       │   ├── pipeline/                 # 异步流水线
│       │   ├── redis/                    # Redis 服务
│       │   │   ├── RedisDedupService     # 指纹去重
│       │   │   ├── RateLimiterService    # 限流
│       │   │   └── LlmAnalysisCacheService # 分析缓存
│       │   └── SystemConfigService       # 动态配置
│       ├── util/                         # 工具类
│       └── resources/
│           ├── application.yaml           # 主配置
│           ├── db/init.sql                # 数据库初始化脚本
│           └── logback-spring.xml         # 日志配置
│
├── aiea-sdk/                      # 轻量错误上报 SDK
│   ├── pom.xml
│   └── src/main/java/com/yzk/aiea/sdk/
│       ├── Aiea.java                     # SDK 主入口
│       └── AieaConfig.java               # SDK 配置 (Builder)
│
├── frontend/                      # 管理控制台 (React + Vite)
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── App.jsx                       # 路由
│       ├── api.js                        # API 封装
│       ├── components/MainLayout.jsx     # 布局
│       └── pages/                        # 页面
│           ├── Dashboard.jsx             # 仪表盘
│           ├── ErrorList.jsx             # 错误事件列表
│           ├── ErrorDetail.jsx           # 错误详情
│           ├── ErrorGroups.jsx           # 错误聚合
│           ├── SuppressRules.jsx         # 告警规则
│           ├── ServiceRegistry.jsx       # 服务注册
│           ├── NotifyRouting.jsx         # 通知路由
│           ├── Tickets.jsx              # 工单列表
│           ├── TicketDetail.jsx         # 工单详情
│           └── Config.jsx               # 系统配置
│
└── docs/
    └── 项目实施方案.md                     # 项目实施文档
```

---

## 3. 模块说明

### 3.1 AIEA Server（主服务）

Spring Boot 3.3 单体应用，提供错误接入、分析、通知、建单全部能力。

| 子模块 | 核心类 | 职责 |
|--------|--------|------|
| **错误接入** | `IngestService` | 鉴权 → 限流 → 脱敏 → 指纹 → 去重 → 落库 → 触发异步流水线 |
| **指纹算法** | `FingerprintService` | 堆栈归一化（去行号/UUID/hex/时间戳）→ SHA-256 生成 64 位指纹 |
| **Redis 去重** | `RedisDedupService` | SET NX + INCR + TTL 实现冷却窗口，Redis 不可用时降级放行 |
| **Redis 限流** | `RateLimiterService` | 全局 QPS + 每服务 QPS 双重限流，固定窗口算法 |
| **LLM 缓存** | `LlmAnalysisCacheService` | 同指纹 TTL 窗口内复用分析结果，节省 Token |
| **根因分析** | `AnalyzeService` | 调用 LLM 生成结构化 JSON（根因/建议/置信度），解析失败自动重试，降级兜底 |
| **协作通知** | `NotifyService` | 飞书/钉钉卡片消息推送，支持服务级路由规则、重试 |
| **Jira 建单** | `TicketService` | 同指纹幂等复用，local 环境可跳过，未配置时 Mock |
| **内置工单** | `InternalTicketService` | 不依赖外部 Jira 的完整工单生命周期：AI 生成标题、智能定级、认领/解决/关闭/重开/忽略 |
| **异步流水线** | `ErrorPipelineService` | `@Async` 编排：分析 → 建单 → 通知，事务提交后触发避免脏读 |
| **动态配置** | `SystemConfigService` | DB (system_config) > yaml > 默认值，LLM 配置可前端热更新 |
| **Logback Appender** | `AieaLogbackAppender` | 无侵入接入：ERROR 级日志自动异步上报，不改业务代码 |

### 3.2 aiea-sdk（错误上报 SDK）

轻量级 Java SDK，**无 Spring 依赖**，兼容 Java 8+，可独立引入任何 Java 业务系统。

| 类 | 职责 |
|----|------|
| `Aiea` | SDK 主入口，异步 HTTP 上报异常，内置脱敏（Bearer Token / 密码） |
| `AieaConfig` | Builder 模式配置：serverUrl、apiToken、service、env、releaseVersion、超时 |

**特点**：
- 异步上报（2 线程守护线程池），不阻塞业务线程
- 内置敏感信息脱敏（Bearer Token、password/token/api_key）
- 堆栈自动截断（32KB）
- 仅依赖 Jackson，体积小

### 3.3 Frontend（管理控制台）

React 18 + Vite 4 + Ant Design 5 单页应用。

| 页面 | 功能 |
|------|------|
| 仪表盘 | 全局统计：事件数、分析数、通知成功率、工单状态分布、环境/服务/状态分布 |
| 错误事件 | 事件列表，按指纹/状态过滤 |
| 错误详情 | 含 AI 分析结果、通知记录、工单关联，支持重试流水线 |
| 错误聚合 | 按指纹分组查看同类错误 |
| 告警规则 | 查看冷却规则、命中次数、剩余冷却时间，可调整单指纹冷却窗口 |
| 服务注册 | 注册服务、生成/重置上报 Token（脱敏展示），支持启用/禁用 |
| 通知路由 | 按服务名+渠道配置专属飞书/钉钉机器人，支持连通性测试 |
| 工单管理 | 工单列表（按状态/处理人过滤）、详情（含操作时间线）、认领/解决/关闭/重开/变更优先级 |
| 系统配置 | 查看运行配置、LLM 配置在线编辑、LLM/飞书连通性测试 |

---

## 4. 技术栈

| 层级 | 选型 | 说明 |
|------|------|------|
| **语言** | Java 17 (LTS) | Server 要求 17+；SDK 兼容 Java 8+ |
| **框架** | Spring Boot 3.3.12 | 主服务框架 |
| **构建** | Maven | 依赖管理 |
| **ORM** | Spring Data JPA | CRUD 快速开发 |
| **数据库** | MySQL 8 | 事件/分析/工单/配置等结构化存储 |
| **缓存** | Redis 7 | 指纹冷却、限流、LLM 分析缓存 |
| **API 文档** | springdoc-openapi 2.6 | Swagger UI 自动生成 |
| **日志** | Logback | 含自定义 Appender |
| **LLM** | OpenAI 兼容协议 | 阿里云百炼/DashScope、DeepSeek、OpenAI 等 |
| **IM 推送** | 飞书 / 钉钉 | 自定义机器人 Webhook |
| **工单** | Jira REST API v2 (可选) | Cloud/Server，Basic Auth |
| **前端** | React 18 + Vite 4 + Ant Design 5 | SPA 管理控制台 |
| **HTTP 客户端** | RestTemplate (Server) / HttpURLConnection (SDK) | SDK 无 Spring 依赖 |
| **JSON** | Jackson | 序列化/反序列化 |

---

## 5. 数据库设计

共 10 张表，初始化脚本见 `src/main/resources/db/init.sql`。

| # | 表名 | 说明 | 关键字段 |
|---|------|------|----------|
| 1 | `error_event` | 错误事件主表 | fingerprint, env, service, message, stack, context_json, status |
| 2 | `analysis_result` | LLM 根因分析结果 | event_id(FK), root_cause, suggestions, confidence, model |
| 3 | `notify_record` | 通知推送记录 | event_id, channel, payload, http_status |
| 4 | `jira_ticket` | Jira 工单关联 | event_id, jira_key(UQ), project, url |
| 5 | `suppress_rule` | 告警抑制/冷却规则 | fingerprint(PK), cooldown_sec, hit_count, last_fired_at |
| 6 | `internal_ticket` | 内置工单 | event_id, fingerprint, title, status, priority, assignee |
| 7 | `ticket_log` | 工单操作日志 | ticket_id, action, old_value, new_value, operator |
| 8 | `notify_routing` | 通知路由规则 | service, channel, webhook_url, enabled |
| 9 | `service_registry` | 服务注册与鉴权 | service(UQ), api_token(UQ), enabled |
| 10 | `system_config` | 系统动态配置 | config_key(PK), config_value |

**事件状态机**：`RECEIVED → ANALYZING → TICKETED → NOTIFIED → FAILED` / `SUPPRESSED`

**内置工单状态机**：`OPEN → IN_PROGRESS → RESOLVED → CLOSED / IGNORED`（支持 REOPEN）

---

## 6. 快速开始

### 6.1 环境准备

| 依赖 | 最低版本 | 说明 |
|------|----------|------|
| JDK | 17 | Server 编译运行 |
| Maven | 3.8+ | 构建工具 |
| MySQL | 8.0 | 数据库 |
| Redis | 6.0+ | 缓存/去重/限流 |
| Node.js | 18+ | 前端开发（可选） |

### 6.2 初始化数据库

```sql
-- 登录 MySQL 后执行
SOURCE d:/Java/ai开发比赛/AIEA/src/main/resources/db/init.sql;
```

### 6.3 构建与安装 SDK

```powershell
# 进入 aiea-sdk 目录
cd d:\Java\ai开发比赛\aiea-sdk

# 安装到本地 Maven 仓库（Server 依赖此 SDK）
mvn clean install -DskipTests
```

### 6.4 配置并启动 Server

编辑 `src/main/resources/application.yaml`，确认数据库和 Redis 连接信息：

```yaml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/aiea?useUnicode=true&characterEncoding=utf8&serverTimezone=Asia/Shanghai&useSSL=false&allowPublicKeyRetrieval=true
    username: root
    password: root
  data:
    redis:
      host: localhost
      port: 6379

# 大模型（OpenAI 兼容协议，如阿里云百炼/DashScope、DeepSeek、OpenAI 等）
llm:
  base-url: https://dashscope.aliyuncs.com/compatible-mode/v1
  api-key: sk-xxx
  model: qwen-plus
  timeout: 30000
  analysis-cache-ttl: 3600     # 同指纹分析缓存秒数，0=不缓存

# 飞书自定义机器人（全局默认 Webhook）
feishu:
  webhook-url: https://open.feishu.cn/open-apis/bot/v2/hook/xxx
```

启动服务：

```powershell
cd d:\Java\ai开发比赛\AIEA
mvn spring-boot:run
```

启动后访问：
- Swagger UI: http://localhost:8080/swagger-ui.html
- 健康检查: http://localhost:8080/actuator/health

### 6.5 启动前端控制台（可选）

```powershell
cd d:\Java\ai开发比赛\frontend
npm install
npm run dev
```

前端运行在 http://localhost:3000，API 请求自动代理到 `http://localhost:8080`。

---

## 7. 业务系统对接指南

### 7.1 对接流程总览

```
┌─────────────────────────────────────────────────────────────┐
│  AIEA 管理控制台                        业务系统             │
│                                                             │
│  1. 注册服务 ──────────────────────┐                        │
│     (服务名 + 获取 Token)            │                        │
│                                      ▼                        │
│  2. 配置通知路由 ──────────┐         │                        │
│     (服务名+渠道→Webhook)   │         │                        │
│                              ▼         │                        │
│  3. 配置 LLM (Base URL/Key/Model)     │                        │
│     配置飞书全局 Webhook               │                        │
│                                      │                        │
│  4. Token 交付给业务系统 ──────────────────────────────────►  │
│                                      │                        │
│                                      │  5. 引入 aiea-sdk      │
│                                      │     初始化 (Token+URL)  │
│                                      │                        │
│                                      │  6. 异常发生时自动上报  │
│                                      │     Aiea.capture(e)    │
│                                      │         │              │
│  7. AIEA 自动处理 ◄────────────────────────────┘              │
│     AI分析 → 群消息 → 工单                                     │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 方式一：SDK 对接（推荐）

#### Step 1: 在 AIEA 控制台注册服务

在「服务注册」页面新增服务，系统自动生成专属 Token（仅展示一次，请妥善保存）。

或通过 API 注册：

```bash
curl -X POST http://<aiea-server>:8080/api/v1/service-registry \
  -H "Content-Type: application/json" \
  -d '{"service":"order-service","description":"订单服务"}'
# 返回: {"id":1,"service":"order-service","apiToken":"tok_xxx...","fullTokenShown":true}
```

#### Step 2: 引入 SDK 依赖

在业务系统的 `pom.xml` 中添加：

```xml
<dependency>
    <groupId>com.yzk</groupId>
    <artifactId>aiea-sdk</artifactId>
    <version>0.0.1-SNAPSHOT</version>
</dependency>
```

> 需先 `mvn install` 安装 aiea-sdk 到本地仓库。

#### Step 3: 初始化 SDK

在业务系统中创建配置类，应用启动时自动初始化 AIEA SDK，配置项支持 `application.yml` 和环境变量覆盖：

```java
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import com.yzk.aiea.sdk.Aiea;
import com.yzk.aiea.sdk.AieaConfig;
import javax.annotation.PostConstruct;

/**
 * AIEA SDK 初始化配置
 * <p>
 * 应用启动时自动初始化 AIEA 错误上报 SDK。
 * 配置项在 application.yml 中，支持环境变量覆盖。
 */
@Configuration
public class AieaSdkConfig {

    @Value("${aiea.server-url:http://localhost:8080}")
    private String serverUrl;

    @Value("${aiea.api-token:}")
    private String apiToken;

    @Value("${aiea.service:ly-bd-metrics-mgt-svc}")
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

#### Step 4: 上报异常

支持**手动捕获**和**全局自动上报**两种方式，按需选择。

**方式一：手动捕获上报**

在业务代码中手动捕获并上报，适合需要精细控制上报时机的场景：

```java
try {
    // 业务逻辑
} catch (Exception e) {
    Aiea.capture(e);  // 异步上报，不阻塞
    throw e;          // 按需重新抛出
}
```

也可携带额外上下文：

```java
Aiea.capture(exception, Map.of(
    "userId", currentUserId,
    "orderId", orderId,
    "traceId", MDC.get("traceId")
));
```

**方式二：全局异常处理器自动上报（推荐）**

在业务系统中注册全局异常处理器，捕获所有 Controller 层未处理的异常并自动上报，业务代码无需手动 `Aiea.capture()`：

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

    /**
     * 兜底：捕获所有未被单独处理的异常
     */
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

SDK 会自动采集：hostname、线程名、releaseVersion，连同异常 message 和完整堆栈异步上报。

### 7.3 方式二：Logback Appender 对接（零侵入）

适用于无法修改代码的存量系统，只需修改 `logback.xml` / `logback-spring.xml`。

#### Step 1: 注册服务获取 Token

同 7.2 Step 1。

#### Step 2: 引入依赖

业务系统 `pom.xml` 中添加 AIEA 主服务依赖（或单独打包 Appender 类）：

```xml
<dependency>
    <groupId>com.yzk</groupId>
    <artifactId>AIEA</artifactId>
    <version>0.0.1-SNAPSHOT</version>
    <scope>provided</scope>
</dependency>
```

#### Step 3: 配置 Logback

在 `logback-spring.xml` 中添加 Appender：

```xml
<appender name="AIEA" class="com.yzk.aiea.logback.AieaLogbackAppender">
    <serverUrl>http://<aiea-server>:8080</serverUrl>
    <apiToken>tok_xxx</apiToken>
    <service>order-service</service>
    <env>prod</env>
</appender>

<!-- 将 ERROR 级别日志同时上报到 AIEA -->
<logger name="com.yourcompany" level="ERROR" additivity="false">
    <appender-ref ref="AIEA"/>
    <appender-ref ref="CONSOLE"/>
</logger>
```

配置后，ERROR 级别日志会自动异步上报到 AIEA，无需改业务代码。

### 7.4 方式三：直接 HTTP 调用

适用于非 Java 环境（Python/Go/Node.js 等），直接调用 REST API：

```bash
curl -X POST http://<aiea-server>:8080/api/v1/errors \
  -H "Content-Type: application/json" \
  -H "X-AIEA-Token: tok_xxx" \
  -d '{
    "env": "prod",
    "service": "order-service",
    "message": "NullPointerException: Cannot invoke method on null object",
    "stack": "java.lang.NullPointerException\n\tat com.example.OrderService.process(OrderService.java:42)",
    "context": {
      "hostname": "prod-server-01",
      "traceId": "abc-123"
    }
  }'
```

### 7.5 配置通知路由

通知路由用于将不同业务服务的错误通知精准推送到对应的飞书/钉钉群聊，避免所有错误都涌入同一个群。

#### 路由规则说明

每条路由规则由 **服务名 + 通知渠道 → Webhook 地址** 组成：

| 字段 | 说明 | 示例 |
|------|------|------|
| `service` | 业务服务名，需与 SDK 配置中的 `aiea.service` 一致 | `order-service` |
| `channel` | 通知渠道：`feishu`（飞书）或 `dingtalk`（钉钉） | `feishu` |
| `webhookUrl` | IM 自定义机器人的 Webhook 地址 | `https://open.feishu.cn/open-apis/bot/v2/hook/xxx` |
| `description` | 路由描述，便于识别 | `订单服务专属飞书群` |
| `enabled` | 是否启用，禁用后 fallback 到全局 Webhook | `true` |

> 同一服务可配置两条规则：一条飞书、一条钉钉，实现双通道通知。

#### 路由匹配逻辑

```
错误事件上报 → 查找 notify_routing 表
  │
  ├─ 匹配到 (service + channel) 且 enabled=true → 推送到该规则配置的专属 Webhook
  │
  └─ 未匹配或规则已禁用 → fallback 到 application.yaml 中的全局 Webhook
      ├─ feishu  → feishu.webhook-url
      └─ dingtalk → dingtalk.webhook-url
```

#### 页面操作

在前端「通知路由」页面：

1. 点击「新建路由」，填写服务名、渠道、Webhook 地址、描述
2. 保存后可启用/禁用、编辑或删除规则
3. 点击「测试」可向该路由配置的机器人发送一条测试消息，验证连通性

#### API 操作

```bash
# 新建路由规则
curl -X POST http://<aiea-server>:8080/api/v1/notify-routing \
  -H "Content-Type: application/json" \
  -d '{
    "service": "order-service",
    "channel": "feishu",
    "webhookUrl": "https://open.feishu.cn/open-apis/bot/v2/hook/xxx",
    "description": "订单服务专属飞书群",
    "enabled": true
  }'

# 查看所有路由规则
curl http://<aiea-server>:8080/api/v1/notify-routing

# 测试某条路由的 Webhook 连通性
curl -X POST http://<aiea-server>:8080/api/v1/notify-routing/{id}/test

# 更新路由规则
curl -X PUT http://<aiea-server>:8080/api/v1/notify-routing/{id} \
  -H "Content-Type: application/json" \
  -d '{"webhookUrl": "https://open.feishu.cn/open-apis/bot/v2/hook/new-xxx"}'

# 删除路由规则（删除后该服务+渠道将 fallback 到全局 Webhook）
curl -X DELETE http://<aiea-server>:8080/api/v1/notify-routing/{id}
```

#### 典型场景示例

```
order-service     + feishu    → 订单团队飞书群 Webhook A
payment-service   + feishu    → 支付团队飞书群 Webhook B
order-service     + dingtalk   → 订单团队钉钉群 Webhook C
其他未配置的服务               → 全局飞书 Webhook (application.yaml 中配置)
```

### 7.6 配置大模型 (LLM)

AIEA 使用 OpenAI 兼容协议调用大模型进行根因分析，需配置 Base URL、API Key、模型名称。

#### 方式一：在 application.yaml 中配置

编辑 `src/main/resources/application.yaml`，填写 `llm.*` 配置项：

```yaml
llm:
  base-url: https://dashscope.aliyuncs.com/compatible-mode/v1   # LLM API 地址（OpenAI 兼容格式）
  api-key: sk-xxx                                               # API Key
  model: qwen-plus                                              # 模型名称
  timeout: 30000                                                # 超时时间（毫秒）
  analysis-cache-ttl: 3600                                       # 同指纹分析缓存 TTL（秒），0=不缓存
```

> 配置后重启服务生效。也可通过前端页面或 API 在线热更新，无需重启。

#### 方式二：通过前端页面配置（推荐，无需重启）

在前端「系统配置」页面：

1. 填写 **Base URL**、**API Key**、**模型名称**、**缓存 TTL**
2. 点击保存，立即生效（写入 `system_config` 表，优先级高于 yaml）
3. 点击「LLM 连通性测试」发送一条测试消息，验证 API 是否可达

#### 方式三：通过 API 配置

```bash
# 查看当前 LLM 配置（API Key 脱敏，仅返回是否已配置）
curl http://<aiea-server>:8080/api/v1/llm-config

# 更新 LLM 配置（立即生效，无需重启）
curl -X PUT http://<aiea-server>:8080/api/v1/llm-config \
  -H "Content-Type: application/json" \
  -d '{
    "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1",
    "apiKey": "sk-xxx",
    "model": "qwen-plus",
    "analysisCacheTtl": 3600
  }'

# 测试 LLM 连通性（发送「你好」并返回模型回复）
curl http://<aiea-server>:8080/api/test/llm
```

#### 配置优先级

```
DB (system_config 表) > application.yaml > 代码默认值
```

前端页面和 API 写入的配置存入 `system_config` 表，优先级最高，会覆盖 yaml 中的值。

#### 支持的 LLM 服务商

只要兼容 OpenAI `/chat/completions` 协议即可接入：

| 服务商 | Base URL | 模型示例 |
|--------|----------|----------|
| 阿里云百炼/DashScope | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-plus`、`qwen-turbo` |
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` |
| OpenAI | `https://api.openai.com/v1` | `gpt-4o`、`gpt-4o-mini` |
| 智谱 AI | `https://open.bigmodel.cn/api/paas/v4` | `glm-4` |
| 自建网关 | 公司内部 LLM 网关地址 | 按网关文档配置 |

> 如果 LLM 未配置或调用失败，系统会自动降级为规则摘要模板，不影响通知和建单流程。

---

## 8. API 接口文档

启动后访问 Swagger UI 查看完整文档：http://localhost:8080/swagger-ui.html

### 8.1 错误接入

| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| POST | `/api/v1/errors` | 上报错误事件 | X-AIEA-Token |
| GET | `/api/v1/errors` | 查询错误列表（支持 fingerprint/status 过滤） | 无 |
| GET | `/api/v1/errors/{id}` | 错误事件详情（含分析、通知、工单） | 无 |
| POST | `/api/v1/errors/{id}/retry` | 重试流水线 | 无 |

**上报请求体** (`ErrorReportRequest`)：

```json
{
  "env": "local",
  "service": "order-service",
  "message": "NullPointerException",
  "stack": "java.lang.NullPointerException\n\tat ...",
  "context": {
    "hostname": "server-01",
    "thread": "http-nio-8080-exec-1",
    "releaseVersion": "1.2.0"
  }
}
```

**上报响应** (`ErrorReportResponse`)：

```json
{
  "id": 1,
  "fingerprint": "a1b2c3d4...",
  "status": "RECEIVED",
  "suppressed": false,
  "hitCount": 0,
  "message": "错误已入库，已触发异步分析流水线"
}
```

### 8.2 服务注册与 Token 管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/service-registry` | 服务列表（Token 脱敏） |
| POST | `/api/v1/service-registry` | 注册新服务（返回完整 Token，仅一次） |
| PUT | `/api/v1/service-registry/{id}` | 更新服务（描述/启用状态） |
| DELETE | `/api/v1/service-registry/{id}` | 删除服务 |
| POST | `/api/v1/service-registry/{id}/regenerate-token` | 重置 Token（旧 Token 立即失效） |

### 8.3 内置工单

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/tickets` | 工单列表（status/assignee 过滤） |
| GET | `/api/v1/tickets/{id}` | 工单详情（含操作时间线） |
| GET | `/api/v1/tickets/by-event/{eventId}` | 按事件 ID 查工单 |
| POST | `/api/v1/tickets/{id}/claim` | 认领工单 |
| POST | `/api/v1/tickets/{id}/resolve` | 标记已解决 |
| POST | `/api/v1/tickets/{id}/close` | 关闭工单 |
| POST | `/api/v1/tickets/{id}/ignore` | 忽略工单 |
| POST | `/api/v1/tickets/{id}/reopen` | 重新打开 |
| POST | `/api/v1/tickets/{id}/priority` | 变更优先级 |

### 8.4 通知路由

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/notify-routing` | 路由规则列表 |
| POST | `/api/v1/notify-routing` | 新建路由规则 |
| PUT | `/api/v1/notify-routing/{id}` | 更新路由规则 |
| DELETE | `/api/v1/notify-routing/{id}` | 删除路由规则 |
| POST | `/api/v1/notify-routing/{id}/test` | 测试 Webhook 连通性 |

### 8.5 LLM 配置与测试

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/llm-config` | 查看 LLM 配置（API Key 脱敏） |
| PUT | `/api/v1/llm-config` | 更新 LLM 配置（立即生效） |
| GET | `/api/test/llm` | LLM 连通性测试 |
| GET | `/api/test/feishu` | 飞书机器人连通性测试 |

### 8.6 统计与管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/stats/overview` | 全局统计概览 |
| GET | `/api/v1/stats/suppress-rules` | 告警抑制规则列表 |
| PUT | `/api/v1/stats/suppress-rules/{fingerprint}/cooldown` | 更新单指纹冷却时间 |
| GET | `/api/v1/admin/config` | 运行配置视图（密钥脱敏） |

---

## 9. 配置参考

### 9.1 application.yaml 完整配置

```yaml
spring:
  application:
    name: AIEA
  datasource:
    url: jdbc:mysql://localhost:3306/aiea?useUnicode=true&characterEncoding=utf8&serverTimezone=Asia/Shanghai&useSSL=false&allowPublicKeyRetrieval=true
    username: root
    password: root
    driver-class-name: com.mysql.cj.jdbc.Driver
  jpa:
    hibernate:
      ddl-auto: none          # 不自动建表，使用 init.sql
    show-sql: false
    open-in-view: false
  data:
    redis:
      host: localhost
      port: 6379
      password:
      database: 0
      timeout: 3000ms
      lettuce:
        pool:
          max-active: 16
          max-idle: 8
          min-idle: 2
          max-wait: 2000ms

management:
  endpoints:
    web:
      exposure:
        include: health,info
  endpoint:
    health:
      show-details: always

springdoc:
  api-docs:
    path: /v3/api-docs
  swagger-ui:
    path: /swagger-ui.html

# 大模型（OpenAI 兼容协议）
llm:
  base-url: https://dashscope.aliyuncs.com/compatible-mode/v1
  api-key: sk-xxx
  model: qwen-plus
  timeout: 30000
  analysis-cache-ttl: 3600     # 同指纹分析缓存秒数，0=不缓存

# 飞书自定义机器人
feishu:
  webhook-url: https://open.feishu.cn/open-apis/bot/v2/hook/xxx

# 钉钉（可选）
dingtalk:
  webhook-url:

# Jira（可选）
jira:
  enabled: true
  base-url: https://your-domain.atlassian.net
  email: your-email@company.com
  api-token: your-api-token
  project-key: AIEA
  issue-type: Bug
  enable-for-local: false           # local 环境不建 Jira
  mock-when-unconfigured: false     # 未配置时是否 Mock

# 异步流水线
pipeline:
  enabled: true
  notify-channel: feishu           # feishu / dingtalk / none
  notify-enabled: true
  notify-max-retries: 3
  detail-base-url: http://localhost:8080

# 错误接入
ingest:
  dedup-cooldown-seconds: 120       # 去重冷却窗口（秒）
  max-stack-length: 32768
  max-message-length: 1024
  rate-limit-enabled: true
  global-qps: 100                  # 全局 QPS 上限
  per-service-qps: 20             # 每服务 QPS 上限
```

### 9.2 LLM 配置说明

LLM 配置支持运行时动态修改，**读取优先级**：DB (`system_config` 表) > `application.yaml` > 默认值。

通过前端「系统配置」页面或 `PUT /api/v1/llm-config` API 可在线修改，无需重启。

| 配置键 | 说明 |
|--------|------|
| `llm.base-url` | LLM API Base URL（OpenAI 兼容格式） |
| `llm.api-key` | API Key（永不明文返回，仅返回是否已配置） |
| `llm.model` | 模型名称 |
| `llm.analysis-cache-ttl` | 同指纹分析缓存 TTL（秒），0=不缓存 |

### 9.3 关键环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `AIEA_SERVER_URL` | Logback Appender 上报地址 | http://localhost:8080 |
| `AIEA_API_TOKEN` | Logback Appender 上报 Token | tok_demo_app_001 |
| `AIEA_ENV` | Logback Appender 环境标识 | local |

---

## 10. 前端管理控制台

### 10.1 页面导航

| 菜单 | 路由 | 功能说明 |
|------|------|----------|
| 仪表盘 | `/dashboard` | 全局统计概览：事件数、分析数、通知成功率、工单分布 |
| 错误事件 | `/errors` | 事件列表，按指纹/状态过滤 |
| 错误聚合 | `/error-groups` | 按指纹分组查看同类错误 |
| 告警规则 | `/suppress-rules` | 冷却规则、命中次数、剩余时间、调整冷却窗口 |
| 服务注册 | `/service-registry` | 注册服务、管理上报 Token |
| 通知路由 | `/notify-routing` | 多 IM 机器人路由规则、连通性测试 |
| 工单管理 | `/tickets` | 工单全生命周期管理 |
| 系统配置 | `/config` | LLM 配置、连通性测试、运行配置查看 |

### 10.2 开发与构建

```bash
# 开发模式（端口 3000，API 代理到 8080）
npm run dev

# 生产构建
npm run build

# 预览生产构建
npm run preview
```

---

## 11. 常见问题

### Q1: SDK 上报返回 401 Unauthorized

**原因**：Token 不匹配或服务未注册。

**解决**：
1. 在「服务注册」页面确认服务已注册且处于启用状态
2. 确认 SDK 配置的 `apiToken` 与注册时获取的 Token 一致
3. 如 Token 遗失，在服务注册页面点击「重置 Token」

### Q2: 同一错误反复推送群消息

**原因**：冷却窗口设置过小或 Redis 连接异常。

**解决**：
1. 在「告警规则」页面查看该指纹的冷却时间，可在线调整（1~86400 秒）
2. 检查 Redis 连接是否正常（`/actuator/health`）
3. Redis 不可用时降级为放行（不抑制），但不影响主链路

### Q3: LLM 分析返回降级摘要

**原因**：LLM API 不可达、超时或返回格式异常。

**解决**：
1. 在「系统配置」页面点击「LLM 连通性测试」验证 API 可达性
2. 确认 `llm.base-url`、`llm.api-key`、`llm.model` 配置正确
3. 确认 LLM API 兼容 OpenAI `/chat/completions` 协议
4. 分析失败时会自动降级为规则摘要，不影响通知和建单流程

### Q4: Jira 工单创建失败

**原因**：Jira 未配置或权限不足。

**解决**：
1. 确认 `jira.base-url`、`jira.email`、`jira.api-token` 配置正确
2. 确认 API Token 有创建 Issue 权限
3. 可设置 `jira.mock-when-unconfigured: true` 在未配置时返回 Mock Key
4. local 环境默认不建 Jira（`jira.enable-for-local: false`）
5. **内置工单不依赖 Jira**，即使 Jira 未配置也能正常创建和管理工单

### Q5: local 环境上报后没有触发分析和通知

**检查**：
1. 确认事件状态不是 `SUPPRESSED`（冷却窗口内重复上报会被抑制）
2. 确认 `pipeline.enabled: true`
3. 确认 `pipeline.notify-enabled: true`
4. 查看服务端日志中 `aiea-pipeline-` 线程是否有异常

### Q6: 如何区分不同环境的错误

SDK 初始化时设置 `env` 字段（`local`/`dev`/`staging`/`prod`），不同环境可：
- 配置不同的通知路由（推送到不同群）
- local 环境默认不建 Jira 工单
- 仪表盘按环境维度统计分布

---

**文档版本**: v1.0  
**最后更新**: 2026-08-06
