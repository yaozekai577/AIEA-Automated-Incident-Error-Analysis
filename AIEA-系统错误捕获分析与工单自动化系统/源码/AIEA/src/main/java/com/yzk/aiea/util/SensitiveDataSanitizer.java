package com.yzk.aiea.util;

import java.util.regex.Pattern;

/**
 * 敏感信息脱敏（服务端二次防护）
 */
public final class SensitiveDataSanitizer {

    private static final Pattern EMAIL = Pattern.compile(
            "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}");
    private static final Pattern PHONE = Pattern.compile("(?<!\\d)1[3-9]\\d{9}(?!\\d)");
    private static final Pattern BEARER = Pattern.compile("(?i)(bearer\\s+)[a-zA-Z0-9._\\-]+");
    private static final Pattern KEY_VALUE = Pattern.compile(
            "(?i)(password|passwd|pwd|secret|api[_-]?key|token|authorization)\\s*[=:]\\s*[^\\s,;\"']+");

    private SensitiveDataSanitizer() {
    }

    public static String sanitize(String input) {
        if (input == null || input.isEmpty()) {
            return input;
        }
        String s = input;
        s = BEARER.matcher(s).replaceAll("$1***");
        s = KEY_VALUE.matcher(s).replaceAll("$1=***");
        s = EMAIL.matcher(s).replaceAll("***@***.***");
        s = PHONE.matcher(s).replaceAll("***********");
        return s;
    }
}
