package com.yzk.aiea.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

/**
 * 大模型相关 Bean 配置
 */
@Configuration
public class LlmConfig {

    /**
     * 配置了超时时间的 RestTemplate，用于调用大模型 API
     */
    @Bean
    public RestTemplate llmRestTemplate(LlmProperties properties) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(properties.getTimeout());
        factory.setReadTimeout(properties.getTimeout());
        return new RestTemplate(factory);
    }
}
