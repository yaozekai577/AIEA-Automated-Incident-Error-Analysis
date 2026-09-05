-- ============================================================
-- AIEA 数据库初始化脚本 (MySQL 8)
-- 对应《项目实施方案》4.3 关键数据实体
-- ============================================================

-- 建库
CREATE DATABASE IF NOT EXISTS aiea
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE aiea;

-- ------------------------------------------------------------
-- 1. error_event : 错误事件（接入主表）
--    状态机: RECEIVED -> ANALYZING -> NOTIFIED -> TICKETED -> FAILED
--          SUPPRESSED (冷却窗口内重复上报，不进入流水线)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS error_event (
  id            BIGINT       NOT NULL AUTO_INCREMENT,
  fingerprint   VARCHAR(64)  NOT NULL COMMENT '错误指纹(归一化堆栈哈希)',
  env           VARCHAR(32)  NOT NULL DEFAULT 'local' COMMENT 'local/dev/staging/prod',
  service       VARCHAR(128) NOT NULL COMMENT '上报服务名',
  message       VARCHAR(1024) NULL COMMENT '异常 message',
  stack         TEXT         NULL COMMENT '完整堆栈',
  context_json  JSON         NULL COMMENT '上下文(版本/host/thread/MDC 等)',
  status        VARCHAR(32)  NOT NULL DEFAULT 'RECEIVED' COMMENT '处理状态机',
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_fingerprint (fingerprint),
  INDEX idx_status (status),
  INDEX idx_env_service (env, service),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 2. analysis_result : 大模型根因分析结果
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS analysis_result (
  event_id      BIGINT       NOT NULL COMMENT '关联 error_event.id',
  root_cause    TEXT         NULL COMMENT '根因分析',
  suggestions   JSON         NULL COMMENT '修复建议(Top N)',
  confidence    DECIMAL(5,4) NULL COMMENT '置信度 0~1',
  model         VARCHAR(128) NULL COMMENT '使用的模型',
  raw_response  TEXT         NULL COMMENT 'LLM 原始返回',
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (event_id),
  CONSTRAINT fk_analysis_event FOREIGN KEY (event_id) REFERENCES error_event (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 3. notify_record : 协作推送记录(飞书/钉钉)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notify_record (
  id            BIGINT       NOT NULL AUTO_INCREMENT,
  event_id      BIGINT       NOT NULL,
  channel       VARCHAR(32)  NULL COMMENT 'feishu/dingtalk',
  payload       TEXT         NULL COMMENT '推送报文(Markdown/卡片 JSON)',
  http_status   INT          NULL COMMENT '推送 HTTP 状态码',
  sent_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_event_id (event_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 4. jira_ticket : Jira 工单关联
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS jira_ticket (
  id            BIGINT       NOT NULL AUTO_INCREMENT,
  event_id      BIGINT       NOT NULL,
  jira_key      VARCHAR(64)  NOT NULL COMMENT 'Jira Issue Key(如 AIEA-123)',
  project       VARCHAR(64)  NULL COMMENT 'Jira 项目 Key',
  url           VARCHAR(512) NULL COMMENT 'Jira Issue URL',
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_jira_key (jira_key),
  INDEX idx_event_id (event_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 5. suppress_rule : 告警抑制/冷却规则
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS suppress_rule (
  fingerprint    VARCHAR(64) NOT NULL COMMENT '错误指纹(粗键)',
  cooldown_sec   INT         NOT NULL DEFAULT 600 COMMENT '冷却窗口(秒)',
  last_fired_at  DATETIME    NULL COMMENT '上次触发时间',
  hit_count      INT         NOT NULL DEFAULT 0 COMMENT '命中/合并次数',
  PRIMARY KEY (fingerprint)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 6. internal_ticket : 内置工单（替代外部 Jira）
--    状态: OPEN -> IN_PROGRESS -> RESOLVED -> CLOSED / IGNORED
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS internal_ticket (
  id            BIGINT       NOT NULL AUTO_INCREMENT,
  event_id      BIGINT       NOT NULL COMMENT '关联 error_event.id',
  fingerprint   VARCHAR(64)  NOT NULL COMMENT '错误指纹(同指纹复用工单)',
  title         VARCHAR(255) NOT NULL COMMENT '工单标题',
  status        VARCHAR(32)  NOT NULL DEFAULT 'OPEN' COMMENT 'OPEN/IN_PROGRESS/RESOLVED/CLOSED/IGNORED',
  priority      VARCHAR(16)  NOT NULL DEFAULT 'P2' COMMENT 'P0/P1/P2/P3',
  assignee      VARCHAR(128) NULL COMMENT '处理人',
  resolution    TEXT         NULL COMMENT '解决方案(RESOLVED 时填写)',
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  resolved_at   DATETIME     NULL COMMENT '解决时间',
  closed_at     DATETIME     NULL COMMENT '关闭时间',
  PRIMARY KEY (id),
  INDEX idx_event_id (event_id),
  INDEX idx_fingerprint (fingerprint),
  INDEX idx_status (status),
  INDEX idx_assignee (assignee)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 7. ticket_log : 工单操作记录（处理时间线）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ticket_log (
  id            BIGINT       NOT NULL AUTO_INCREMENT,
  ticket_id     BIGINT       NOT NULL COMMENT '关联 internal_ticket.id',
  action        VARCHAR(32)  NOT NULL COMMENT 'CREATE/CLAIM/RESOLVE/CLOSE/IGNORE/REOPEN/PRIORITY',
  old_value     VARCHAR(255) NULL COMMENT '变更前值',
  new_value     VARCHAR(255) NULL COMMENT '变更后值',
  operator      VARCHAR(128) NULL COMMENT '操作人',
  remark        TEXT         NULL COMMENT '备注',
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_ticket_id (ticket_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 8. notify_routing : 通知路由规则（服务名 + 渠道 → Webhook）
--    按业务服务名 + 通知渠道将错误通知路由到不同的 IM 群机器人。
--    同一服务可配两条规则：一条 feishu、一条 dingtalk。
--    未配置路由的服务 fallback 到全局 feishu.webhook-url / dingtalk.webhook-url。
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notify_routing (
  id            BIGINT       NOT NULL AUTO_INCREMENT,
  service       VARCHAR(128) NOT NULL COMMENT '业务服务名(对应 error_event.service)',
  channel       VARCHAR(32)  NOT NULL DEFAULT 'feishu' COMMENT '通知渠道: feishu / dingtalk',
  webhook_url   VARCHAR(512) NOT NULL COMMENT 'IM 自定义机器人 Webhook 地址',
  description   VARCHAR(255) NULL COMMENT '描述(如: 订单服务专属飞书群)',
  enabled       TINYINT(1)   NOT NULL DEFAULT 1 COMMENT '是否启用(1=启用, 0=禁用)',
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_service_channel (service, channel)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 9. service_registry : 服务注册与上报鉴权（每服务一个 Token）
--    SDK 上报时需携带 X-AIEA-Token 头，服务端按 service+token 配对校验。
--    新增服务时自动生成 Token，支持禁用/重置。
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS service_registry (
  id            BIGINT       NOT NULL AUTO_INCREMENT,
  service       VARCHAR(128) NOT NULL COMMENT '业务服务名(对应 error_event.service)',
  api_token     VARCHAR(128) NOT NULL COMMENT '服务专属上报 Token',
  description   VARCHAR(255) NULL COMMENT '描述(如: 订单服务)',
  enabled       TINYINT(1)   NOT NULL DEFAULT 1 COMMENT '是否启用(1=启用, 0=禁用)',
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_service (service),
  UNIQUE KEY uk_api_token (api_token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 默认注册 demo-app 服务（配合 logback-spring.xml 中的 Appender 使用）
--INSERT INTO service_registry (service, api_token, description, enabled) VALUES
--  ('demo-app', 'tok_demo_app_001', '演示应用（内置）', 1)
--ON DUPLICATE KEY UPDATE api_token = api_token;

-- ------------------------------------------------------------
-- 10. system_config : 系统动态配置（key-value）
--    支持 LLM 等配置从前端管理，DB 优先、yaml 兜底。
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_config (
  config_key    VARCHAR(128) NOT NULL COMMENT '配置键(如 llm.model)',
  config_value  TEXT         NULL COMMENT '配置值',
  description   VARCHAR(255) NULL COMMENT '描述',
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (config_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
