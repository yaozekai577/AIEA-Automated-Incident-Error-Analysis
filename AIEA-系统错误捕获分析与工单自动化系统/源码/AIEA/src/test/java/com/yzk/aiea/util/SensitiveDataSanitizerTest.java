package com.yzk.aiea.util;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class SensitiveDataSanitizerTest {

    @Test
    void sanitizeSecrets() {
        String input = "Authorization: Bearer abc.def.ghi password=secret123 user@test.com 13800138000";
        String out = SensitiveDataSanitizer.sanitize(input);
        assertFalse(out.contains("abc.def.ghi"));
        assertFalse(out.contains("secret123"));
        assertTrue(out.contains("***"));
    }
}
