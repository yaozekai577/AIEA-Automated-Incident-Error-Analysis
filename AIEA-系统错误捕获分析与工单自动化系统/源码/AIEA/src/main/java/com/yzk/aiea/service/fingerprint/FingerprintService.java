package com.yzk.aiea.service.fingerprint;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

import org.springframework.stereotype.Service;

/**
 * 错误指纹算法 v1
 * <p>
 * 对堆栈进行归一化处理（去除行号、UUID、时间戳等动态段），
 * 然后与 service + message 组合做 SHA-256，生成稳定的 64 位指纹。
 * <p>
 * 同一根因的异常（行号变化、UUID 变化等）应产生相同的指纹。
 */
@Service
public class FingerprintService {

    /**
     * 生成错误指纹
     *
     * @param service 服务名
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

            // 去除行号: "at com.foo.Bar.baz(Bar.java:123)" -> "at com.foo.Bar.baz(Bar.java)"
            s = s.replaceAll("\\((\\w+\\.java):\\d+\\)", "($1)");

            // 去除 UUID
            s = s.replaceAll("[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}", "<uuid>");

            // 去除十六进制地址 (0x...)
            s = s.replaceAll("0x[0-9a-fA-F]+", "<hex>");

            // 去除时间戳 (2026-08-03T12:34:56.789 或 2026-08-03 12:34:56)
            s = s.replaceAll("\\d{4}-\\d{2}-\\d{2}[T ]\\d{2}:\\d{2}:\\d{2}\\.?\\d*", "<ts>");

            // 去除纯数字行号引用 (如 ":123" 在非 java 文件中)
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
