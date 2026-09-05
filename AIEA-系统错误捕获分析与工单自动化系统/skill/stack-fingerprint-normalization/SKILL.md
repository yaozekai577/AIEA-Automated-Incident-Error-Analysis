---
name: stack-fingerprint-normalization
description: Build a stack trace fingerprint algorithm with 5-step normalization (strip line numbers, UUIDs, hex addresses, timestamps, numeric references) and SHA-256 hashing to produce stable 64-char fingerprints. Use when designing error dedup systems, exception aggregation, alert suppression, or any APM/log analysis pipeline that needs to identify same-root-cause errors across occurrences with varying dynamic data.
---

# Stack Fingerprint Normalization Algorithm

## Problem It Solves

The same root-cause error produces **different** stack traces across occurrences due to dynamic data:

| Variation | Example | Without Normalization |
|-----------|---------|----------------------|
| Line numbers | `Bar.java:42` vs `Bar.java:55` | Different fingerprint |
| UUIDs | `request-id: a1b2-c3d4-...` | Different fingerprint |
| Hex addresses | `0x7f8a3b2c1d` | Different fingerprint |
| Timestamps | `2026-08-06T12:34:56.789` | Different fingerprint |
| Numeric refs | `line:123` | Different fingerprint |

**Goal**: After normalization, the same root-cause error always produces the **same 64-char SHA-256 fingerprint**.

## Algorithm Overview

```
输入: service + message + stack
         │
         ▼
┌─────────────────────────────┐
│ Step 0: Concatenate          │
│   service | message | stack  │
└──────────────┬──────────────┘
               ▼
┌─────────────────────────────┐
│ Step 1: Strip Java line nums │
│   (Bar.java:123) → (Bar.java)│
└──────────────┬──────────────┘
               ▼
┌─────────────────────────────┐
│ Step 2: Strip UUIDs          │
│   [8-4-4-4-12 hex] → <uuid>  │
└──────────────┬──────────────┘
               ▼
┌─────────────────────────────┐
│ Step 3: Strip hex addresses  │
│   0x[0-9a-fA-F]+ → <hex>     │
└──────────────┬──────────────┘
               ▼
┌─────────────────────────────┐
│ Step 4: Strip timestamps     │
│   YYYY-MM-DDTHH:MM:SS → <ts> │
└──────────────┬──────────────┘
               ▼
┌─────────────────────────────┐
│ Step 5: Strip numeric refs   │
│   :123 → :n                  │
└──────────────┬──────────────┘
               ▼
┌─────────────────────────────┐
│ SHA-256 → 64-char hex string │
└─────────────────────────────┘
```

## Full Implementation

```java
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

/**
 * 错误指纹算法
 * <p>
 * 对堆栈进行归一化处理（去除行号、UUID、时间戳等动态段），
 * 然后与 service + message 组合做 SHA-256，生成稳定的 64 位指纹。
 * <p>
 * 同一根因的异常（行号变化、UUID 变化等）应产生相同的指纹。
 */
public class FingerprintService {

    /**
     * 生成错误指纹
     *
     * @param service 服务名（参与指纹，不同服务相同异常视为不同错误）
     * @param message 异常 message
     * @param stack   完整堆栈（可为 null）
     * @return 64 字符的 SHA-256 十六进制指纹
     */
    public String generate(String service, String message, String stack) {
        String normalized = normalize(service, message, stack);
        return sha256Hex(normalized);
    }

    /**
     * 归一化：去除动态噪声段，保留结构性信息
     */
    private String normalize(String service, String message, String stack) {
        StringBuilder sb = new StringBuilder();
        sb.append(service != null ? service : "");
        sb.append("|");
        sb.append(message != null ? message : "");
        sb.append("|");

        if (stack != null && !stack.isBlank()) {
            String s = stack;

            // Step 1: 去除 Java 行号
            // "at com.foo.Bar.baz(Bar.java:123)" → "at com.foo.Bar.baz(Bar.java)"
            s = s.replaceAll("\\((\\w+\\.java):\\d+\\)", "($1)");

            // Step 2: 去除 UUID
            // "a1b2c3d4-e5f6-7890-abcd-ef1234567890" → "<uuid>"
            s = s.replaceAll(
                "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}",
                "<uuid>");

            // Step 3: 去除十六进制地址
            // "0x7f8a3b2c1d" → "<hex>"
            s = s.replaceAll("0x[0-9a-fA-F]+", "<hex>");

            // Step 4: 去除时间戳
            // "2026-08-06T12:34:56.789" or "2026-08-06 12:34:56" → "<ts>"
            s = s.replaceAll(
                "\\d{4}-\\d{2}-\\d{2}[T ]\\d{2}:\\d{2}:\\d{2}\\.?\\d*",
                "<ts>");

            // Step 5: 去除纯数字行号引用（非 Java 文件中的 ":123"）
            // ":123" → ":n"
            s = s.replaceAll(":\\d+", ":n");

            sb.append(s);
        }

        return sb.toString();
    }

    /**
     * SHA-256 哈希，返回 64 字符的十六进制字符串
     */
    private String sha256Hex(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (byte b : hash) {
                hex.append(String.format("%02x", b));
            }
            return hex.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }
}
```

