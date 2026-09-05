# AIEA 系统设计文档（概要设计 + 详细设计）

> **项目名称**: AIEA — AI 错误根因分析与工单自动化平台  
> **文档版本**: v1.0  
> **编制日期**: 2026-08-06  
> **文档性质**: 基于源码深度解析生成，涵盖概要设计与详细设计  
> **系统版本**: AIEA Server v0.0.1-SNAPSHOT (Spring Boot 3.3.12)

---

## 目录

- [1 文档概述](#1-文档概述)
- [2 系统总体设计（概要设计）](#2-系统总体设计概要设计)
  - [2.1 系统定位与目标](#21-系统定位与目标)
  - [2.2 系统架构设计](#22-系统架构设计)
  - [2.3 技术架构](#23-技术架构)
  - [2.4 仓库与模块划分](#24-仓库与模块划分)
  - [2.5 分层架构](#25-分层架构)
- [3 模块详细设计](#3-模块详细设计)
  - [3.1 错误接入模块（Ingest）](#31-错误接入模块ingest)
  - [3.2 堆栈指纹算法模块（Fingerprint）](#32-堆栈指纹算法模块fingerprint)
  - [3.3 Redis 去重/冷却模块（Dedup）](#33-redis-去重冷却模块dedup)
  - [3.4 Redis 限流模块（RateLimiter）](#34-redis-限流模块ratelimiter)
  - [3.5 AI 根因分析模块（Analyze）](#35-ai-根因分析模块analyze)
  - [3.6 异步流水线模块（Pipeline）](#36-异步流水线模块pipeline)
  - [3.7 协作通知模块（Notify）](#37-协作通知模块notify)
  - [3.8 工单管理模块（Ticket）](#38-工单管理模块ticket)
  - [3.9 动态配置模块（SystemConfig）](#39-动态配置模块systemconfig)
  - [3.10 敏感信息脱敏模块（Sanitizer）](#310-敏感信息脱敏模块sanitizer)
  - [3.11 Logback Appender 模块](#311-logback-appender-模块)
  - [3.12 SDK 模块（aiea-sdk）](#312-sdk-模块aiea-sdk)
  - [3.13 前端管理控制台模块（Frontend）](#33-前端管理控制台模块frontend)
- [4 数据库设计](#4-数据库设计)
- [5 Redis 数据结构设计](#5-redis-数据结构设计)
- [6 接口设计](#6-接口设计)
- [7 关键流程设计](#7-关键流程设计)
- [8 状态机设计](#8-状态机设计)
- [9 非功能性设计](#9-非功能性设计)
- [10 安全设计](#10-安全设计)
- [11 降级与容灾设计](#11-降级与容灾设计)
- [12 部署架构](#12-部署架构)

---

## 1 文档概述

本文档基于对 AIEA 项目全部源码的逐文件深度分析编写，涵盖系统的概要设计与详细设计两个层级。

**分析范围**：

| 层级 | 分析内容 | 源码文件数 |
|------|---------|-----------|
| 后端主服务 | Controller / Service / Entity / Repository / Config / Integration / Util / Logback | 40+ |
| SDK | `Aiea.java` / `AieaConfig.java` | 2 |
| 前端 | React SPA（10 个页面） | 12+ |
| 数据库 | 10 张表 DDL + 索引 + 约束 | 1 (init.sql) |
| 配置 | application.yaml + 9 个 Properties 类 | 10 |

---

## 2 系统总体设计（概要设计）

### 2.1 系统定位与目标

**产品定位**：AIEA 是一款面向研发团队的 **AI 驱动的异常全生命周期管理平台**，将「异常捕获 → 智能去重 → AI 根因分析 → 群聊通知 → 工单闭环」全流程自动化。

**核心目标**：

| 目标 | 度量标准 |
|------|---------|
| 异常自动捕获 | SDK / Logback Appender / HTTP API 三模接入，零侵入上报 |
| 同类错误智能归并 | 堆栈归一化 SHA-256 指纹 + Redis 冷却窗口，冷却期内自动合并 |
| AI 根因分析 | 调用 OpenAI 兼容大模型生成结构化 JSON 报告（根因/建议/置信度） |
| 协作通知自动化 | 飞书/钉钉卡片消息自动推送，支持服务级路由 |
| 工单闭环管理 | 内置工单全生命周期（AI 标题 + 智能定级 + 认领/解决/关闭/重开） |
| 管理控制台 | React Web UI 可视化管理全部配置与运营数据 |

### 2.2 系统架构设计

```
┌─────────────────┐   ┌──────────────────────┐   ┌──────────────────┐
│ 业务 Java 服务   │   │ 本地服务 / 存量系统   │   │ 非 Java 系统      │
│  + aiea-sdk     │   │  + Logback Appender  │   │ (Python/Go/Node) │
└────────┬────────┘   └──────────┬───────────┘   └────────┬─────────┘
         │ HTTP 上报             │ HTTP 上报              │ HTTP 上报
         └───────────┬───────────┘                      │
                     ▼                                    │
         ┌───────────────────────┐                        │
         │     AIEA Server       │◄───────────────────────┘
         │  (Spring Boot 3.3)    │
         │                       │
         │  ┌─ 接入层 ──────────┐│
         │  │ 鉴权→限流→脱敏     ││
         │  │ →指纹→去重→落库   ││
         │  └───────┬───────────┘│
         │          │ 事务提交后  │
         │  ┌───────▼───────────┐│
         │  │ 异步流水线         ││
         │  │ LLM分析→建单→通知  ││
         │  └───────┬───────────┘│
         └──────────┼────────────┘
                    │
     ┌──────────────┼──────────────┬────────────┐
     ▼              ▼              ▼            ▼
  MySQL 8       Redis 7       LLM API      飞书/钉钉
                (冷却/限流/    (OpenAI       Jira(可选)
                 分析缓存)      兼容协议)
```

**架构特点**：

1. **单体应用，内部模块化**：Spring Boot 单体部署，内部分为接入层、分析层、工单层、通知层，通过 Service 依赖注入协作
2. **同步快通道 + 异步流水线**：上报请求仅做鉴权/限流/脱敏/指纹/去重/落库（目标 P99 < 200ms），AI 分析/建单/通知全部异步
3. **Redis 为辅、DB 为主**：Redis 负责实时去重/限流/缓存，DB 负责持久化与审计，Redis 故障时自动降级
4. **事务后触发**：异步流水线通过 `TransactionSynchronizationManager.registerSynchronization()` 在事务 `afterCommit` 回调中触发，避免异步线程读不到未提交数据

### 2.3 技术架构

| 层级 | 选型 | 版本 | 设计考量 |
|------|------|------|---------|
| **语言** | Java | 17 (LTS) | Server 要求 17+；SDK 兼容 Java 8+ |
| **框架** | Spring Boot | 3.3.12 | 主服务框架，Jakarta EE 9+ |
| **构建** | Maven | 3.8+ | 多模块依赖管理 |
| **ORM** | Spring Data JPA | — | CRUD 快速开发，`ddl-auto: none` |
| **数据库** | MySQL | 8.0 | InnoDB + utf8mb4，结构化存储 |
| **缓存** | Redis (Lettuce) | 6.0+ | 指纹冷却、限流、LLM 分析缓存 |
| **异步** | `@Async` + ThreadPoolTaskExecutor | — | 独立线程池 `pipelineExecutor`，不阻塞上报 |
| **API 文档** | springdoc-openapi | 2.6.0 | Swagger UI 自动生成 |
| **参数校验** | Jakarta Validation | — | `@Valid` + `@NotBlank` 等 |
| **健康检查** | Spring Actuator | — | `/actuator/health` |
| **LLM** | OpenAI 兼容协议 | — | `/chat/completions`，供应商无关 |
| **IM 推送** | 飞书 / 钉钉 Webhook | — | 自定义机器人，REST API |
| **工单** | Jira REST API v2（可选） | — | Basic Auth，Cloud/Server |
| **前端** | React 18 + Vite 4 + Ant Design 5 | — | SPA 管理控制台 |
| **SDK HTTP** | HttpURLConnection | — | 无 Spring 依赖，兼容 Java 8 |
| **JSON** | Jackson | 2.x | 全栈序列化/反序列化 |

### 2.4 仓库与模块划分

```
ai开发比赛/
├── AIEA/                          # 主服务 (Spring Boot 3.3)
│   └── src/main/java/com/yzk/aiea/
│       ├── AieaApplication.java          # 启动类
│       ├── config/                       # 9 个配置类
│       ├── controller/                   # 10 个 Controller
│       ├── dto/                          # 3 个请求/响应 DTO
│       ├── entity/                       # 10 个 JPA 实体
│       ├── integration/                  # 4 个外部集成客户端
│       ├── logback/                      # Logback Appender
│       ├── repository/                   # 10 个 JPA Repository
│       ├── service/                      # 12 个核心 Service
│       │   ├── ingest/                   # 错误接入
│       │   ├── fingerprint/              # 指纹算法
│       │   ├── analyze/                  # LLM 根因分析
│       │   ├── notify/                   # 协作通知
│       │   ├── ticket/                   # 工单服务（内置 + Jira）
│       │   ├── pipeline/                 # 异步流水线
│       │   └── redis/                    # Redis 服务（去重/限流/缓存）
│       └── util/                         # 敏感信息脱敏工具
│
├── aiea-sdk/                      # 轻量错误上报 SDK
│   └── src/main/java/com/yzk/aiea/sdk/
│       ├── Aiea.java                     # SDK 主入口
│       └── AieaConfig.java               # SDK 配置 (Builder)
│
├── frontend/                      # 管理控制台 (React + Vite)
│   └── src/
│       ├── App.jsx                       # 路由
│       ├── api.js                        # API 封装
│       ├── components/MainLayout.jsx     # 布局
│       └── pages/                        # 10 个页面
│
└── docs/                          # 文档目录
```

### 2.5 分层架构

```
┌─────────────────────────────────────────────────────────────────┐
│                      前端管理控制台 (React SPA)                   │
│              Dashboard / ErrorList / Tickets / Config            │
├─────────────────────────────────────────────────────────────────┤
│                      API 层 (REST Controller)                    │
│   IngestController / EventQueryController / TicketController     │
│   ServiceRegistryController / NotifyRoutingController            │
│   LlmConfigController / StatsController / AdminController        │
├─────────────────────────────────────────────────────────────────┤
│                      业务服务层 (Service)                         │
│  ┌─────────────┐ ┌──────────────┐ ┌──────────────────────────┐ │
│  │ 接入层       │ │ 分析层       │ │ 工单层                    │ │
│  │ IngestSvc   │ │ AnalyzeSvc   │ │ InternalTicketSvc        │ │
│  │ Fingerprint │ │ LlmClient    │ │ TicketSvc (Jira)         │ │
│  │ DedupSvc    │ │ CacheSvc     │ │                          │ │
│  │ RateLimiter │ │              │ │                          │ │
│  └─────────────┘ └──────────────┘ └──────────────────────────┘ │
│  ┌─────────────┐ ┌──────────────┐ ┌──────────────────────────┐ │
│  │ 通知层       │ │ 流水线层     │ │ 配置层                    │ │
│  │ NotifySvc   │ │ PipelineSvc  │ │ SystemConfigSvc          │ │
│  │ FeishuClient│ │ (@Async)     │ │ SensitiveSanitizer       │ │
│  │ DingTalkCli │ │              │ │                          │ │
│  └─────────────┘ └──────────────┘ └──────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│                      数据访问层 (Repository)                      │
│           10 个 Spring Data JPA Repository 接口                  │
├─────────────────────────────────────────────────────────────────┤
│                      存储层 (Storage)                            │
│        MySQL 8 (10 张表)     │     Redis 7 (3 类 Key)          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3 模块详细设计

### 3.1 错误接入模块（Ingest）

**类**: `IngestService`  
**包**: `com.yzk.aiea.service.ingest`  
**职责**: 错误上报的核心入口，编排完整的同步处理链

#### 处理流程（详细设计）

```
ErrorReportRequest 输入
    │
    ▼
┌──────────────────────────────────────────────────────┐
│ Step 0: 限流检查                                       │
│  RateLimiterService.allowRequest(service,             │
│    globalQps=100, perServiceQps=20)                   │
│  超限 → 抛 ResponseStatusException(429)               │
└──────────────────────┬───────────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────────┐
│ Step 1: 脱敏 + 截断                                    │
│  message = SensitiveDataSanitizer.sanitize(message)   │
│  stack   = SensitiveDataSanitizer.sanitize(stack)     │
│  截断: message ≤ 1024 字符, stack ≤ 32768 字符         │
└──────────────────────┬───────────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────────┐
│ Step 2: 指纹计算                                       │
│  fingerprint = FingerprintService.generate(           │
│      service, message, stack)                         │
│  → SHA-256 64 字符十六进制指纹                         │
└──────────────────────┬───────────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────────┐
│ Step 3: Redis 去重/冷却检查                             │
│  cooldownSec = resolveCooldown(fingerprint)           │
│    → DB suppress_rule 自定义值 / 全局默认 120s         │
│  DedupResult = RedisDedupService.checkAndMark(        │
│      fingerprint, cooldownSec)                        │
│  suppressed = dedupResult.suppressed()                │
│  hitCount   = dedupResult.hitCount()                  │
└──────────────────────┬───────────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────────┐
│ Step 4: DB 审计记录                                    │
│  persistSuppressAudit(fingerprint, suppressed,        │
│      hitCount)                                        │
│  → 写入/更新 suppress_rule 表（审计追溯）              │
└──────────────────────┬───────────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────────┐
│ Step 5: 落库 error_event                               │
│  status = suppressed ? "SUPPRESSED" : "RECEIVED"     │
│  errorEventRepository.save(event)                     │
│                                                       │
│  if (suppressed):                                     │
│    internalTicketService.recordRecurrence(            │
│        fingerprint, hitCount)                         │
│    → 复发记录 + 自动重开已解决工单                      │
└──────────────────────┬───────────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────────┐
│ Step 6: 异步流水线触发（仅未抑制事件）                   │
│  TransactionSynchronizationManager                    │
│    .registerSynchronization(afterCommit {              │
│        errorPipelineService.processAsync(eventId)     │
│    })                                                 │
│  → 确保事务提交后异步线程能读到数据                      │
└──────────────────────┬───────────────────────────────┘
                       ▼
              返回 ErrorReportResponse
              {id, fingerprint, status, suppressed, hitCount}
```

**关键设计决策**：

| 决策 | 原因 |
|------|------|
| 抑制事件也入库（状态 `SUPPRESSED`） | 避免状态停留在 `RECEIVED` 让用户误以为还在处理中；保留完整审计链 |
| 冷却时间优先读 DB 自定义值 | 允许运维对特定高频指纹单独调大冷却窗口 |
| 审计记录写入失败不阻断主流程 | `try-catch` 包裹，仅 `log.warn` |
| 事务后触发异步流水线 | `afterCommit` 回调确保异步线程读到已提交数据 |

#### 鉴权设计（IngestController）

```
请求: POST /api/v1/errors
Header: X-AIEA-Token: tok_xxx
Body:   { "service": "order-service", ... }

鉴权逻辑:
  1. Token 缺失 → 401 Unauthorized
  2. 服务未注册 → 401 Unauthorized
  3. 服务已禁用 (enabled=0) → 403 Forbidden
  4. Token 不匹配 → 401 Unauthorized
  5. 鉴权通过 → 进入 IngestService
```

### 3.2 堆栈指纹算法模块（Fingerprint）

**类**: `FingerprintService`  
**包**: `com.yzk.aiea.service.fingerprint`  
**职责**: 对堆栈进行归一化处理后生成 SHA-256 指纹

#### 归一化算法（详细设计）

```
输入: service + "|" + message + "|" + stack
                    │
                    ▼
         ┌──────────────────────┐
         │ 去除 Java 行号         │
         │ (Bar.java:123)        │
         │ → (Bar.java)          │
         └──────────┬───────────┘
                    ▼
         ┌──────────────────────┐
         │ 去除 UUID             │
         │ [0-9a-f]{8}-...       │
         │ → <uuid>              │
         └──────────┬───────────┘
                    ▼
         ┌──────────────────────┐
         │ 去除十六进制地址       │
         │ 0x[0-9a-f]+           │
         │ → <hex>               │
         └──────────┬───────────┘
                    ▼
         ┌──────────────────────┐
         │ 去除时间戳             │
         │ 2026-08-03T12:34:56   │
         │ → <ts>                │
         └──────────┬───────────┘
                    ▼
         ┌──────────────────────┐
         │ 去除纯数字行号引用     │
         │ :123 → :n             │
         └──────────┬───────────┘
                    ▼
         归一化字符串
                    │
                    ▼
         SHA-256 → 64 字符十六进制指纹
```

**设计考量**：

- 同一根因的异常（行号变化、UUID 变化、时间戳变化）产生**相同指纹**
- 指纹用于：去重冷却、分析缓存、工单复用、错误聚合
- `service` 参与指纹计算：不同服务的相同异常消息视为不同错误

### 3.3 Redis 去重/冷却模块（Dedup）

**类**: `RedisDedupService`  
**包**: `com.yzk.aiea.service.redis`  
**职责**: 基于 Redis 实现指纹级冷却窗口去重

#### 算法设计

```
Key:  aiea:dedup:{fingerprint}
Type: String (计数器)

首次上报:
  SET aiea:dedup:{fp} "0" NX EX {cooldown_sec}
  → acquired = true → 未被抑制，hitCount = 0

冷却窗口内重复:
  SET NX 失败（key 已存在）
  → INCR aiea:dedup:{fp} → hitCount = N
  → suppressed = true

窗口过期后:
  Key 自动删除 → 下一次上报视为首次
```

**降级策略**：Redis 不可用时返回 `DedupResult(false, 0)`（放行不抑制），保证主链路不中断。

**冷却时间解析**：

```
resolveCooldown(fingerprint):
  1. 查 DB suppress_rule 表该指纹的自定义 cooldown_sec
  2. 有自定义值且 > 0 → 使用自定义值
  3. 否则 → 使用全局配置 ingest.dedup-cooldown-seconds (默认 120s)
```

### 3.4 Redis 限流模块（RateLimiter）

**类**: `RateLimiterService`  
**包**: `com.yzk.aiea.service.redis`  
**职责**: 全局 QPS + 每服务 QPS 双重限流（固定窗口算法）

#### 算法设计

```
全局限流:
  Key:  aiea:ratelimit:global:{timestamp_second}
  INCR key → count
  if count == 1: EXPIRE key 1s
  if count > globalQps(100): 拒绝

每服务限流:
  Key:  aiea:ratelimit:svc:{service}:{timestamp_second}
  INCR key → count
  if count == 1: EXPIRE key 1s
  if count > perServiceQps(20): 拒绝

双重检查: 全局通过 ∧ 服务通过 → 放行
```

**降级策略**：Redis 不可用时 `return true`（放行不限流）。

### 3.5 AI 根因分析模块（Analyze）

**类**: `AnalyzeService`  
**包**: `com.yzk.aiea.service.analyze`  
**职责**: 调用大模型生成结构化根因分析报告

#### 分析优先级（三级缓存）

```
                  分析请求
                     │
                     ▼
          ┌──────────────────────┐
          │ Level 1: DB 去重      │
          │ 同 eventId 已分析过？  │
          │ → 是: 直接返回         │
          └──────────┬───────────┘
                     ▼
          ┌──────────────────────┐
          │ Level 2: Redis 缓存   │
          │ 同指纹缓存命中？       │
          │ → 是: 复用结果         │
          │   (节省 LLM Token)    │
          └──────────┬───────────┘
                     ▼
          ┌──────────────────────┐
          │ Level 3: 调用 LLM     │
          │ OpenAI 兼容协议       │
          │ → 落库 + 写缓存        │
          └──────────────────────┘
```

#### LLM Prompt 设计

**System Prompt**:
```
你是资深 Java 线上故障排查专家。请仅基于用户提供的异常信息做根因分析。
若信息不足，明确写出不确定点与建议补充的排查项。
禁止虚构不存在的类/方法。不要给出删库、关闭鉴权等高危操作。
必须只输出一个 JSON 对象，字段如下：
{
  "root_cause": "根因说明",
  "impact": "影响面",
  "suggestions": ["修复建议1", "修复建议2", "修复建议3"],
  "related_files": ["可能相关文件或类"],
  "confidence": 0.0,
  "need_more_info": ["如需补充的信息"]
}
confidence 取值 0~1。
```

**User Prompt 构建**:
```
service: {event.service}
env: {event.env}
fingerprint: {event.fingerprint}
message: {sanitized message}
stack: {sanitized stack}
context: {sanitized context_json}  (可选)
```

#### LLM 响应解析与容错

```
LLM 返回 raw
    │
    ▼
parseJsonContent(raw):
  1. 去除 ``` 代码块标记
  2. 提取 { ... } JSON 部分
  3. Jackson 解析
    │
    ├─ 解析成功 → 提取 root_cause / suggestions / confidence
    │             → 如果 root_cause 为空 → fillFallback
    │
    └─ 解析失败 → 重试一次（附加提示"请只输出合法 JSON"）
         │
         ├─ 重试成功 → 正常解析
         └─ 重试失败 → fillFallback（降级摘要）
```

#### 降级摘要模板（fillFallback）

```json
{
  "root_cause": "LLM 调用失败或超时，已降级为规则摘要。异常摘要: {message}",
  "suggestions": [
    "核对近期发布与配置变更",
    "根据堆栈定位首个业务包帧并加日志复现",
    "检查依赖服务/DB/缓存可用性"
  ],
  "confidence": 0.2000
}
```

#### LLM 客户端（LlmClient）

**类**: `LlmClient`  
**包**: `com.yzk.aiea.integration`

```
调用协议: POST {base-url}/chat/completions
请求体:
{
  "model": "{configService.getLlmModel()}",
  "temperature": 0.2,
  "messages": [
    {"role": "system", "content": "{systemPrompt}"},
    {"role": "user", "content": "{userPrompt}"}
  ]
}
Header: Authorization: Bearer {configService.getLlmApiKey()}

响应解析: choices[0].message.content → 文本内容
```

**配置来源**：`SystemConfigService`（DB 优先 > yaml > 默认值），支持运行时热更新。

### 3.6 异步流水线模块（Pipeline）

**类**: `ErrorPipelineService`  
**包**: `com.yzk.aiea.service.pipeline`  
**职责**: 编排「分析 → 建单 → 通知」异步闭环

#### 线程池配置（AsyncConfig）

```java
@Bean(name = "pipelineExecutor")
Executor pipelineExecutor() {
    ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
    executor.setCorePoolSize(2);       // 核心线程数
    executor.setMaxPoolSize(8);       // 最大线程数
    executor.setQueueCapacity(200);   // 队列容量
    executor.setThreadNamePrefix("aiea-pipeline-");
    return executor;
}
```

#### 流水线执行流程

```
@Async("pipelineExecutor")
processAsync(eventId):
    │
    ├─ pipeline.enabled == false → 跳过
    │
    ▼
process(eventId):
    │
    ├─ 1. 加载事件，状态 → ANALYZING
    │
    ├─ 2. AnalyzeService.analyze(event) → AnalysisResult
    │      (三级缓存: DB → Redis → LLM)
    │
    ├─ 3. InternalTicketService.createOrReuse(event, analysis)
    │      (同指纹未关闭工单复用, 否则 AI 标题 + 智能定级创建)
    │      catch: 失败仅 warn，不阻断
    │
    ├─ 4. TicketService.createOrReuse(event, analysis)  [可选 Jira]
    │      (local 环境跳过, 同指纹幂等复用)
    │      catch: 失败仅 warn，不阻断
    │      → 成功: 状态 → TICKETED
    │
    ├─ 5. mergedHits = RedisDedupService.getHitCount(fingerprint)
    │      (从 Redis 获取冷却窗口内合并次数)
    │
    ├─ 6. NotifyService.notify(event, analysis, ticket, mergedHits)
    │      (飞书/钉钉卡片消息, 路由规则, 重试)
    │      → 成功: 状态 → NOTIFIED
    │      → 失败且无工单: 状态 → FAILED
    │      → 失败但有工单: 保持 TICKETED
    │
    └─ 7. 保存最终状态

异常处理:
    catch(Exception) → markFailed(eventId) → 状态 → FAILED
```

**状态优先级**：`NOTIFIED` > `TICKETED` > `FAILED`

### 3.7 协作通知模块（Notify）

**类**: `NotifyService`  
**包**: `com.yzk.aiea.service.notify`  
**职责**: 飞书/钉钉群聊消息推送，支持服务级路由与重试

#### 路由匹配逻辑

```
通知请求 (event, analysis, ticket, mergedHits)
    │
    ▼
查询 notify_routing 表
  findByServiceAndChannel(event.service, channel)
    │
    ├─ 匹配到且 enabled=true 且 webhookUrl 非空
    │   → 使用专属 Webhook (routeSource = "service:xxx,channel:yyy")
    │
    └─ 未匹配 / 已禁用 / webhookUrl 为空
        → fallback 到全局 Webhook
           feishu  → feishu.webhook-url (application.yaml)
           dingtalk → dingtalk.webhook-url (application.yaml)
```

#### 消息内容构建

```
**环境**: {event.env}
**服务**: {event.service}
**摘要**: {sanitized event.message}
**合并次数**: {mergedHits}        ← 仅 mergedHits > 0 时显示
**根因(AI)**: {analysis.rootCause}
**建议**: {analysis.suggestions}
**置信度**: {analysis.confidence}（AI 建议，需人工确认）
**Jira**: [{jiraKey}]({jiraUrl})  ← 仅 Jira 工单存在时显示
**详情**: {detailBaseUrl}/api/v1/errors/{eventId}
```

#### 推送重试机制

```
maxRetries = pipeline.notify-max-retries (默认 3)

for (int i = 1; i <= maxRetries; i++):
    result = channel == "dingtalk"
        ? DingTalkClient.sendMarkdown(title, content, webhookUrl)
        : FeishuClient.sendCard(title, content, webhookUrl)
    if (result.success == true):
        break
    else:
        log.warn("通知失败 attempt={}/{}", i, maxRetries)
```

#### 通知记录落库

每次推送后记录 `notify_record`：
- `event_id`: 关联事件
- `channel`: feishu / dingtalk
- `payload`: JSON（title + content + routeSource + webhookUrl前80字符 + result）
- `http_status`: HTTP 状态码
- `sent_at`: 发送时间

#### 飞书客户端（FeishuClient）

```
消息类型: interactive (交互卡片)
卡片结构:
{
  "header": {
    "title": { "tag": "plain_text", "content": "AIEA 错误根因分析" },
    "template": "green"
  },
  "elements": [{
    "tag": "div",
    "text": { "tag": "lark_md", "content": "{markdown content}" }
  }]
}
请求体: { "msg_type": "interactive", "card": {card} }
成功判定: response.code == 0
```

### 3.8 工单管理模块（Ticket）

#### 3.8.1 内置工单服务（InternalTicketService）

**类**: `InternalTicketService`  
**包**: `com.yzk.aiea.service.ticket`

##### 创建/复用逻辑

```
createOrReuse(event, analysis):
    │
    ├─ 查找同指纹且状态不在 [CLOSED, IGNORED] 的工单
    │   findFirstByFingerprintAndStatusNotIn(fp, ["CLOSED","IGNORED"])
    │
    ├─ 存在 → 复用，返回已有工单
    │
    └─ 不存在 → 创建新工单:
         title  = buildAiTitle(event, analysis)  ← LLM 生成, 失败降级
         status = "OPEN"
         priority = judgePriority(event)         ← 关键词智能定级
         → 记录 CREATE 日志
```

##### AI 工单标题生成

```
buildAiTitle(event, analysis):
    System Prompt: "你是一个工单标题生成助手。根据错误信息生成一个简短明了的
                    中文工单标题，不超过30个字..."
    User Prompt: 服务 + 环境 + 异常类型 + 堆栈摘要(前500字) + AI根因分析
    
    LLM 返回 → 清理引号/换行 → 截断至50字
    失败/空 → 降级: "[{env}][{service}] {message前120字}"
```

##### 智能优先级判定

```
judgePriority(event):
    message = event.message.toLowerCase()
    
    contains("outofmemory" | "oom" | "deadlock") → P0
    contains("nullpointer" | "sqlexception" | "connection") → P1
    其他 → P2
```

##### 错误复发自动重开

```
recordRecurrence(fingerprint, hitCount):
    │
    ├─ 查找同指纹未关闭工单
    │
    ├─ 不存在 → return（不创建新工单）
    │
    ├─ 工单状态 == RESOLVED:
    │   → 自动重开: status → IN_PROGRESS
    │   → 清空 resolvedAt / closedAt
    │   → 记录 REOPEN 日志: "错误再次发生（冷却窗口内第N次合并），自动重开工单"
    │
    └─ 工单状态 == OPEN / IN_PROGRESS:
        → 追加 RECURRENCE 日志: "错误再次发生（冷却窗口内第N次合并）"
```

##### 工单操作全流程

| 操作 | 方法 | 状态变更 | 日志 action |
|------|------|---------|------------|
| 认领 | `claim(ticketId, assignee)` | OPEN → IN_PROGRESS | CLAIM + STATUS |
| 解决 | `resolve(ticketId, resolution, operator)` | → RESOLVED | RESOLVE |
| 关闭 | `close(ticketId, operator)` | → CLOSED | CLOSE |
| 忽略 | `ignore(ticketId, operator, remark)` | → IGNORED | IGNORE |
| 重开 | `reopen(ticketId, operator, remark)` | → IN_PROGRESS | REOPEN |
| 变更优先级 | `changePriority(ticketId, priority, operator)` | 不变 | PRIORITY |
| 复发记录 | `recordRecurrence(fingerprint, hitCount)` | RESOLVED → IN_PROGRESS | REOPEN / RECURRENCE |

每次操作均写入 `ticket_log` 表，形成完整的操作时间线。

#### 3.8.2 Jira 建单服务（TicketService）

**类**: `TicketService`  
**包**: `com.yzk.aiea.service.ticket`

```
createOrReuse(event, analysis):
    │
    ├─ local 环境 && !jira.enable-for-local → 跳过
    │
    ├─ 同指纹已有 Jira 工单 → 复用
    │   (遍历同指纹事件 → 查 jira_ticket 表)
    │
    └─ 创建新 Jira Issue:
         summary = "[{env}][{service}] {message前180字}"
         description = 自动构建（含 AI 分析 + 堆栈）
         labels = ["aiea", "{env}", "{service}"]
         → JiraClient.createIssue(summary, description, labels)
         → 保存 jira_ticket 记录
```

### 3.9 动态配置模块（SystemConfig）

**类**: `SystemConfigService`  
**包**: `com.yzk.aiea.service`

#### 配置优先级体系

```
读取优先级: DB (system_config 表) > application.yaml > 代码默认值

getLlmBaseUrl():
  1. 查 DB: SELECT config_value FROM system_config WHERE config_key = 'llm.base-url'
  2. DB 有值且非空 → 返回 DB 值
  3. 否则 → 返回 LlmProperties.getBaseUrl() (yaml 配置)

getLlmApiKey():
  1. 查 DB: 'llm.api-key'
  2. DB 有值 → 返回 DB 值
  3. 否则 → 返回 yaml 值

getLlmModel():
  1. 查 DB: 'llm.model'
  2. DB 有值 → 返回 DB 值
  3. 否则 → 返回 yaml 值

getLlmAnalysisCacheTtl():
  1. 查 DB: 'llm.analysis-cache-ttl'
  2. DB 有值且可解析为整数 → 返回 DB 值
  3. 否则 → 返回 yaml 值
```

#### 配置热更新

```java
updateLlmConfig(baseUrl, apiKey, model, cacheTtl):
    // 每个参数: null/空 = 不修改, 非空 = 更新
    // 写入 system_config 表 (upsert)
    // 立即生效，无需重启
```

**已知配置键**:

| config_key | 说明 | 示例值 |
|------------|------|--------|
| `llm.base-url` | LLM API Base URL | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| `llm.api-key` | LLM API Key | `sk-xxx` |
| `llm.model` | LLM 模型名称 | `qwen-plus` |
| `llm.analysis-cache-ttl` | 分析缓存 TTL（秒） | `3600` |

### 3.10 敏感信息脱敏模块（Sanitizer）

**类**: `SensitiveDataSanitizer`  
**包**: `com.yzk.aiea.util`

#### 脱敏规则

| 序号 | 正则模式 | 替换为 | 说明 |
|------|---------|--------|------|
| 1 | `(?i)(bearer\s+)[a-zA-Z0-9._\-]+` | `$1***` | Bearer Token |
| 2 | `(?i)(password\|passwd\|pwd\|secret\|api[_-]?key\|token\|authorization)\s*[=:]\s*[^\s,;"']+` | `$1=***` | 密码/密钥键值对 |
| 3 | `[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}` | `***@***.***` | 邮箱地址 |
| 4 | `(?<!\d)1[3-9]\d{9}(?!\d)` | `***********` | 手机号 |

**双层脱敏**：
- SDK 侧（`Aiea.sanitize()`）：Bearer Token + password/token/api_key
- 服务端侧（`SensitiveDataSanitizer.sanitize()`）：SDK 脱敏 + 邮箱 + 手机号

### 3.11 Logback Appender 模块

**类**: `AieaLogbackAppender`  
**包**: `com.yzk.aiea.logback`

**设计特点**：

| 特性 | 实现 |
|------|------|
| 零侵入 | 仅修改 `logback.xml` 配置，不改业务代码 |
| 异步上报 | 单线程守护线程池 (`aiea-logback-appender`) |
| ERROR 级别过滤 | `event.getLevel().isGreaterOrEqual(Level.ERROR)` |
| 堆栈截断 | 32000 字符 |
| 消息截断 | 1024 字符 |
| 上下文采集 | logger 名、线程名、MDC |
| 异常静默 | 上报失败不抛异常，不影响业务日志 |

**配置方式**：

```xml
<appender name="AIEA" class="com.yzk.aiea.logback.AieaLogbackAppender">
    <serverUrl>http://localhost:8080</serverUrl>
    <apiToken>tok_xxx</apiToken>
    <service>order-service</service>
    <env>prod</env>
</appender>
```

### 3.12 SDK 模块（aiea-sdk）

**类**: `Aiea` / `AieaConfig`  
**包**: `com.yzk.aiea.sdk`

**设计约束**：

| 约束 | 实现 |
|------|------|
| 无 Spring 依赖 | 仅依赖 Jackson (`jackson-databind`) |
| 兼容 Java 8+ | `maven.compiler.source=1.8` |
| 异步不阻塞 | 2 线程守护线程池 (`aiea-sdk-reporter`) |
| 内置脱敏 | Bearer Token + password/token/api_key |
| 堆栈截断 | 32000 字符 |
| HTTP 客户端 | `HttpURLConnection`（JDK 原生） |

**API 设计**：

```java
// 初始化（一次性）
Aiea.init(AieaConfig.builder()
    .serverUrl("http://localhost:8080")
    .apiToken("tok_xxx")
    .service("order-service")
    .env("local")
    .releaseVersion("1.2.0")
    .build());

// 手动捕获上报
Aiea.capture(exception);

// 携带额外上下文上报
Aiea.capture(exception, Map.of("userId", "123", "traceId", "abc"));
```

**上报数据结构**：

```json
{
  "env": "local",
  "service": "order-service",
  "message": "NullPointerException: ...",
  "stack": "java.lang.NullPointerException\n\tat ...",
  "context": {
    "hostname": "prod-server-01",
    "thread": "http-nio-8080-exec-1",
    "releaseVersion": "1.2.0",
    "userId": "123",
    "traceId": "abc"
  }
}
```

### 3.13 前端管理控制台模块（Frontend）

**技术栈**: React 18 + Vite 4 + Ant Design 5 + React Router 6 + Axios + Recharts + Day.js

#### 路由设计

| 路由 | 页面组件 | 功能 |
|------|---------|------|
| `/dashboard` | Dashboard | 全局统计概览、7天趋势、错误热力图、智能洞察 |
| `/errors` | ErrorList | 错误事件列表（指纹/状态过滤、搜索） |
| `/errors/:id` | ErrorDetail | 错误详情（AI分析+通知+工单+重试） |
| `/error-groups` | ErrorGroups | 按指纹分组聚合 |
| `/suppress-rules` | SuppressRules | 告警冷却规则管理 |
| `/service-registry` | ServiceRegistry | 服务注册与 Token 管理 |
| `/notify-routing` | NotifyRouting | 通知路由规则管理 |
| `/tickets` | Tickets | 工单列表 |
| `/tickets/:id` | TicketDetail | 工单详情（时间线+修复提示词） |
| `/config` | Config | 系统配置（LLM/连通性测试） |

**开发代理**: Vite 配置 `proxy` 将 `/api` 请求代理到 `http://localhost:8080`

---

## 4 数据库设计

### 4.1 数据库基本信息

| 属性 | 值 |
|------|-----|
| 数据库 | MySQL 8.0 |
| 字符集 | utf8mb4 |
| 排序规则 | utf8mb4_unicode_ci |
| 存储引擎 | InnoDB |
| 表数量 | 10 |
| DDL 策略 | `ddl-auto: none`（使用 init.sql 手动管理） |

### 4.2 表清单总览

| # | 表名 | 说明 | 记录数级别 | 关键关系 |
|---|------|------|-----------|---------|
| 1 | `error_event` | 错误事件主表 | 万~百万 | 核心实体，被 2/3/4/6 关联 |
| 2 | `analysis_result` | AI 根因分析结果 | 千~十万 | 1:1 → error_event |
| 3 | `notify_record` | 通知推送记录 | 千~十万 | 1:N → error_event |
| 4 | `jira_ticket` | Jira 工单关联 | 百~千 | 1:N → error_event |
| 5 | `suppress_rule` | 告警抑制规则 | 百~千 | 指纹逻辑关联 |
| 6 | `internal_ticket` | 内置工单 | 千~万 | 1:N → error_event, 1:N → ticket_log |
| 7 | `ticket_log` | 工单操作日志 | 千~万 | N:1 → internal_ticket |
| 8 | `notify_routing` | 通知路由规则 | 十~百 | service 逻辑关联 |
| 9 | `service_registry` | 服务注册与鉴权 | 十~百 | service 逻辑关联 |
| 10 | `system_config` | 系统动态配置 | 十 | 独立 |

### 4.3 分层对应

```
┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐
│  接入层      │  │  分析层       │  │  工单层                 │
│ error_event │  │ analysis_    │  │ internal_ticket        │
│             │  │   result     │  │ ticket_log             │
│             │  │              │  │ jira_ticket            │
└─────────────┘  └──────────────┘  └────────────────────────┘
┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐
│  通知层      │  │  抑制层       │  │  管理层                 │
│ notify_     │  │ suppress_    │  │ service_registry       │
│   record    │  │   rule       │  │ notify_routing         │
│             │  │              │  │ system_config          │
└─────────────┘  └──────────────┘  └────────────────────────┘
```

### 4.4 ER 关系图

```
error_event (1) ──1:1──► analysis_result
              (1) ──1:N──► notify_record
              (1) ──1:N──► jira_ticket
              (1) ──1:N──► internal_ticket (1) ──1:N──► ticket_log

suppress_rule ◄──逻辑关联── error_event.fingerprint
                           internal_ticket.fingerprint

service_registry ◄──逻辑关联── notify_routing.service
                               error_event.service
```

### 4.5 核心表结构

#### error_event（错误事件主表）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | BIGINT | PK, AUTO_INCREMENT | 主键 |
| `fingerprint` | VARCHAR(64) | NOT NULL | SHA-256 指纹 |
| `env` | VARCHAR(32) | NOT NULL, DEFAULT 'local' | 环境 |
| `service` | VARCHAR(128) | NOT NULL | 服务名 |
| `message` | VARCHAR(1024) | NULL | 异常消息 |
| `stack` | TEXT | NULL | 完整堆栈 |
| `context_json` | JSON | NULL | 上下文 JSON |
| `status` | VARCHAR(32) | NOT NULL, DEFAULT 'RECEIVED' | 状态机 |
| `created_at` | DATETIME | NOT NULL | 创建时间 |
| `updated_at` | DATETIME | NOT NULL | 更新时间 |

**索引**: `idx_fingerprint`, `idx_status`, `idx_env_service(env,service)`, `idx_created_at`

#### internal_ticket（内置工单）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | BIGINT | PK, AUTO_INCREMENT | 主键 |
| `event_id` | BIGINT | NOT NULL | 关联事件 ID |
| `fingerprint` | VARCHAR(64) | NOT NULL | 错误指纹（复用键） |
| `title` | VARCHAR(255) | NOT NULL | AI 生成标题 |
| `status` | VARCHAR(32) | NOT NULL, DEFAULT 'OPEN' | 工单状态 |
| `priority` | VARCHAR(16) | NOT NULL, DEFAULT 'P2' | 优先级 P0~P3 |
| `assignee` | VARCHAR(128) | NULL | 处理人 |
| `resolution` | TEXT | NULL | 解决方案 |
| `resolved_at` | DATETIME | NULL | 解决时间 |
| `closed_at` | DATETIME | NULL | 关闭时间 |

**索引**: `idx_event_id`, `idx_fingerprint`, `idx_status`, `idx_assignee`

### 4.6 索引设计原则

1. **主键索引**: 所有表均有主键（自增或业务键）
2. **外键索引**: 所有逻辑外键（`event_id`, `ticket_id`）均建索引
3. **查询索引**: 高频查询条件（`fingerprint`, `status`, `assignee`）单独建索引
4. **联合索引**: `idx_env_service` 覆盖仪表盘按环境+服务统计
5. **唯一约束**: `service`, `api_token`, `jira_key`, `(service, channel)` 保证数据一致性

### 4.7 外键约束策略

| 外键 | 子表 | 父表 | 策略 |
|------|------|------|------|
| `fk_analysis_event` | analysis_result | error_event | RESTRICT（物理外键） |
| event_id (逻辑) | notify_record / jira_ticket / internal_ticket / ticket_log | error_event / internal_ticket | 无物理约束（应用层保证） |

**设计考量**: 除 `analysis_result` 使用物理外键外，其余为逻辑外键，避免外键约束导致的删除/更新性能问题。

---

## 5 Redis 数据结构设计

### 5.1 指纹冷却/去重

| 属性 | 值 |
|------|-----|
| Key | `aiea:dedup:{fingerprint}` |
| Type | String（计数器） |
| 操作 | `SET NX` + `INCR` + `EXPIRE` |
| TTL | `cooldown_sec` 秒（默认 120s，可按指纹自定义） |
| 降级 | Redis 不可用时 → 放行（不抑制） |

### 5.2 限流

| 属性 | 值 |
|------|-----|
| Key | `aiea:ratelimit:global:{timestamp}` / `aiea:ratelimit:svc:{service}:{timestamp}` |
| Type | String（计数器） |
| 算法 | 固定窗口 |
| TTL | 1 秒 |
| 限额 | 全局 QPS=100, 每服务 QPS=20 |
| 降级 | Redis 不可用时 → 放行（不限流） |

### 5.3 LLM 分析缓存

| 属性 | 值 |
|------|-----|
| Key | `aiea:llm:cache:{fingerprint}` |
| Type | String（JSON 序列化的 AnalysisResult） |
| TTL | `analysis-cache-ttl` 秒（默认 3600s，0=不缓存） |
| 降级 | Redis 不可用时 → 不缓存，每次调用 LLM |

---

## 6 接口设计

### 6.1 接口总览

后端共 **10 个 Controller**，**27 个 REST API** 接口。

| Controller | 接口数 | 核心功能 |
|-----------|--------|---------|
| IngestController | 2 | 错误上报 + 列表查询 |
| EventQueryController | 2 | 事件详情 + 重试 |
| ServiceRegistryController | 5 | 服务注册 CRUD + Token 重置 |
| InternalTicketController | 9 | 工单全生命周期 |
| NotifyRoutingController | 5 | 路由规则 CRUD + 测试 |
| LlmConfigController | 2 | LLM 配置查看 + 更新 |
| LlmTestController | 2 | LLM/飞书连通性测试 |
| StatsController | 3 | 统计概览 + 抑制规则 |
| AdminController | 1 | 运行配置查看 |
| GlobalExceptionHandler | — | 全局异常处理 |

### 6.2 核心接口详细设计

#### POST /api/v1/errors — 错误上报

```
请求:
  Header: X-AIEA-Token: tok_xxx
  Body: ErrorReportRequest {
    env: String          // 环境 local/dev/staging/prod
    service: String      // 服务名
    message: String      // 异常消息
    stack: String        // 完整堆栈
    context: Map         // 上下文 (hostname/thread/version/...)
  }

响应: ErrorReportResponse {
    id: Long             // 事件 ID
    fingerprint: String  // SHA-256 指纹
    status: String       // RECEIVED / SUPPRESSED
    suppressed: boolean  // 是否被抑制
    hitCount: int        // 冷却窗口内命中次数
    message: String      // 描述信息
  }

错误码:
  401 - Token 缺失/不匹配/服务未注册
  403 - 服务已禁用
  429 - 限流
```

#### POST /api/v1/errors/{id}/retry — 重试流水线

```
删除旧分析结果 → 重新触发异步流水线
状态回退: * → RECEIVED → ANALYZING → ...
```

#### 工单操作接口

| 方法 | 路径 | 请求体 | 状态变更 |
|------|------|--------|---------|
| POST | `/tickets/{id}/claim` | `{assignee}` | OPEN → IN_PROGRESS |
| POST | `/tickets/{id}/resolve` | `{resolution, operator}` | → RESOLVED |
| POST | `/tickets/{id}/close` | `{operator}` | → CLOSED |
| POST | `/tickets/{id}/ignore` | `{operator, remark}` | → IGNORED |
| POST | `/tickets/{id}/reopen` | `{operator, remark}` | → IN_PROGRESS |
| POST | `/tickets/{id}/priority` | `{priority, operator}` | 不变 |

---

## 7 关键流程设计

### 7.1 端到端异常处理流程

```
┌──────────────────────────────────────────────────────────────┐
│ 阶段一: 异常捕获与上报                                         │
│                                                              │
│  业务系统异常                                                 │
│    ├─ SDK: Aiea.capture(e) → 异步 HTTP POST                 │
│    ├─ Logback: ERROR 日志 → Appender 异步 POST               │
│    └─ HTTP: 直接 POST /api/v1/errors                         │
│                                                              │
│  SDK 内部:                                                   │
│    1. 采集 hostname / thread / releaseVersion               │
│    2. 脱敏 (Bearer/password/token)                           │
│    3. 堆栈截断 (32KB)                                        │
│    4. Jackson 序列化 → HttpURLConnection POST               │
└──────────────────────────┬───────────────────────────────────┘
                           ▼
┌──────────────────────────────────────────────────────────────┐
│ 阶段二: 接入处理（同步快速返回）                                │
│                                                              │
│  1. 鉴权 (service + token 配对校验)                           │
│  2. 限流 (全局 QPS 100 + 每服务 QPS 20)                      │
│  3. 脱敏 (Bearer/password/email/phone)                       │
│  4. 截断 (message ≤ 1024, stack ≤ 32768)                    │
│  5. 指纹计算 (归一化 → SHA-256)                               │
│  6. Redis 去重/冷却 (SET NX + INCR + TTL)                    │
│  7. 落库 error_event (RECEIVED / SUPPRESSED)                 │
│  8. 事务提交后 → 触发异步流水线                                │
│                                                              │
│  同步返回: {id, fingerprint, status, suppressed, hitCount}   │
└──────────────────────────┬───────────────────────────────────┘
                           ▼
┌──────────────────────────────────────────────────────────────┐
│ 阶段三: 异步流水线 (@Async, 独立线程池)                        │
│                                                              │
│  1. AI 根因分析                                               │
│     ├─ DB 去重 (同 eventId 已分析?)                           │
│     ├─ Redis 缓存 (同指纹 TTL 窗口内复用)                     │
│     └─ LLM 调用 (OpenAI 兼容 /chat/completions)              │
│        ├─ 成功 → 解析 JSON → 落库 + 写缓存                    │
│        └─ 失败 → 降级摘要 → 落库 + 写缓存                     │
│                                                              │
│  2. 创建内置工单                                              │
│     ├─ 同指纹未关闭工单 → 复用                                │
│     └─ 否则 → AI 生成标题 + 智能定级 → 创建                   │
│                                                              │
│  3. 创建 Jira 工单（可选）                                    │
│     ├─ local 环境跳过                                        │
│     ├─ 同指纹幂等复用                                         │
│     └─ JiraClient.createIssue → 保存关联                     │
│                                                              │
│  4. 群聊通知                                                  │
│     ├─ 路由匹配 (service + channel → Webhook)                │
│     ├─ 飞书卡片 / 钉钉 Markdown                              │
│     ├─ 失败重试 (最多 3 次)                                   │
│     └─ 记录 notify_record                                    │
│                                                              │
│  最终状态: NOTIFIED / TICKETED / FAILED                      │
└──────────────────────────┬───────────────────────────────────┘
                           ▼
┌──────────────────────────────────────────────────────────────┐
│ 阶段四: 人工协作与闭环                                         │
│                                                              │
│  开发者收到群聊告警 → 点击链接查看详情 → 认领工单              │
│  → 查看 AI 分析 + 修复提示词 → 推进解决 → 关闭工单             │
│                                                              │
│  冷却窗口内错误复发:                                          │
│    → 自动追加工单时间线 (RECURRENCE 日志)                     │
│    → 已解决工单自动重开 (RESOLVED → IN_PROGRESS)             │
│                                                              │
│  失败重试:                                                    │
│    → POST /api/v1/errors/{id}/retry → 重新触发流水线          │
└──────────────────────────────────────────────────────────────┘
```

### 7.2 抑制事件处理流程

```
错误上报 → Redis 检查发现冷却窗口内
    │
    ├─ 标记 status = SUPPRESSED
    │
    ├─ 落库 error_event（保留审计记录）
    │
    ├─ 更新 suppress_rule 审计表 (hitCount++)
    │
    ├─ InternalTicketService.recordRecurrence(fingerprint, hitCount):
    │   ├─ 查找同指纹未关闭工单
    │   ├─ RESOLVED → 自动重开 (IN_PROGRESS) + REOPEN 日志
    │   └─ OPEN/IN_PROGRESS → 追加 RECURRENCE 日志
    │
    └─ 不触发异步流水线（不重复 LLM 分析/通知）
```

### 7.3 事务后异步触发设计

```java
// IngestService.ingest() 中:
if (!suppressed) {
    TransactionSynchronizationManager.registerSynchronization(
        new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                errorPipelineService.processAsync(eventId);
            }
        }
    );
}
```

**设计原因**: `@Async` 方法在独立线程执行，若在事务提交前触发，异步线程读不到未提交的 `error_event` 记录。通过 `afterCommit` 回调确保数据已持久化后再触发异步处理。

---

## 8 状态机设计

### 8.1 错误事件状态机

```
                    ┌──────────┐
   上报成功          │ RECEIVED  │ 事件已入库，等待异步流水线
   ──────────────►  │          │
                    └────┬─────┘
                         │ 异步流水线启动
                         ▼
                    ┌──────────┐
                    │ ANALYZING│ AI 分析中
                    └────┬─────┘
                         │ 分析完成
              ┌──────────┼──────────┐
              │          │          │
              ▼          ▼          ▼
     ┌──────────┐ ┌──────────┐ ┌──────────┐
     │ NOTIFIED │ │ TICKETED │ │  FAILED  │
     │  已通知   │ │ 已建单   │ │  处理失败 │
     └──────────┘ └──────────┘ └──────────┘
                                  │
                                  │ 手动重试
                                  ▼
                              回到 RECEIVED

   ┌──────────┐
   │SUPPRESSED│ 冷却窗口内重复上报，不进入流水线
   └──────────┘
```

| 状态 | 说明 | 后续操作 |
|------|------|---------|
| `RECEIVED` | 已入库，等待处理 | 自动进入 ANALYZING |
| `ANALYZING` | AI 分析中 | 成功 → NOTIFIED/TICKETED, 失败 → FAILED |
| `NOTIFIED` | 通知成功 | 终态（可重试） |
| `TICKETED` | 已建单但通知失败 | 终态（可重试） |
| `FAILED` | 处理失败 | 可手动重试 → RECEIVED |
| `SUPPRESSED` | 冷却窗口内重复 | 终态（不触发下游） |

### 8.2 内置工单状态机

```
┌──────────┐    认领     ┌──────────────┐    解决    ┌──────────┐    关闭    ┌──────────┐
│   OPEN   │──────────►│ IN_PROGRESS  │─────────►│ RESOLVED │─────────►│  CLOSED  │
│          │           │              │           │          │           │          │
└──────────┘           └──────────────┘           └──────────┘           └──────────┘
                               ▲                      │                      │
                               │                      │ 忽略                  │ 忽略
                               │                      ▼                      ▼
                               │                 ┌──────────┐                │
                               │                 │ IGNORED  │                │
                               │                 │          │                │
                               │                 └──────────┘                │
                               └──────────────────────┴──────────────────────┘
                                  REOPEN (手动 / 错误复发自动重开)
```

| 状态 | 可执行操作 |
|------|-----------|
| `OPEN` | 认领、忽略、变更优先级 |
| `IN_PROGRESS` | 解决、忽略、变更优先级 |
| `RESOLVED` | 关闭、重开 |
| `CLOSED` | 重开 |
| `IGNORED` | 重开 |

### 8.3 通知推送状态

通过 `notify_record.http_status` 记录：

| HTTP 状态 | 含义 | 处理 |
|-----------|------|------|
| 200 | 飞书返回 code=0 | 成功 |
| 4xx/5xx | 推送失败 | 重试（最多 3 次） |
| null | 连接失败/超时 | 重试（最多 3 次） |

---

## 9 非功能性设计

### 9.1 性能设计

| 需求 | 指标 | 实现方式 |
|------|------|---------|
| 上报接口快速返回 | P99 < 200ms | 同步仅入库 + 入队，分析/通知/建单全异步 |
| SDK 异步不阻塞 | `capture()` < 1ms | 2 线程守护线程池，仅提交任务 |
| LLM 分析缓存 | 同指纹 TTL 内复用 | Redis `LlmAnalysisCacheService` |
| 堆栈截断 | ≤ 32KB | SDK 侧 32000 字符, Server 侧 32768 字符 |
| 异步流水线隔离 | 不阻塞上报接口 | 独立线程池 `pipelineExecutor` (core=2, max=8, queue=200) |

### 9.2 并发设计

| 需求 | 实现 |
|------|------|
| 全局限流 | Redis 固定窗口 QPS=100 |
| 每服务限流 | Redis 固定窗口 QPS=20 |
| 异步线程池隔离 | `@Async("pipelineExecutor")` 自定义线程池 |
| Redis 原子操作 | `SET NX` + `INCR` 原子命令 |

### 9.3 可扩展性设计

| 需求 | 实现 |
|------|------|
| 多 IM 渠道 | 飞书/钉钉独立 Client，路由表按 service+channel 扩展 |
| LLM 供应商可替换 | OpenAI 兼容协议，切换仅需改配置 |
| 配置热更新 | DB > yaml > 默认值，无需重启 |
| 非 Java 接入 | REST API 支持任何语言 |
| SDK 无侵入 | 无 Spring 依赖，兼容 Java 8+ |

---

## 10 安全设计

### 10.1 鉴权体系

```
上报鉴权:
  每服务独立 Token (tok_ + 32位 hex)
  按 service + token 配对校验
  Token 格式: tok_{32位十六进制随机字符}
  
  鉴权流程:
    1. 请求头 X-AIEA-Token 必须存在 → 否则 401
    2. service 必须在 service_registry 中注册 → 否则 401
    3. service 必须处于启用状态 (enabled=1) → 否则 403
    4. Token 必须与注册时一致 → 否则 401
```

### 10.2 Token 安全策略

| 策略 | 实现 |
|------|------|
| 脱敏展示 | 列表/更新接口返回 `tok_a****def`（前5+****+后3） |
| 一次性展示 | 仅创建和重置时返回完整 Token |
| 重置即时失效 | 重置后旧 Token 立即不可用 |
| 唯一约束 | `uk_api_token` 唯一索引 |

### 10.3 数据脱敏

| 层级 | 脱敏内容 | 实现类 |
|------|---------|--------|
| SDK 侧 | Bearer Token, password/token/api_key | `Aiea.sanitize()` |
| 服务端侧 | Bearer Token, password/secret/api_key/token/authorization, 邮箱, 手机号 | `SensitiveDataSanitizer.sanitize()` |
| LLM API Key | 永不明文返回，仅返回是否已配置 | `SystemConfigService` |
| Webhook URL | 通知记录中截断至 80 字符 | `NotifyService` |

### 10.4 LLM Prompt 安全

```
System Prompt 约束:
  - 禁止虚构不存在的类/方法
  - 不要给出删库、关闭鉴权等高危操作
  - 必须只输出 JSON 对象
  - 若信息不足，明确写出不确定点
```

---

## 11 降级与容灾设计

### 11.1 降级矩阵

| 组件 | 故障场景 | 降级策略 | 影响 |
|------|---------|---------|------|
| Redis | 不可用 | 去重降级为放行（不抑制） | 同类错误可能重复触发下游 |
| Redis | 不可用 | 限流降级为放行（不限流） | 可能接收过多请求 |
| Redis | 不可用 | 分析缓存降级为不缓存 | 每次都调用 LLM |
| LLM | 超时/不可达 | 降级为规则摘要模板 | 分析质量降低，主链路不中断 |
| LLM | 返回非 JSON | 重试一次 → 降级摘要 | 同上 |
| 飞书/钉钉 | 推送失败 | 重试 3 次 → 记录失败 | 群消息未送达，可手动重试 |
| Jira | 不可达/未配置 | 跳过建单（可选 Mock） | 不影响内置工单 |
| AI 标题生成 | LLM 失败 | 降级为拼接标题 | 标题不够简洁 |
| suppress_rule 审计 | DB 写入失败 | 仅 warn，不阻断 | 审计记录缺失 |

### 11.2 容灾设计原则

1. **Redis 故障不影响主链路**: 所有的 Redis 操作均有 `try-catch` 降级
2. **LLM 故障不影响通知/建单**: 分析失败降级为规则摘要，通知/建单正常执行
3. **Jira 故障不影响内置工单**: 内置工单独立运行，不依赖外部 Jira
4. **单步失败不阻断流水线**: 内置工单/Jira 建单失败仅 `warn`，通知仍执行
5. **流水线异常标记 FAILED**: 整体异常 `catch` 后标记 `FAILED`，可手动重试

---

## 12 部署架构

### 12.1 部署拓扑

```
┌─────────────────────────────────────────────────────────┐
│                    生产环境部署                           │
│                                                         │
│  ┌─────────────┐         ┌──────────────────────┐      │
│  │ Nginx       │         │ AIEA Server          │      │
│  │ (前端静态)  │────────►│ (Spring Boot 3.3)    │      │
│  │ :80/:443    │  /api   │ :8080                │      │
│  └─────────────┘  代理   └──────┬───────────────┘      │
│                          ┌──────┼───────────────┐      │
│                          ▼      ▼               ▼      │
│                     MySQL 8  Redis 7        外部服务    │
│                     :3306   :6379        ┌─────────┐   │
│                                          │ LLM API │   │
│                                          │ 飞书/钉钉│   │
│                                          │ Jira    │   │
│                                          └─────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 12.2 配置管理

| 配置来源 | 优先级 | 修改方式 |
|---------|--------|---------|
| DB `system_config` 表 | 最高（覆盖 yaml） | 前端页面 / API 在线修改 |
| `application.yaml` | 中 | 修改文件 + 重启 |
| 代码默认值 | 最低 | 需改代码重新编译 |

### 12.3 环境要求

| 依赖 | 最低版本 | 用途 |
|------|---------|------|
| JDK | 17 (Server) / 8+ (SDK) | 编译运行 |
| Maven | 3.8+ | 构建工具 |
| MySQL | 8.0 | 结构化数据存储 |
| Redis | 6.0+ | 指纹冷却/限流/分析缓存 |
| Node.js | 18+ | 前端开发（可选） |

### 12.4 后续演进方向

| 方向 | 说明 |
|------|------|
| 分布式部署 | 引入消息队列（Kafka/RabbitMQ）解耦异步流水线，支持多实例水平扩展 |
| 用户认证与权限 | 增加用户登录、角色权限（管理员/处理人/只读），多团队隔离 |
| 分页与性能优化 | 错误事件列表、统计概览改为数据库分页 + 聚合查询 |
| RAG 增强 | 接入向量数据库，历史工单/修复记录作为 LLM 上下文 |
| 告警值班路由 | 按服务 owner 自动路由通知，支持值班轮换 |
| 效果度量 | MTTR、重复告警率、工单有效率看板 |

---

**文档结束**

> 本文档基于 AIEA 项目全部源码深度分析生成，涵盖概要设计与详细设计两个层级。  
> 如需查看具体源码，请参阅 `AIEA/src/main/java/com/yzk/aiea/` 目录。  
> 如需查看建表脚本，请参阅 `AIEA/src/main/resources/db/init.sql`。
