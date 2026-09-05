package com.yzk.aiea.service.fingerprint;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

import org.junit.jupiter.api.Test;

class FingerprintServiceTest {

    private final FingerprintService service = new FingerprintService();

    @Test
    void sameRootCauseSameFingerprint() {
        String a = service.generate("svc", "boom", "at com.foo.Bar.baz(Bar.java:12)");
        String b = service.generate("svc", "boom", "at com.foo.Bar.baz(Bar.java:99)");
        assertEquals(a, b);
    }

    @Test
    void differentMessageDifferentFingerprint() {
        String a = service.generate("svc", "a", "stack");
        String b = service.generate("svc", "b", "stack");
        assertNotEquals(a, b);
    }
}