## Normalization Step Details

### Step 1: Java Line Numbers

```
Input:  at com.foo.Bar.baz(Bar.java:123)
Output: at com.foo.Bar.baz(Bar.java)

Regex:  \((\w+\.java):\d+\)  →  ($1)
```

**Why**: Same method, different line numbers after code edits. Captures `FileName.java` as group 1, drops the `:lineNumber`.

### Step 2: UUIDs

```
Input:  request-id: a1b2c3d4-e5f6-7890-abcd-ef1234567890
Output: request-id: <uuid>

Regex:  [0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}
```

**Why**: Request/trace/correlation UUIDs vary per request but carry no root-cause information.

### Step 3: Hex Addresses

```
Input:  Memory address 0x7f8a3b2c1d
Output: Memory address <hex>

Regex:  0x[0-9a-fA-F]+
```

**Why**: Native memory addresses change between runs. Common in JNI, core dumps, and native stack frames.

### Step 4: Timestamps

```
Input:  2026-08-06T12:34:56.789  or  2026-08-06 12:34:56
Output: <ts>

Regex:  \d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}\.?\d*
```

**Why**: Timestamps embedded in log messages or error strings are always different. Matches ISO 8601 and space-separated formats, with optional fractional seconds.

### Step 5: Numeric References

```
Input:  line:123  or  offset:456
Output: line:n    or  offset:n

Regex:  :\d+
```

**Why**: Catches numeric line/offset references in non-Java file paths that Step 1 doesn't cover (e.g., `config.yml:42`).

## Why `service` and `message` Are in the Fingerprint

```
fingerprint = SHA-256(service | message | normalized_stack)
```

| Component | Included | Reason |
|-----------|----------|--------|
| `service` | Yes | Same exception in different services = different ownership, different fix |
| `message` | Yes | Different exception type (NPE vs SQLException) = different root cause |
| `stack` | Yes (normalized) | Structural stack trace defines the code path |

**Example**: An `NullPointerException` in `order-service` and `payment-service` with identical stack traces produce **different fingerprints** — they belong to different teams and may have different root causes despite similar code.

## Usage Example

```java
FingerprintService fpService = new FingerprintService();

// First occurrence
String fp1 = fpService.generate("order-service",
    "NullPointerException: Cannot invoke method on null object",
    "java.lang.NullPointerException\n\tat com.example.OrderService.process(OrderService.java:42)\n\tat com.example.OrderController.handle(OrderController.java:15)");

// Second occurrence (same code, line number changed after edit)
String fp2 = fpService.generate("order-service",
    "NullPointerException: Cannot invoke method on null object",
    "java.lang.NullPointerException\n\tat com.example.OrderService.process(OrderService.java:55)\n\tat com.example.OrderController.handle(OrderController.java:18)");

// fp1.equals(fp2) → true (same root cause, different line numbers)
```

## Fingerprint as a Join Key

The fingerprint serves as a **universal join key** across the system:

```
error_event.fingerprint ──────► suppress_rule.fingerprint (冷却去重)
                          ──────► internal_ticket.fingerprint (工单复用)
                          ──────► Redis aiea:dedup:{fingerprint} (实时冷却)
                          ──────► Redis aiea:llm:cache:{fingerprint} (分析缓存)
                          ──────► Error groups aggregation (前端聚合视图)
```

## Key Design Decisions

1. **SHA-256 over MD5**: SHA-256 has negligible collision risk; 64 chars is still compact enough for DB indexing
2. **Normalization before hashing**: Regex replacement is deterministic — same input always produces same normalized string
3. **`<placeholder>` tokens**: Replaced with readable tokens (`<uuid>`, `<hex>`, `<ts>`) rather than empty strings, preserving structural readability for debugging
4. **Pipe delimiter**: `service|message|stack` prevents ambiguity when fields contain each other's content
5. **Null-safe**: All fields handle null/blank gracefully — null stack still produces a valid fingerprint from service + message
6. **No external dependencies**: Pure JDK (`MessageDigest`, regex) — can be used in any Java 8+ project without libraries
