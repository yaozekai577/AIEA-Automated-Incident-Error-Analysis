<Slide style={{ width: '1280px', height: '720px', padding: 0, background: '#ffffff' }}>
  <Box style={{ height: 120, padding: '0 60px', alignItems: 'center', borderBottom: '1px solid #E2E8F0' }}>
    <Text style={{ fontSize: 34, fontWeight: 'bold', color: '#1E293B' }}>系统整体架构</Text>
    <Text style={{ fontSize: 16, color: '#64748B', marginLeft: 18 }}>Spring Boot 主服务 + 轻量 SDK + React 控制台</Text>
  </Box>
  <Box style={{ height: 540, flexDirection: 'row', padding: '24px 50px', gap: 30 }}>
    <Box style={{ width: '62%', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="700" height="500" viewBox="0 0 760 560">
        <rect x="40" y="20" width="300" height="70" rx="12" fill="#1D4ED8" />
        <text x="190" y="55" textAnchor="middle" fill="#ffffff" fontSize="17" fontWeight="bold">业务 Java 服务 + aiea-sdk</text>
        <rect x="420" y="20" width="300" height="70" rx="12" fill="#1D4ED8" />
        <text x="570" y="55" textAnchor="middle" fill="#ffffff" fontSize="17" fontWeight="bold">本地/存量系统 + Logback</text>

        <line x1="190" y1="90" x2="190" y2="138" stroke="#94A3B8" strokeWidth="3" />
        <line x1="570" y1="90" x2="570" y2="138" stroke="#94A3B8" strokeWidth="3" />
        <line x1="380" y1="120" x2="380" y2="138" stroke="#94A3B8" strokeWidth="3" />

        <rect x="40" y="140" width="680" height="200" rx="16" fill="#F1F5F9" stroke="#0EA5E9" strokeWidth="2" />
        <text x="380" y="178" textAnchor="middle" fill="#1E293B" fontSize="20" fontWeight="bold">AIEA Server（Spring Boot 3.3）</text>

        <rect x="60" y="210" width="95" height="80" rx="10" fill="#ffffff" stroke="#1D4ED8" strokeWidth="2" />
        <text x="107" y="255" textAnchor="middle" fill="#1D4ED8" fontSize="15" fontWeight="bold">接入</text>
        <rect x="169" y="210" width="95" height="80" rx="10" fill="#ffffff" stroke="#1D4ED8" strokeWidth="2" />
        <text x="216" y="255" textAnchor="middle" fill="#1D4ED8" fontSize="15" fontWeight="bold">指纹</text>
        <rect x="278" y="210" width="95" height="80" rx="10" fill="#ffffff" stroke="#1D4ED8" strokeWidth="2" />
        <text x="325" y="252" textAnchor="middle" fill="#1D4ED8" fontSize="14" fontWeight="bold">去重</text>
        <text x="325" y="272" textAnchor="middle" fill="#1D4ED8" fontSize="14" fontWeight="bold">限流</text>
        <rect x="387" y="210" width="95" height="80" rx="10" fill="#ffffff" stroke="#1D4ED8" strokeWidth="2" />
        <text x="434" y="255" textAnchor="middle" fill="#1D4ED8" fontSize="15" fontWeight="bold">流水线</text>
        <rect x="496" y="210" width="95" height="80" rx="10" fill="#ffffff" stroke="#1D4ED8" strokeWidth="2" />
        <text x="543" y="255" textAnchor="middle" fill="#1D4ED8" fontSize="15" fontWeight="bold">AI分析</text>
        <rect x="605" y="210" width="95" height="80" rx="10" fill="#ffffff" stroke="#1D4ED8" strokeWidth="2" />
        <text x="652" y="252" textAnchor="middle" fill="#1D4ED8" fontSize="14" fontWeight="bold">通知</text>
        <text x="652" y="272" textAnchor="middle" fill="#1D4ED8" fontSize="14" fontWeight="bold">工单</text>

        <line x1="155" y1="250" x2="167" y2="250" stroke="#94A3B8" strokeWidth="2" />
        <line x1="264" y1="250" x2="276" y2="250" stroke="#94A3B8" strokeWidth="2" />
        <line x1="373" y1="250" x2="385" y2="250" stroke="#94A3B8" strokeWidth="2" />
        <line x1="482" y1="250" x2="494" y2="250" stroke="#94A3B8" strokeWidth="2" />
        <line x1="591" y1="250" x2="603" y2="250" stroke="#94A3B8" strokeWidth="2" />

        <line x1="380" y1="340" x2="380" y2="395" stroke="#94A3B8" strokeWidth="3" />

        <rect x="40" y="400" width="120" height="60" rx="10" fill="#0EA5E9" />
        <text x="100" y="436" textAnchor="middle" fill="#ffffff" fontSize="16" fontWeight="bold">MySQL</text>
        <rect x="180" y="400" width="120" height="60" rx="10" fill="#0EA5E9" />
        <text x="240" y="436" textAnchor="middle" fill="#ffffff" fontSize="16" fontWeight="bold">Redis</text>
        <rect x="320" y="400" width="120" height="60" rx="10" fill="#0EA5E9" />
        <text x="380" y="436" textAnchor="middle" fill="#ffffff" fontSize="16" fontWeight="bold">LLM API</text>
        <rect x="460" y="400" width="120" height="60" rx="10" fill="#0EA5E9" />
        <text x="520" y="436" textAnchor="middle" fill="#ffffff" fontSize="14" fontWeight="bold">飞书/钉钉</text>
        <rect x="600" y="400" width="120" height="60" rx="10" fill="#94A3B8" />
        <text x="660" y="436" textAnchor="middle" fill="#ffffff" fontSize="14" fontWeight="bold">Jira(可选)</text>
      </svg>
    </Box>
    <Box style={{ width: '38%', justifyContent: 'center', gap: 22 }}>
      <Box style={{ background: '#F1F5F9', borderRadius: 12, padding: '18px 22px' }}>
        <Text style={{ fontSize: 19, fontWeight: 'bold', color: '#1D4ED8' }}>零侵入接入</Text>
        <Text style={{ fontSize: 15, color: '#64748B', marginTop: 4, lineHeight: 1.5 }}>SDK 与 Logback Appender 两种方式，业务代码改动极小。</Text>
      </Box>
      <Box style={{ background: '#F1F5F9', borderRadius: 12, padding: '18px 22px' }}>
        <Text style={{ fontSize: 19, fontWeight: 'bold', color: '#1D4ED8' }}>异步解耦</Text>
        <Text style={{ fontSize: 15, color: '#64748B', marginTop: 4, lineHeight: 1.5 }}>分析、建单、通知在事务提交后异步触发，不阻塞主链路。</Text>
      </Box>
      <Box style={{ background: '#F1F5F9', borderRadius: 12, padding: '18px 22px' }}>
        <Text style={{ fontSize: 19, fontWeight: 'bold', color: '#1D4ED8' }}>依赖可替换</Text>
        <Text style={{ fontSize: 15, color: '#64748B', marginTop: 4, lineHeight: 1.5 }}>大模型、IM、Jira 均按 OpenAI 兼容协议可选接入。</Text>
      </Box>
    </Box>
  </Box>
  <Box style={{ height: 60, padding: '0 60px', alignItems: 'center', justifyContent: 'space-between' }}>
    <Text style={{ fontSize: 14, color: '#94A3B8' }}>AIEA · AI 错误根因分析平台</Text>
    <Text style={{ fontSize: 14, color: '#94A3B8' }}>08 / 15</Text>
  </Box>
</Slide>
