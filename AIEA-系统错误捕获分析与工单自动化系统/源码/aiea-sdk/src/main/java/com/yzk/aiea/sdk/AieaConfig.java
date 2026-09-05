package com.yzk.aiea.sdk;

/**
 * SDK 配置
 */
public class AieaConfig {

    private final String serverUrl;
    private final String apiToken;
    private final String service;
    private final String env;
    private final String releaseVersion;
    private final int connectTimeoutMs;
    private final int readTimeoutMs;

    private AieaConfig(Builder b) {
        this.serverUrl = b.serverUrl;
        this.apiToken = b.apiToken;
        this.service = b.service;
        this.env = b.env;
        this.releaseVersion = b.releaseVersion;
        this.connectTimeoutMs = b.connectTimeoutMs;
        this.readTimeoutMs = b.readTimeoutMs;
    }

    public static Builder builder() {
        return new Builder();
    }

    public String getServerUrl() {
        return serverUrl;
    }

    public String getApiToken() {
        return apiToken;
    }

    public String getService() {
        return service;
    }

    public String getEnv() {
        return env;
    }

    public String getReleaseVersion() {
        return releaseVersion;
    }

    public int getConnectTimeoutMs() {
        return connectTimeoutMs;
    }

    public int getReadTimeoutMs() {
        return readTimeoutMs;
    }

    public static final class Builder {
        private String serverUrl = "http://localhost:8080";
        private String apiToken = "";
        private String service = "unknown-service";
        private String env = "local";
        private String releaseVersion = "0.0.1";
        private int connectTimeoutMs = 2000;
        private int readTimeoutMs = 3000;

        public Builder serverUrl(String serverUrl) {
            this.serverUrl = serverUrl;
            return this;
        }

        public Builder apiToken(String apiToken) {
            this.apiToken = apiToken;
            return this;
        }

        public Builder service(String service) {
            this.service = service;
            return this;
        }

        public Builder env(String env) {
            this.env = env;
            return this;
        }

        public Builder releaseVersion(String releaseVersion) {
            this.releaseVersion = releaseVersion;
            return this;
        }

        public Builder connectTimeoutMs(int connectTimeoutMs) {
            this.connectTimeoutMs = connectTimeoutMs;
            return this;
        }

        public Builder readTimeoutMs(int readTimeoutMs) {
            this.readTimeoutMs = readTimeoutMs;
            return this;
        }

        public AieaConfig build() {
            return new AieaConfig(this);
        }
    }
}
