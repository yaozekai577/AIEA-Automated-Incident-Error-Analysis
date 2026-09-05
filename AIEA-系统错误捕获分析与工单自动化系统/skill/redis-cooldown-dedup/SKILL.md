---
name: redis-cooldown-dedup
description: Build a Redis-based cooldown/dedup pattern using SET NX + INCR + TTL for alert suppression, message deduplication, and rate-window control with fail-open degradation. Use when designing alert suppression systems, duplicate message filtering, cooldown windows, anti-repeat-submission, or any scenario requiring "same-key events within a time window should be merged/counted instead of re-triggered."
---

# Redis Cooldown Dedup Pattern (SET NX + INCR + TTL)

## Problem It Solves

When the same error/event fires repeatedly within a short window:

```
00:00:01  NullPointerException  → 触发分析+通知+建单  ✅ 首次
00:00:03  NullPointerException  → 再次触发?           ❌ 应抑制
00:00:05  NullPointerException  → 再次触发?           ❌ 应抑制
00:00:08  NullPointerException  → 再次触发?           ❌ 应抑制
00:02:01  (冷却窗口过期)
00:02:03  NullPointerException  → 触发分析+通知+建单  ✅ 新窗口首次
```

**Goal**: Within a configurable cooldown window, same-fingerprint events are **suppressed and counted**, not re-triggered. After window expiry, the next occurrence is treated as fresh.

## Algorithm Overview

```
Key:    {prefix}:{fingerprint}
Type:   String (counter)
TTL:    cooldown_sec (configurable per-fingerprint)

首次上报:
  SET key "0" NX EX {cooldown_sec}
  → acquired = true  → 未被抑制, hitCount = 0

冷却窗口内重复:
  SET NX 失败 (key 已存在)
  → INCR key → hitCount = N
  → suppressed = true

窗口过期后:
  Key 自动删除 (TTL)
  → 下一次 SET NX 成功 → 新窗口开始
```

## Full Implementation

```java
import java.time.Duration;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

/**
 * 基于 Redis 的冷却/去重服务
 * <p>
 * 核心设计：
 * <ul>
 *   <li>首次上报：SET key=0 EX=cooldown → 未被抑制</li>
 *   <li>窗口内重复：INCR key → 被抑制，返回命中次数</li>
 *   <li>窗口过期后：key 自动删除，下一次上报视为首次</li>
 * </ul>
 * Redis 不可用时降级返回「未抑制」，保证主链路不中断。
 */
@Service
public class RedisDedupService {

    private static final String DEDUP_PREFIX = "dedup:";

    private final StringRedisTemplate redisTemplate;

    public RedisDedupService(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    /**
     * 尝试获取冷却锁
     *
     * @param key             去重键 (如 fingerprint)
     * @param cooldownSeconds 冷却窗口（秒）
     * @return DedupResult：suppressed=true 表示在冷却窗口内被抑制，hitCount 为合并次数
     */
    public DedupResult checkAndMark(String key, int cooldownSeconds) {
        String redisKey = DEDUP_PREFIX + key;
        try {
            // 尝试 SET NX (仅当 key 不存在时设置)，value 初始为 "0"
            Boolean acquired = redisTemplate.opsForValue()
                    .setIfAbsent(redisKey, "0", Duration.ofSeconds(cooldownSeconds));

            if (Boolean.TRUE.equals(acquired)) {
                // 首次进入，未被抑制
                return new DedupResult(false, 0);
            }

            // key 已存在 → 在冷却窗口内，原子递增命中计数
            Long hitCount = redisTemplate.opsForValue().increment(redisKey);
            int hits = hitCount != null ? hitCount.intValue() : 1;
            return new DedupResult(true, hits);

        } catch (Exception e) {
            // Redis 不可用 → 降级放行 (fail-open)
            log.warn("Redis 去重检查失败，降级放行: key={}, error={}", key, e.getMessage());
            return new DedupResult(false, 0);
        }
    }

    /**
     * 获取当前键的命中次数（用于展示「合并 N 次」）
     *
     * @param key 去重键
     * @return 命中次数，Redis 不可用或无记录时返回 0
     */
    public int getHitCount(String key) {
        try {
            String val = redisTemplate.opsForValue().get(DEDUP_PREFIX + key);
            if (val == null) return 0;
            return Integer.parseInt(val);
        } catch (Exception e) {
            log.warn("Redis 获取命中次数失败: key={}, error={}", key, e.getMessage());
            return 0;
        }
    }

    /**
     * 去重结果
     *
     * @param suppressed 是否被抑制
     * @param hitCount   冷却窗口内命中次数（0 = 首次）
     */
    public record DedupResult(boolean suppressed, int hitCount) {}
}
```

## Why SET NX + INCR + TTL (Not Other Approaches)

| Approach | Problem | This Pattern |
|----------|---------|--------------|
| GET → check → SET | Race condition: two threads both GET null, both SET | `SET NX` is atomic — only one wins |
| Separate EXPIRE after SET | Key may persist forever if EXPIRE fails | `SET NX EX` sets TTL atomically |
| INCR with separate TTL | First INCR creates key without TTL → key never expires | First operation is `SET NX EX`, subsequent are `INCR` (TTL already set) |
| Lua script | Works but adds complexity | No Lua needed — two simple atomic ops |
| DB-based dedup | Slow, can't handle high QPS, hard to expire | Redis is in-memory, TTL auto-expires |

## Step-by-Step Redis Commands

