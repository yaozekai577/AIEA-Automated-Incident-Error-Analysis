# AIEA 后端接口文档

> **版本**: v1.0  
> **更新日期**: 2026-08-06  
> **Base URL**: `http://localhost:8080`  
> **Swagger UI**: `http://localhost:8080/swagger-ui.html`  
> **OpenAPI JSON**: `http://localhost:8080/v3/api-docs`

---

## 目录

- [1. 概述](#1-概述)
- [2. 通用约定](#2-通用约定)
- [3. 错误接入](#3-错误接入)
  - [3.1 上报错误事件](#31-上报错误事件)
  - [3.2 查询错误事件列表](#32-查询错误事件列表)
- [4. 错误详情与重试](#4-错误详情与重试)
  - [4.1 错误事件详情](#41-错误事件详情)
  - [4.2 重试流水线](#42-重试流水线)
- [5. 服务注册](#5-服务注册)
  - [5.1 服务列表](#51-服务列表)
  - [5.2 注册新服务](#52-注册新服务)
  - [5.3 更新服务](#53-更新服务)
  - [5.4 重置 Token](#54-重置-token)
  - [5.5 删除服务](#55-删除服务)
- [6. 通知路由](#6-通知路由)
  - [6.1 路由规则列表](#61-路由规则列表)
  - [6.2 新建路由规则](#62-新建路由规则)
  - [6.3 更新路由规则](#63-更新路由规则)
  - [6.4 删除路由规则](#64-删除路由规则)
  - [6.5 测试路由 Webhook](#65-测试路由-webhook)
- [7. 内置工单](#7-内置工单)
  - [7.1 工单列表](#71-工单列表)
  - [7.2 工单详情](#72-工单详情)
  - [7.3 根据事件ID查询工单](#73-根据事件id查询工单)
  - [7.4 认领工单](#74-认领工单)
  - [7.5 解决工单](#75-解决工单)
  - [7.6 关闭工单](#76-关闭工单)
  - [7.7 忽略工单](#77-忽略工单)
  - [7.8 重新打开工单](#78-重新打开工单)
  - [7.9 变更优先级](#79-变更优先级)
- [8. 统计分析](#8-统计分析)
  - [8.1 告警抑制规则](#81-告警抑制规则)
  - [8.2 更新冷却时间](#82-更新冷却时间)
  - [8.3 全局统计概览](#83-全局统计概览)
- [9. LLM 配置](#9-llm-配置)
  - [9.1 查看 LLM 配置](#91-查看-llm-配置)
  - [9.2 更新 LLM 配置](#92-更新-llm-配置)
- [10. LLM 测试](#10-llm-测试)
  - [10.1 大模型连通性测试](#101-大模型连通性测试)
  - [10.2 飞书机器人连通性测试](#102-飞书机器人连通性测试)
- [11. 管理配置](#11-管理配置)
  - [11.1 查看运行配置](#111-查看运行配置)
- [12. 数据模型](#12-数据模型)
- [13. 错误处理](#13-错误处理)

---

## 1. 概述

AIEA（AI-Enhanced Alerting）是一个 AI 增强的异常告警系统，核心流程为：**错误上报 → 指纹去重 → 大模型根因分析 → 飞书/钉钉通知 → 自动建单**。

后端基于 Spring Boot 3 + JPA + MySQL + Redis 构建，提供 RESTful API，共 **9 个 Controller、27 个接口**，覆盖以下功能域：

| 功能域 | Controller | 前缀路径 | 接口数 |
|--------|-----------|----------|-------|
| 错误接入 | `IngestController` | `/api/v1/errors` | 2 |
| 错误详情与重试 | `EventQueryController` | `/api/v1/errors` | 2 |
| 服务注册 | `ServiceRegistryController` | `/api/v1/service-registry` | 5 |
| 通知路由 | `NotifyRoutingController` | `/api/v1/notify-routing` | 5 |
| 内置工单 | `InternalTicketController` | `/api/v1/tickets` | 9 |
| 统计分析 | `StatsController` | `/api/v1/stats` | 3 |
| LLM 配置 | `LlmConfigController` | `/api/v1/llm-config` | 2 |
| LLM 测试 | `LlmTestController` | `/api/test` | 2 |
| 管理配置 | `AdminController` | `/api/v1/admin` | 1 |

---

## 2. 通用约定

### 2.1 请求格式

- **Content-Type**: `application/json`（除 GET 请求外）
- **认证头**: 部分接口需要 `X-AIEA-Token` 请求头（详见各接口说明）
- **字符编码**: UTF-8

### 2.2 响应格式

所有接口返回 JSON 格式数据。成功响应直接返回业务对象或数组，错误响应统一格式如下：

```json
{
  "status": 400,
  "error": "Bad Request",
  "message": "错误描述信息"
}
```

### 2.3 HTTP 状态码

| 状态码 | 含义 |
|--------|------|
| 200 | 请求成功 |
| 400 | 参数校验失败 / 业务异常 |
| 401 | 未认证（缺少 Token / Token 不匹配） |
| 403 | 禁止访问（服务已禁用） |
| 404 | 资源不存在 |

### 2.4 时间格式

所有时间字段均为 `LocalDateTime`，序列化格式为 `yyyy-MM-dd'T'HH:mm:ss`。

---

## 3. 错误接入

> **Controller**: `IngestController`  
> **路径前缀**: `/api/v1/errors`  
> **Tag**: 错误接入 — 异常上报与查询

### 3.1 上报错误事件

SDK / Agent 通过此接口上报异常堆栈，需携带服务专属 Token 进行鉴权。

```
POST /api/v1/errors
```

**请求头**

| 名称 | 类型 | 必填 | 说明 |
|------|------|------|------|
| X-AIEA-Token | String | 是 | 服务专属上报 Token，需先在「服务注册」页面获取 |

**请求体** (`ErrorReportRequest`)

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| env | String | 否 | `local` | 环境标识：`local`/`dev`/`staging`/`prod` |
| service | String | 是 | — | 上报服务名（最长 128 字符） |
| message | String | 是 | — | 异常 message（最长 1024 字符） |
| stack | String | 否 | — | 完整堆栈 |
| context | Map\<String, Object\> | 否 | — | 上下文信息（版本/host/thread/MDC/traceId 等） |

**请求示例**

```bash
curl -X POST http://localhost:8080/api/v1/errors \
  -H "Content-Type: application/json" \
  -H "X-AIEA-Token: tok_abc123def456" \
  -d '{
    "env": "prod",
    "service": "order-service",
    "message": "NullPointerException at OrderService.java:42",
    "stack": "java.lang.NullPointerException\n\tat com.example.OrderService.process(OrderService.java:42)\n\t...",
    "context": {
      "version": "1.2.0",
      "host": "order-pod-7f8b",
      "thread": "http-nio-8080-exec-3",
      "traceId": "trace-9a8b7c6d"
    }
  }'
```

**成功响应** (`ErrorReportResponse`, HTTP 200)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Long | 事件 ID |
| fingerprint | String | 错误指纹（归一化堆栈哈希） |
| status | String | 处理状态：`RECEIVED`（已入队）或 `SUPPRESSED`（被抑制） |
| suppressed | boolean | 是否被抑制（冷却窗口内的重复上报） |
| hitCount | int | 冷却窗口内命中次数 |
| message | String | 提示信息 |

```json
{
  "id": 1,
  "fingerprint": "a1b2c3d4e5f6",
  "status": "RECEIVED",
  "suppressed": false,
  "hitCount": 0,
  "message": "事件已接收，正在异步处理"
}
```

**被抑制响应**

```json
{
  "id": null,
  "fingerprint": "a1b2c3d4e5f6",
  "status": "SUPPRESSED",
  "suppressed": true,
  "hitCount": 3,
  "message": "冷却窗口内重复上报，已抑制"
}
```

**鉴权失败响应**

| HTTP 状态码 | 场景 | 响应体 |
|------------|------|--------|
| 401 | 缺少 Token | `{"error": "缺少 X-AIEA-Token 请求头"}` |
| 401 | 服务未注册 | `{"error": "服务未注册: xxx，请先在服务注册页面添加"}` |
| 401 | Token 不匹配 | `{"error": "Token 不匹配"}` |
| 403 | 服务已禁用 | `{"error": "服务已被禁用: xxx"}` |

---

### 3.2 查询错误事件列表

可按指纹或状态过滤，两个参数都为空时返回全部。

```
GET /api/v1/errors
```

**查询参数**

| 名称 | 类型 | 必填 | 说明 |
|------|------|------|------|
| fingerprint | String | 否 | 按错误指纹过滤 |
| status | String | 否 | 按状态过滤（`RECEIVED`/`ANALYZING`/`NOTIFIED`/`TICKETED`/`FAILED`/`SUPPRESSED`） |

> **注意**: 当 `fingerprint` 和 `status` 同时提供时，优先按 `fingerprint` 过滤。

**请求示例**

```bash
curl "http://localhost:8080/api/v1/errors?status=FAILED"
```

**成功响应** (HTTP 200)

返回 `ErrorEvent` 数组，详见 [12.1 ErrorEvent](#121-errorevent)。

```json
[
  {
    "id": 1,
    "fingerprint": "a1b2c3d4e5f6",
    "env": "prod",
    "service": "order-service",
    "message": "NullPointerException at OrderService.java:42",
    "stack": "java.lang.NullPointerException...",
    "contextJson": "{\"version\":\"1.2.0\",\"host\":\"order-pod-7f8b\"}",
    "status": "FAILED",
    "createdAt": "2026-08-06T10:30:00",
    "updatedAt": "2026-08-06T10:30:05"
  }
]
```

---

## 4. 错误详情与重试

> **Controller**: `EventQueryController`  
> **路径前缀**: `/api/v1/errors`  
> **Tag**: 错误详情与重试 — 事件详情查询与失败重放

### 4.1 错误事件详情

获取错误事件的完整详情，包含 AI 分析结果、通知记录、Jira 工单关联。

```
GET /api/v1/errors/{id}
```

**路径参数**

| 名称 | 类型 | 说明 |
|------|------|------|
| id | Long | 事件 ID |

**请求示例**

```bash
curl http://localhost:8080/api/v1/errors/1
```

**成功响应** (`ErrorEventDetailResponse`, HTTP 200)

| 字段 | 类型 | 说明 |
|------|------|------|
| event | ErrorEvent | 错误事件，详见 [12.1 ErrorEvent](#121-errorevent) |
| analysis | AnalysisResult | AI 分析结果（可能为 null），详见 [12.2 AnalysisResult](#122-analysisresult) |
| notifies | NotifyRecord[] | 通知推送记录列表，详见 [12.3 NotifyRecord](#123-notifyrecord) |
| tickets | JiraTicket[] | Jira 工单关联列表，详见 [12.4 JiraTicket](#124-jiraticket) |

```json
{
  "event": {
    "id": 1,
    "fingerprint": "a1b2c3d4e5f6",
    "env": "prod",
    "service": "order-service",
    "message": "NullPointerException at OrderService.java:42",
    "stack": "java.lang.NullPointerException...",
    "contextJson": "{\"version\":\"1.2.0\"}",
    "status": "NOTIFIED",
    "createdAt": "2026-08-06T10:30:00",
    "updatedAt": "2026-08-06T10:30:10"
  },
  "analysis": {
    "eventId": 1,
    "rootCause": "Order 对象的 getUser() 方法返回 null，未做空指针检查...",
    "suggestions": "[\"添加空指针检查\", \"使用 Optional 包装返回值\"]",
    "confidence": 0.8500,
    "model": "qwen-plus",
    "rawResponse": "{...}",
    "createdAt": "2026-08-06T10:30:05"
  },
  "notifies": [
    {
      "id": 1,
      "eventId": 1,
      "channel": "feishu",
      "payload": "{\"msg_type\":\"text\",\"content\":{...}}",
      "httpStatus": 200,
      "sentAt": "2026-08-06T10:30:08"
    }
  ],
  "tickets": []
}
```

**事件不存在** (HTTP 404)

```json
{
  "error": "event not found"
}
```

---

### 4.2 重试流水线

对 FAILED 或卡住的事件重新触发分析/建单/通知。会删除旧分析结果，将事件状态重置为 `RECEIVED`，重新入队异步流水线。

```
POST /api/v1/errors/{id}/retry
```

**路径参数**

| 名称 | 类型 | 说明 |
|------|------|------|
| id | Long | 事件 ID |

**请求示例**

```bash
curl -X POST http://localhost:8080/api/v1/errors/1/retry
```

**成功响应** (HTTP 200)

```json
{
  "id": 1,
  "message": "已重新入队异步流水线"
}
```

**事件不存在** (HTTP 404)

```json
{
  "error": "event not found"
}
```

---

## 5. 服务注册

> **Controller**: `ServiceRegistryController`  
> **路径前缀**: `/api/v1/service-registry`  
> **Tag**: 服务注册 — 管理接入服务的上报 Token（每服务一个）

**安全策略**: 列表/更新接口返回脱敏 Token（如 `tok_a****def`）；仅创建和重置时返回完整 Token（一次性）。

### 5.1 服务列表

查询全部已注册服务，Token 脱敏显示。

```
GET /api/v1/service-registry
```

**请求示例**

```bash
curl http://localhost:8080/api/v1/service-registry
```

**成功响应** (HTTP 200)

返回服务列表，每项包含以下字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Long | 服务注册 ID |
| service | String | 业务服务名 |
| apiToken | String | 脱敏 Token（前5位 + **** + 后3位） |
| description | String | 描述 |
| enabled | Boolean | 是否启用 |
| createdAt | LocalDateTime | 创建时间 |
| updatedAt | LocalDateTime | 更新时间 |

```json
[
  {
    "id": 1,
    "service": "order-service",
    "apiToken": "tok_a****def",
    "description": "订单服务",
    "enabled": true,
    "createdAt": "2026-08-01T09:00:00",
    "updatedAt": "2026-08-01T09:00:00"
  }
]
```

---

### 5.2 注册新服务

新增服务并自动生成专属上报 Token，**完整 Token 仅此一次返回**。

```
POST /api/v1/service-registry
```

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| service | String | 是 | 业务服务名（不能为空，不能重复） |
| description | String | 否 | 服务描述 |

```json
{
  "service": "payment-service",
  "description": "支付服务"
}
```

**成功响应** (HTTP 200)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Long | 服务注册 ID |
| service | String | 业务服务名 |
| apiToken | String | **完整 Token**（仅此一次显示） |
| description | String | 描述 |
| enabled | Boolean | 是否启用（默认 true） |
| createdAt | LocalDateTime | 创建时间 |
| updatedAt | LocalDateTime | 更新时间 |
| fullTokenShown | Boolean | 是否展示了完整 Token（true） |

```json
{
  "id": 2,
  "service": "payment-service",
  "apiToken": "tok_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
  "description": "支付服务",
  "enabled": true,
  "createdAt": "2026-08-06T14:00:00",
  "updatedAt": "2026-08-06T14:00:00",
  "fullTokenShown": true
}
```

**错误响应** (HTTP 400)

```json
{
  "status": 400,
  "error": "Bad Request",
  "message": "服务已存在: payment-service"
}
```

---

### 5.3 更新服务

修改描述或启用/禁用服务。Token 脱敏返回。

```
PUT /api/v1/service-registry/{id}
```

**路径参数**

| 名称 | 类型 | 说明 |
|------|------|------|
| id | Long | 服务注册 ID |

**请求体**（字段均可选，仅传需要修改的字段）

| 字段 | 类型 | 说明 |
|------|------|------|
| description | String | 服务描述 |
| enabled | Boolean | 是否启用 |

```json
{
  "description": "支付服务（已升级）",
  "enabled": false
}
```

**成功响应** (HTTP 200)

返回更新后的服务信息（Token 脱敏），字段同 [5.1 服务列表](#51-服务列表)。

---

### 5.4 重置 Token

为指定服务重新生成上报 Token，旧 Token **立即失效**，完整新 Token **仅此一次返回**。

```
POST /api/v1/service-registry/{id}/regenerate-token
```

**路径参数**

| 名称 | 类型 | 说明 |
|------|------|------|
| id | Long | 服务注册 ID |

**请求示例**

```bash
curl -X POST http://localhost:8080/api/v1/service-registry/2/regenerate-token
```

**成功响应** (HTTP 200)

```json
{
  "id": 2,
  "service": "payment-service",
  "apiToken": "tok_x9y8z7w6v5u4t3s2r1q0p9o8n7m6l5k4",
  "description": "支付服务",
  "enabled": true,
  "createdAt": "2026-08-06T14:00:00",
  "updatedAt": "2026-08-06T14:05:00",
  "fullTokenShown": true
}
```

---

### 5.5 删除服务

删除后该服务的上报将被拒绝。

```
DELETE /api/v1/service-registry/{id}
```

**路径参数**

| 名称 | 类型 | 说明 |
|------|------|------|
| id | Long | 服务注册 ID |

**成功响应** (HTTP 200)

```json
{
  "deleted": true,
  "id": 2
}
```

**服务不存在** (HTTP 404)

```json
{
  "status": 404,
  "error": "Not Found",
  "message": "服务不存在: id=2"
}
```

---

## 6. 通知路由

> **Controller**: `NotifyRoutingController`  
> **路径前缀**: `/api/v1/notify-routing`  
> **Tag**: 通知路由 — 多 IM 机器人路由规则：服务名 + 渠道 → Webhook 映射

按业务服务名 + 通知渠道路由到不同的 IM 群机器人。同一服务可配两条规则（一条 feishu、一条 dingtalk）。未配置路由的服务 fallback 到全局 webhook。

### 6.1 路由规则列表

```
GET /api/v1/notify-routing
```

**成功响应** (HTTP 200)

返回 `NotifyRouting` 数组，详见 [12.5 NotifyRouting](#125-notifyrouting)。

```json
[
  {
    "id": 1,
    "service": "order-service",
    "channel": "feishu",
    "webhookUrl": "https://open.feishu.cn/open-apis/bot/v2/hook/xxx",
    "description": "订单服务专属飞书群",
    "enabled": true,
    "createdAt": "2026-08-01T09:00:00",
    "updatedAt": "2026-08-01T09:00:00"
  }
]
```

---

### 6.2 新建路由规则

为指定服务名 + 渠道配置专属 Webhook。

```
POST /api/v1/notify-routing
```

**请求体** (`NotifyRouting`)

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| service | String | 是 | — | 业务服务名 |
| webhookUrl | String | 是 | — | IM 自定义机器人 Webhook 地址 |
| channel | String | 否 | `feishu` | 通知渠道：`feishu` / `dingtalk` |
| description | String | 否 | — | 描述 |
| enabled | Boolean | 否 | `true` | 是否启用 |

```json
{
  "service": "order-service",
  "channel": "dingtalk",
  "webhookUrl": "https://oapi.dingtalk.com/robot/send?access_token=xxx",
  "description": "订单服务钉钉群"
}
```

**成功响应** (HTTP 200)

返回创建的 `NotifyRouting` 对象。

**错误响应** (HTTP 400)

- `service 不能为空`
- `webhookUrl 不能为空`
- `该服务+渠道已存在路由规则: order-service/dingtalk`

---

### 6.3 更新路由规则

修改指定路由规则的 Webhook、描述、启用状态等。所有字段可选，仅传需要修改的字段。

```
PUT /api/v1/notify-routing/{id}
```

**路径参数**

| 名称 | 类型 | 说明 |
|------|------|------|
| id | Long | 路由规则 ID |

**请求体**（字段均可选）

| 字段 | 类型 | 说明 |
|------|------|------|
| service | String | 业务服务名 |
| channel | String | 通知渠道 |
| webhookUrl | String | Webhook 地址 |
| description | String | 描述 |
| enabled | Boolean | 是否启用 |

```json
{
  "webhookUrl": "https://open.feishu.cn/open-apis/bot/v2/hook/new-url",
  "enabled": false
}
```

**成功响应** (HTTP 200)

返回更新后的 `NotifyRouting` 对象。

**错误响应** (HTTP 400)

- `路由规则不存在: id=1`
- `服务+渠道已被其他规则占用: order-service/dingtalk`

---

### 6.4 删除路由规则

删除后该服务+渠道将 fallback 到全局 Webhook。

```
DELETE /api/v1/notify-routing/{id}
```

**成功响应** (HTTP 200)

```json
{
  "deleted": true,
  "id": 1
}
```

**路由规则不存在** (HTTP 404)

```json
{
  "status": 404,
  "error": "Not Found",
  "message": "路由规则不存在: id=1"
}
```

---

### 6.5 测试路由 Webhook

向该路由规则配置的 IM 机器人发送一条测试消息，按 channel 自动选择飞书或钉钉客户端。

```
POST /api/v1/notify-routing/{id}/test
```

**路径参数**

| 名称 | 类型 | 说明 |
|------|------|------|
| id | Long | 路由规则 ID |

**成功响应** (HTTP 200)

| 字段 | 类型 | 说明 |
|------|------|------|
| service | String | 服务名 |
| channel | String | 通知渠道 |
| webhookUrl | String | Webhook 地址 |
| success | Boolean | 推送是否成功 |
| httpStatus | Integer | HTTP 状态码 |
| error | String | 错误信息（仅失败时返回） |

```json
{
  "service": "order-service",
  "channel": "feishu",
  "webhookUrl": "https://open.feishu.cn/open-apis/bot/v2/hook/xxx",
  "success": true,
  "httpStatus": 200
}
```

**路由已禁用**

```json
{
  "success": false,
  "error": "该路由规则已禁用，无法测试"
}
```

---

## 7. 内置工单

> **Controller**: `InternalTicketController`  
> **路径前缀**: `/api/v1/tickets`  
> **Tag**: 内置工单 — 工单创建、认领、解决、关闭、忽略等操作

**工单状态机**:

```
OPEN → IN_PROGRESS → RESOLVED → CLOSED
                              ↘ IGNORED
RESOLVED/CLOSED/IGNORED → IN_PROGRESS (REOPEN)
```

**优先级**: `P0`（最高）/ `P1` / `P2`（默认）/ `P3`

### 7.1 工单列表

可按 status 或 assignee 过滤（两个参数同时提供时，优先按 status 过滤）。

```
GET /api/v1/tickets
```

**查询参数**

| 名称 | 类型 | 必填 | 说明 |
|------|------|------|------|
| status | String | 否 | 按状态过滤：`OPEN`/`IN_PROGRESS`/`RESOLVED`/`CLOSED`/`IGNORED` |
| assignee | String | 否 | 按处理人过滤 |

**成功响应** (HTTP 200)

返回 `InternalTicket` 数组，详见 [12.6 InternalTicket](#126-internalticket)。

---

### 7.2 工单详情

获取工单详情，包含操作时间线（日志列表）。

```
GET /api/v1/tickets/{id}
```

**路径参数**

| 名称 | 类型 | 说明 |
|------|------|------|
| id | Long | 工单 ID |

**成功响应** (`TicketDetail`, HTTP 200)

| 字段 | 类型 | 说明 |
|------|------|------|
| ticket | InternalTicket | 工单信息，详见 [12.6 InternalTicket](#126-internalticket) |
| logs | TicketLog[] | 操作日志列表（按时间升序），详见 [12.7 TicketLog](#127-ticketlog) |

```json
{
  "ticket": {
    "id": 1,
    "eventId": 1,
    "fingerprint": "a1b2c3d4e5f6",
    "title": "空指针访问导致服务崩溃",
    "status": "IN_PROGRESS",
    "priority": "P1",
    "assignee": "zhangsan",
    "resolution": null,
    "createdAt": "2026-08-06T10:30:10",
    "updatedAt": "2026-08-06T11:00:00",
    "resolvedAt": null,
    "closedAt": null
  },
  "logs": [
    {
      "id": 1,
      "ticketId": 1,
      "action": "CREATE",
      "oldValue": null,
      "newValue": "OPEN",
      "operator": null,
      "remark": "自动创建工单",
      "createdAt": "2026-08-06T10:30:10"
    },
    {
      "id": 2,
      "ticketId": 1,
      "action": "CLAIM",
      "oldValue": null,
      "newValue": "zhangsan",
      "operator": null,
      "remark": "认领工单",
      "createdAt": "2026-08-06T11:00:00"
    },
    {
      "id": 3,
      "ticketId": 1,
      "action": "STATUS",
      "oldValue": "OPEN",
      "newValue": "IN_PROGRESS",
      "operator": null,
      "remark": "状态变更",
      "createdAt": "2026-08-06T11:00:00"
    }
  ]
}
```

**工单不存在** (HTTP 404)

```json
{
  "error": "工单不存在: 999"
}
```

---

### 7.3 根据事件ID查询工单

```
GET /api/v1/tickets/by-event/{eventId}
```

**路径参数**

| 名称 | 类型 | 说明 |
|------|------|------|
| eventId | Long | 事件 ID |

**成功响应** (HTTP 200)

返回 `InternalTicket` 数组。

---

### 7.4 认领工单

认领工单，同时将状态从 `OPEN` 变更为 `IN_PROGRESS`（若当前为 `OPEN`）。

```
POST /api/v1/tickets/{id}/claim
```

**路径参数**

| 名称 | 类型 | 说明 |
|------|------|------|
| id | Long | 工单 ID |

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| assignee | String | 是 | 认领人（若为空则取 `operator` 字段，再为空则 `anonymous`） |

```json
{
  "assignee": "zhangsan"
}
```

**成功响应** (HTTP 200)

返回更新后的 `InternalTicket` 对象。

---

### 7.5 解决工单

标记工单为已解决。

```
POST /api/v1/tickets/{id}/resolve
```

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| resolution | String | 否 | 解决方案描述 |
| operator | String | 否 | 操作人（默认 `anonymous`） |

```json
{
  "resolution": "添加了空指针检查，已修复",
  "operator": "zhangsan"
}
```

**成功响应** (HTTP 200)

返回更新后的 `InternalTicket` 对象（`status` = `RESOLVED`，`resolvedAt` 已设置）。

---

### 7.6 关闭工单

关闭工单。

```
POST /api/v1/tickets/{id}/close
```

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| operator | String | 否 | 操作人（默认 `anonymous`） |

```json
{
  "operator": "zhangsan"
}
```

**成功响应** (HTTP 200)

返回更新后的 `InternalTicket` 对象（`status` = `CLOSED`，`closedAt` 已设置）。

---

### 7.7 忽略工单

将工单标记为忽略。

```
POST /api/v1/tickets/{id}/ignore
```

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| operator | String | 否 | 操作人（默认 `anonymous`） |
| remark | String | 否 | 忽略原因备注 |

```json
{
  "operator": "zhangsan",
  "remark": "已知问题，下个版本修复"
}
```

**成功响应** (HTTP 200)

返回更新后的 `InternalTicket` 对象（`status` = `IGNORED`，`closedAt` 已设置）。

---

### 7.8 重新打开工单

重新打开已解决/已关闭/已忽略的工单，状态变为 `IN_PROGRESS`。

```
POST /api/v1/tickets/{id}/reopen
```

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| operator | String | 否 | 操作人（默认 `anonymous`） |
| remark | String | 否 | 重开原因备注 |

```json
{
  "operator": "zhangsan",
  "remark": "问题在测试环境复现"
}
```

**成功响应** (HTTP 200)

返回更新后的 `InternalTicket` 对象（`status` = `IN_PROGRESS`，`resolvedAt` 和 `closedAt` 已清除）。

---

### 7.9 变更优先级

```
POST /api/v1/tickets/{id}/priority
```

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| priority | String | 是 | 新优先级：`P0`/`P1`/`P2`/`P3` |
| operator | String | 否 | 操作人（默认 `anonymous`） |

```json
{
  "priority": "P0",
  "operator": "zhangsan"
}
```

**成功响应** (HTTP 200)

返回更新后的 `InternalTicket` 对象。

---

## 8. 统计分析

> **Controller**: `StatsController`  
> **路径前缀**: `/api/v1/stats`  
> **Tag**: 统计分析 — 告警抑制规则、全局统计概览

### 8.1 告警抑制规则

查看所有指纹的冷却规则、命中次数、最近触发时间，按命中次数降序排列。

```
GET /api/v1/stats/suppress-rules
```

**成功响应** (HTTP 200)

返回 Map 数组，每项包含以下字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| fingerprint | String | 错误指纹 |
| cooldownSec | Integer | 冷却窗口（秒） |
| hitCount | Integer | 命中/合并次数 |
| lastFiredAt | LocalDateTime | 上次触发时间 |
| inCooldown | Boolean | 是否在冷却中 |
| remainingTime | String | 剩余冷却时间（如 `3分20秒`，冷却中才有值） |
| service | String | 关联服务名（有事件时才有） |
| message | String | 最新事件异常消息（有事件时才有） |
| env | String | 最新事件环境（有事件时才有） |
| latestCreatedAt | LocalDateTime | 最新事件创建时间（有事件时才有） |
| latestEventId | Long | 最新关联事件 ID（优先取有工单的事件） |
| eventCount | Integer | 该指纹的事件总数 |

```json
[
  {
    "fingerprint": "a1b2c3d4e5f6",
    "cooldownSec": 600,
    "hitCount": 15,
    "lastFiredAt": "2026-08-06T10:30:00",
    "inCooldown": true,
    "remainingTime": "3分20秒",
    "service": "order-service",
    "message": "NullPointerException at OrderService.java:42",
    "env": "prod",
    "latestCreatedAt": "2026-08-06T10:35:00",
    "latestEventId": 5,
    "eventCount": 18
  }
]
```

---

### 8.2 更新冷却时间

修改指定指纹的冷却窗口（秒），立即生效。

```
PUT /api/v1/stats/suppress-rules/{fingerprint}/cooldown
```

**路径参数**

| 名称 | 类型 | 说明 |
|------|------|------|
| fingerprint | String | 错误指纹 |

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| cooldownSec | Integer | 是 | 冷却窗口秒数（范围 1~86400） |

```json
{
  "cooldownSec": 3600
}
```

**成功响应** (HTTP 200)

```json
{
  "fingerprint": "a1b2c3d4e5f6",
  "cooldownSec": 3600,
  "updated": true
}
```

**错误响应** (HTTP 400)

- `冷却时间须在 1~86400 秒之间`
- `指纹不存在: a1b2c3d4e5f6`

---

### 8.3 全局统计概览

返回全局统计数据，包括事件总数、分析数、通知成功率、工单数、环境分布等。

```
GET /api/v1/stats/overview
```

**成功响应** (HTTP 200)

| 字段 | 类型 | 说明 |
|------|------|------|
| totalErrors | Integer | 错误事件总数 |
| totalAnalyses | Integer | AI 分析结果总数 |
| totalNotifies | Integer | 通知推送总数 |
| totalTickets | Integer | Jira 工单总数 |
| uniqueFingerprints | Long | 唯一指纹数 |
| notifySuccessCount | Long | 通知成功数 |
| notifyFailCount | Long | 通知失败数 |
| notifySuccessRate | Double | 通知成功率（百分比，保留1位小数） |
| highConfidence | Long | 高置信度分析数（≥0.7） |
| midConfidence | Long | 中置信度分析数（0.4~0.7） |
| lowConfidence | Long | 低置信度分析数（<0.4） |
| envDistribution | Map\<String, Long\> | 环境分布 |
| statusDistribution | Map\<String, Long\> | 事件状态分布 |
| channelDistribution | Map\<String, Long\> | 通知渠道分布 |
| serviceDistribution | Map\<String, Long\> | 按服务统计错误数 |
| suppressRuleCount | Integer | 抑制规则总数 |
| totalSuppressHits | Integer | 抑制总命中次数 |
| internalTicketTotal | Integer | 内置工单总数 |
| internalTicketOpen | Long | OPEN 状态工单数 |
| internalTicketInProgress | Long | IN_PROGRESS 状态工单数 |
| internalTicketResolved | Long | RESOLVED 状态工单数 |
| internalTicketClosed | Long | CLOSED + IGNORED 状态工单数 |

```json
{
  "totalErrors": 150,
  "totalAnalyses": 120,
  "totalNotifies": 115,
  "totalTickets": 0,
  "uniqueFingerprints": 25,
  "notifySuccessCount": 110,
  "notifyFailCount": 5,
  "notifySuccessRate": 95.7,
  "highConfidence": 80,
  "midConfidence": 30,
  "lowConfidence": 10,
  "envDistribution": {
    "prod": 100,
    "dev": 30,
    "local": 20
  },
  "statusDistribution": {
    "NOTIFIED": 100,
    "TICKETED": 30,
    "FAILED": 15,
    "SUPPRESSED": 5
  },
  "channelDistribution": {
    "feishu": 115
  },
  "serviceDistribution": {
    "order-service": 80,
    "payment-service": 50,
    "user-service": 20
  },
  "suppressRuleCount": 25,
  "totalSuppressHits": 300,
  "internalTicketTotal": 95,
  "internalTicketOpen": 10,
  "internalTicketInProgress": 20,
  "internalTicketResolved": 50,
  "internalTicketClosed": 15
}
```

---

## 9. LLM 配置

> **Controller**: `LlmConfigController`  
> **路径前缀**: `/api/v1/llm-config`  
> **Tag**: LLM 配置 — 大模型配置的前端读写（API Key 脱敏）

**配置优先级**: DB（`system_config` 表）> `application.yaml`。API Key 永远不返回明文，只返回是否已配置。

### 9.1 查看 LLM 配置

```
GET /api/v1/llm-config
```

**成功响应** (HTTP 200)

| 字段 | 类型 | 说明 |
|------|------|------|
| baseUrl | String | 大模型 API Base URL |
| model | String | 模型名称 |
| apiKeyConfigured | Boolean | API Key 是否已配置 |
| analysisCacheTtl | Integer | 分析缓存 TTL（秒） |

```json
{
  "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1",
  "model": "qwen-plus",
  "apiKeyConfigured": true,
  "analysisCacheTtl": 3600
}
```

---

### 9.2 更新 LLM 配置

修改 LLM 的 Base URL / API Key / 模型 / 缓存 TTL，立即生效。所有字段可选，null/缺失=不修改，空字符串=清除（仅 apiKey 支持清除）。

```
PUT /api/v1/llm-config
```

**请求体**（字段均可选）

| 字段 | 类型 | 说明 |
|------|------|------|
| baseUrl | String | 大模型 API Base URL |
| apiKey | String | API Key（传空字符串可清除） |
| model | String | 模型名称 |
| analysisCacheTtl | Integer | 分析缓存 TTL（秒，范围 0~86400） |

```json
{
  "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1",
  "apiKey": "sk-new-key-xxx",
  "model": "qwen-max",
  "analysisCacheTtl": 7200
}
```

**成功响应** (HTTP 200)

| 字段 | 类型 | 说明 |
|------|------|------|
| updated | Boolean | 是否更新成功（true） |
| baseUrl | String | 当前生效的 Base URL |
| model | String | 当前生效的模型名 |
| apiKeyConfigured | Boolean | API Key 是否已配置 |
| analysisCacheTtl | Integer | 当前生效的缓存 TTL |

```json
{
  "updated": true,
  "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1",
  "model": "qwen-max",
  "apiKeyConfigured": true,
  "analysisCacheTtl": 7200
}
```

**错误响应** (HTTP 400)

```json
{
  "status": 400,
  "error": "Bad Request",
  "message": "analysisCacheTtl 须在 0~86400 秒之间"
}
```

---

## 10. LLM 测试

> **Controller**: `LlmTestController`  
> **路径前缀**: `/api/test`  
> **Tag**: LLM 测试 — 大模型 API 连通性与飞书推送测试

### 10.1 大模型连通性测试

向大模型发送「你好」消息，测试 API 连通性。成功后自动将结果推送到飞书群。

```
GET /api/test/llm
```

**成功响应** (HTTP 200)

| 字段 | 类型 | 说明 |
|------|------|------|
| success | Boolean | 调用是否成功 |
| baseUrl | String | 当前 Base URL |
| model | String | 当前模型名 |
| httpStatus | Integer | 大模型 API 返回的 HTTP 状态码 |
| reply | String | 模型回复内容（成功时返回） |
| usage | Map | Token 使用统计（成功时返回） |
| rawResponse | Map | 大模型 API 原始响应 |
| notify | Map | 飞书推送结果（成功时返回） |
| error | String | 错误信息（失败时返回） |
| errorBody | String | 错误响应体（HTTP 错误时返回） |

```json
{
  "success": true,
  "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1",
  "model": "qwen-plus",
  "httpStatus": 200,
  "reply": "你好！我是通义千问...",
  "usage": {
    "total_tokens": 50,
    "prompt_tokens": 10,
    "completion_tokens": 40
  },
  "rawResponse": { "..." },
  "notify": {
    "success": true,
    "httpStatus": 200
  }
}
```

---

### 10.2 飞书机器人连通性测试

发送一条测试消息到飞书群（使用全局 Webhook）。

```
GET /api/test/feishu
```

**成功响应** (HTTP 200)

| 字段 | 类型 | 说明 |
|------|------|------|
| success | Boolean | 推送是否成功 |
| httpStatus | Integer | HTTP 状态码 |
| error | String | 错误信息（失败时返回） |

```json
{
  "success": true,
  "httpStatus": 200
}
```

---

## 11. 管理配置

> **Controller**: `AdminController`  
> **路径前缀**: `/api/v1/admin`  
> **Tag**: 管理配置 — 查看当前生效配置（密钥脱敏）

### 11.1 查看运行配置

只读配置视图，密钥脱敏，用于运维核对当前生效配置。

```
GET /api/v1/admin/config
```

**成功响应** (HTTP 200)

返回 Map，包含以下键：

| 键 | 类型 | 说明 |
|----|------|------|
| ingest.registeredServices | Long | 已注册服务数 |
| ingest.enabledServices | Long | 已启用服务数 |
| ingest.dedupCooldownSeconds | Integer | 去重冷却时间（秒） |
| ingest.rateLimitEnabled | Boolean | 是否启用限流 |
| ingest.globalQps | Integer | 全局 QPS 限制 |
| ingest.perServiceQps | Integer | 每服务 QPS 限制 |
| llm.baseUrl | String | LLM Base URL |
| llm.model | String | LLM 模型名 |
| llm.apiKeyConfigured | Boolean | LLM API Key 是否已配置 |
| llm.analysisCacheTtl | Integer | 分析缓存 TTL（秒） |
| feishu.webhookConfigured | Boolean | 飞书 Webhook 是否已配置 |
| jira.enabled | Boolean | Jira 是否启用 |
| jira.baseUrl | String | Jira Base URL |
| jira.projectKey | String | Jira 项目 Key |
| jira.enableForLocal | Boolean | 是否为 local 环境启用 Jira |
| jira.mockWhenUnconfigured | Boolean | 未配置时是否 Mock |
| pipeline.enabled | Boolean | 流水线是否启用 |
| pipeline.notifyChannel | String | 通知渠道 |
| pipeline.notifyEnabled | Boolean | 通知是否启用 |
| pipeline.detailBaseUrl | String | 详情页 Base URL |
| notifyRouting.totalRules | Long | 通知路由规则总数 |
| notifyRouting.enabledRules | Long | 已启用路由规则数 |

```json
{
  "ingest.registeredServices": 3,
  "ingest.enabledServices": 2,
  "ingest.dedupCooldownSeconds": 120,
  "ingest.rateLimitEnabled": true,
  "ingest.globalQps": 100,
  "ingest.perServiceQps": 20,
  "llm.baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1",
  "llm.model": "qwen-plus",
  "llm.apiKeyConfigured": true,
  "llm.analysisCacheTtl": 3600,
  "feishu.webhookConfigured": true,
  "jira.enabled": true,
  "jira.baseUrl": "",
  "jira.projectKey": "AIEA",
  "jira.enableForLocal": false,
  "jira.mockWhenUnconfigured": false,
  "pipeline.enabled": true,
  "pipeline.notifyChannel": "feishu",
  "pipeline.notifyEnabled": true,
  "pipeline.detailBaseUrl": "http://localhost:8080",
  "notifyRouting.totalRules": 5,
  "notifyRouting.enabledRules": 4
}
```

---

## 12. 数据模型

### 12.1 ErrorEvent

错误事件（接入主表）。

**状态机**: `RECEIVED` → `ANALYZING` → `NOTIFIED` → `TICKETED` → `FAILED`；`SUPPRESSED`（冷却窗口内重复上报，不进入流水线）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Long | 主键 ID |
| fingerprint | String | 错误指纹（归一化堆栈哈希，64 字符） |
| env | String | 环境标识（默认 `local`） |
| service | String | 上报服务名 |
| message | String | 异常 message（最长 1024） |
| stack | String | 完整堆栈（TEXT） |
| contextJson | String | 上下文 JSON 字符串（版本/host/thread/MDC 等） |
| status | String | 处理状态（默认 `RECEIVED`） |
| createdAt | LocalDateTime | 创建时间 |
| updatedAt | LocalDateTime | 更新时间 |

---

### 12.2 AnalysisResult

大模型根因分析结果。`event_id` 为主键，与 `error_event` 一对一关联。

| 字段 | 类型 | 说明 |
|------|------|------|
| eventId | Long | 关联事件 ID（主键） |
| rootCause | String | 根因分析（TEXT） |
| suggestions | String | 修复建议 JSON 数组 |
| confidence | BigDecimal | 置信度 0~1（精度 5,4） |
| model | String | 使用的模型名 |
| rawResponse | String | LLM 原始返回（TEXT） |
| createdAt | LocalDateTime | 创建时间 |

---

### 12.3 NotifyRecord

协作推送记录（飞书/钉钉）。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Long | 主键 ID |
| eventId | Long | 关联事件 ID |
| channel | String | 通知渠道：`feishu`/`dingtalk` |
| payload | String | 推送报文内容（Markdown/卡片 JSON） |
| httpStatus | Integer | 推送 HTTP 状态码 |
| sentAt | LocalDateTime | 发送时间 |

---

### 12.4 JiraTicket

Jira 工单关联记录。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Long | 主键 ID |
| eventId | Long | 关联事件 ID |
| jiraKey | String | Jira Issue Key（如 `AIEA-123`） |
| project | String | Jira 项目 Key |
| url | String | Jira Issue URL |
| createdAt | LocalDateTime | 创建时间 |

---

### 12.5 NotifyRouting

通知路由规则（服务名 + 渠道 → Webhook）。唯一约束：`(service, channel)`。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Long | 主键 ID |
| service | String | 业务服务名 |
| channel | String | 通知渠道：`feishu`/`dingtalk`（默认 `feishu`） |
| webhookUrl | String | IM 自定义机器人 Webhook 地址 |
| description | String | 描述 |
| enabled | Boolean | 是否启用（默认 true） |
| createdAt | LocalDateTime | 创建时间 |
| updatedAt | LocalDateTime | 更新时间 |

---

### 12.6 InternalTicket

内置工单（替代外部 Jira）。同指纹有未关闭工单时复用。

**状态**: `OPEN` → `IN_PROGRESS` → `RESOLVED` → `CLOSED` / `IGNORED`

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Long | 主键 ID |
| eventId | Long | 关联事件 ID |
| fingerprint | String | 错误指纹 |
| title | String | 工单标题（AI 生成） |
| status | String | 工单状态（默认 `OPEN`） |
| priority | String | 优先级：`P0`/`P1`/`P2`/`P3`（默认 `P2`） |
| assignee | String | 处理人 |
| resolution | String | 解决方案（RESOLVED 时填写） |
| createdAt | LocalDateTime | 创建时间 |
| updatedAt | LocalDateTime | 更新时间 |
| resolvedAt | LocalDateTime | 解决时间 |
| closedAt | LocalDateTime | 关闭时间 |

---

### 12.7 TicketLog

工单操作记录（处理时间线）。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Long | 主键 ID |
| ticketId | Long | 关联工单 ID |
| action | String | 操作类型：`CREATE`/`CLAIM`/`RESOLVE`/`CLOSE`/`IGNORE`/`REOPEN`/`PRIORITY`/`STATUS`/`RECURRENCE` |
| oldValue | String | 变更前值 |
| newValue | String | 变更后值 |
| operator | String | 操作人 |
| remark | String | 备注 |
| createdAt | LocalDateTime | 创建时间 |

---

### 12.8 SuppressRule

告警抑制/冷却规则。`fingerprint` 为主键。

| 字段 | 类型 | 说明 |
|------|------|------|
| fingerprint | String | 错误指纹（主键） |
| cooldownSec | Integer | 冷却窗口秒数（默认 600） |
| lastFiredAt | LocalDateTime | 上次触发时间 |
| hitCount | Integer | 命中/合并次数（默认 0） |

---

### 12.9 ServiceRegistry

服务注册与上报鉴权（每服务一个 Token）。唯一约束：`service`、`api_token`。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Long | 主键 ID |
| service | String | 业务服务名 |
| apiToken | String | 服务专属上报 Token |
| description | String | 描述 |
| enabled | Boolean | 是否启用（默认 true） |
| createdAt | LocalDateTime | 创建时间 |
| updatedAt | LocalDateTime | 更新时间 |

---

### 12.10 SystemConfig

系统动态配置（key-value）。DB 优先、yaml 兜底。

| 字段 | 类型 | 说明 |
|------|------|------|
| configKey | String | 配置键（主键，如 `llm.model`） |
| configValue | String | 配置值 |
| description | String | 描述 |
| updatedAt | LocalDateTime | 更新时间 |

---

## 13. 错误处理

### 13.1 全局异常处理

系统通过 `GlobalExceptionHandler` 统一处理 `IllegalArgumentException`，返回 HTTP 400：

```json
{
  "status": 400,
  "error": "Bad Request",
  "message": "具体错误信息"
}
```

### 13.2 常见错误场景

| 场景 | HTTP 状态码 | 响应示例 |
|------|------------|---------|
| 参数校验失败 | 400 | `{"status":400,"error":"Bad Request","message":"service 不能为空"}` |
| 缺少鉴权 Token | 401 | `{"error":"缺少 X-AIEA-Token 请求头"}` |
| 服务未注册 | 401 | `{"error":"服务未注册: xxx，请先在服务注册页面添加"}` |
| Token 不匹配 | 401 | `{"error":"Token 不匹配"}` |
| 服务已禁用 | 403 | `{"error":"服务已被禁用: xxx"}` |
| 资源不存在 | 404 | `{"error":"event not found"}` 或 `{"status":404,"error":"Not Found","message":"..."}` |

---

> **备注**: 本文档基于 AIEA 后端源码自动生成，如代码变更请同步更新。  
> Swagger UI 地址: `http://localhost:8080/swagger-ui.html`