```
# 首次上报 (cooldown = 120s)
SET dedup:fingerprint_abc "0" NX EX 120
→ Result: OK (set成功)
→ acquired = true → suppressed = false, hitCount = 0

# 3秒后重复上报
SET dedup:fingerprint_abc "0" NX EX 120
→ Result: nil (key已存在，SET NX失败)
INCR dedup:fingerprint_abc
→ Result: 1
→ suppressed = true, hitCount = 1

# 10秒后再次重复
SET dedup:fingerprint_abc "0" NX EX 120
→ Result: nil
INCR dedup:fingerprint_abc
→ Result: 2
→ suppressed = true, hitCount = 2

# 120秒后 (TTL过期，key自动删除)
SET dedup:fingerprint_abc "0" NX EX 120
→ Result: OK (新窗口开始)
→ suppressed = false, hitCount = 0
```

## Per-Key Cooldown Customization

Cooldown time can be customized per-key, read from DB with global fallback:

```java
/**
 * 解析冷却时间：优先使用 DB 中该 key 的自定义值，否则用全局默认
 */
private int resolveCooldown(String key) {
    // DB: suppress_rule table — allows runtime adjustment per key
    return suppressRuleRepository.findById(key)
            .map(SuppressRule::getCooldownSec)
            .filter(sec -> sec != null && sec > 0)
            .orElse(globalCooldownSeconds);  // 默认 120s
}

// Usage:
int cooldown = resolveCooldown(fingerprint);
DedupResult result = dedupService.checkAndMark(fingerprint, cooldown);
```

## DB Audit Table (Optional, for Persistence)

Redis is the primary dedup engine. DB table serves as **audit trail**:

```sql
CREATE TABLE suppress_rule (
    fingerprint    VARCHAR(64) NOT NULL COMMENT '去重键',
    cooldown_sec   INT         NOT NULL DEFAULT 600 COMMENT '冷却窗口(秒)',
    last_fired_at  DATETIME    NULL COMMENT '上次触发时间',
    hit_count      INT         NOT NULL DEFAULT 0 COMMENT '命中/合并次数',
    PRIMARY KEY (fingerprint)
) ENGINE=InnoDB;
```

```java
/**
 * 持久化审计记录
 * Redis 是主去重引擎，DB 表仅用于审计追溯。
 * suppressed=true 时更新命中次数；suppressed=false 时重置计数。
 * 不覆盖已有的自定义 cooldownSec。
 */
private void persistAudit(String key, boolean suppressed, int hitCount) {
    try {
        SuppressRule rule = repository.findById(key).orElse(null);
        if (rule == null) {
            rule = new SuppressRule();
            rule.setFingerprint(key);
            rule.setCooldownSec(globalCooldownSeconds);
            rule.setLastFiredAt(LocalDateTime.now());
            rule.setHitCount(hitCount);
        } else {
            if (suppressed) {
                rule.setHitCount(hitCount);
            } else {
                rule.setLastFiredAt(LocalDateTime.now());
                rule.setHitCount(0);  // 新窗口重置
                // 不覆盖已有 cooldownSec，保留用户自定义值
            }
        }
        repository.save(rule);
    } catch (Exception e) {
        // 审计写入失败不阻断主流程
        log.warn("审计记录写入失败（不影响主流程）: key={}, error={}", key, e.getMessage());
    }
}
```

## Integration with Downstream Pipeline

```java
// In ingest/entry service:
int cooldown = resolveCooldown(fingerprint);
DedupResult result = dedupService.checkAndMark(fingerprint, cooldown);

if (result.suppressed()) {
    // 抑制: 入库标记 SUPPRESSED，不触发下游
    event.setStatus("SUPPRESSED");
    eventRepository.save(event);
    // 可选: 在关联工单上记录复发
    ticketService.recordRecurrence(fingerprint, result.hitCount());
} else {
    // 放行: 入库标记 RECEIVED，触发异步流水线
    event.setStatus("RECEIVED");
    eventRepository.save(event);
    pipelineService.processAsync(event.getId());
}

// 返回给调用方
return new Response(
    event.getId(),
    fingerprint,
    event.getStatus(),
    result.suppressed(),
    result.hitCount(),
    result.suppressed()
        ? "已抑制（冷却窗口内第" + result.hitCount() + "次合并）"
        : "已入库，已触发异步处理"
);
```

## Fail-Open Degradation Strategy

```
Redis 状态          行为                      影响
─────────────────────────────────────────────────────────
正常                去重生效                   同类错误合并计数
不可用 (网络/宕机)   降级放行 (suppressed=false)  可能重复触发下游
                                   但主链路不中断
恢复                自动恢复去重               新 key 正常工作
```

**All Redis operations wrapped in try-catch**: Failure returns `DedupResult(false, 0)` — the system continues to function, just without dedup. This is a deliberate design choice: **availability over precision**.

## Hit Count Usage

The `hitCount` from `getHitCount()` can be used in downstream:

```java
// In notification message:
if (mergedHits > 0) {
    content.append("**合并次数**: ").append(mergedHits).append("\n");
}

// In ticket recurrence:
if (hitCount > 0) {
    ticketLog.setRemark("错误再次发生（冷却窗口内第" + hitCount + "次合并）");
    // If ticket was RESOLVED → auto-reopen
}
```

## Key Design Decisions

1. **`SET NX` not `SET`**: NX ensures only the first occurrence wins; subsequent ones see the key exists
2. **`EX` in same command**: Atomic TTL setting — no window where key exists without expiry
3. **Initial value `"0"`**: Counter starts at 0; first `INCR` makes it 1 (first duplicate)
4. **`INCR` is atomic**: Multiple concurrent duplicates all get correct incrementing hitCount
5. **TTL auto-cleanup**: No manual key deletion needed — Redis auto-expires after cooldown
6. **Fail-open**: Redis failure → allow all (no suppression) — better to over-notify than to block
7. **DB audit optional**: Redis is source of truth for real-time decisions; DB is for audit/config only
8. **Per-key cooldown**: DB table allows runtime adjustment of cooldown per key without code change
