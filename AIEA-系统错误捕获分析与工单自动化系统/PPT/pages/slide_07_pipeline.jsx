<Slide style={{ width: '1280px', height: '720px', padding: 0, background: '#ffffff' }}>
  <Box style={{ height: 120, padding: '0 60px', alignItems: 'center', borderBottom: '1px solid #E2E8F0' }}>
    <Text style={{ fontSize: 34, fontWeight: 'bold', color: '#1E293B' }}>端到端处理流水线</Text>
    <Text style={{ fontSize: 16, color: '#64748B', marginLeft: 18 }}>零侵入接入 · 异步编排 · 自动闭环</Text>
  </Box>
  <Box style={{ height: 540, padding: '30px 40px', alignItems: 'center', justifyContent: 'center' }}>
    <svg width="1180" height="430" viewBox="0 0 1180 430">
      <rect x="10" y="165" width="180" height="100" rx="12" fill="#1D4ED8" />
      <text x="100" y="205" textAnchor="middle" fill="#ffffff" fontSize="20" fontWeight="bold">业务系统</text>
      <text x="100" y="235" textAnchor="middle" fill="#ffffff" fontSize="20" fontWeight="bold">异常</text>

      <line x1="195" y1="215" x2="255" y2="215" stroke="#94A3B8" strokeWidth="3" />
      <polygon points="258,215 244,208 244,222" fill="#94A3B8" />

      <rect x="260" y="40" width="640" height="350" rx="16" fill="#F1F5F9" stroke="#0EA5E9" strokeWidth="2" />
      <text x="580" y="82" textAnchor="middle" fill="#1E293B" fontSize="22" fontWeight="bold">AIEA Server 异步流水线</text>

      <rect x="280" y="120" width="88" height="70" rx="10" fill="#ffffff" stroke="#1D4ED8" strokeWidth="2" />
      <text x="324" y="160" textAnchor="middle" fill="#1D4ED8" fontSize="16" fontWeight="bold">接入</text>
      <rect x="388" y="120" width="88" height="70" rx="10" fill="#ffffff" stroke="#1D4ED8" strokeWidth="2" />
      <text x="432" y="160" textAnchor="middle" fill="#1D4ED8" fontSize="16" fontWeight="bold">指纹</text>
      <rect x="496" y="120" width="88" height="70" rx="10" fill="#ffffff" stroke="#1D4ED8" strokeWidth="2" />
      <text x="540" y="160" textAnchor="middle" fill="#1D4ED8" fontSize="16" fontWeight="bold">去重</text>
      <rect x="604" y="120" width="88" height="70" rx="10" fill="#ffffff" stroke="#1D4ED8" strokeWidth="2" />
      <text x="648" y="160" textAnchor="middle" fill="#1D4ED8" fontSize="15" fontWeight="bold">AI分析</text>
      <rect x="712" y="120" width="88" height="70" rx="10" fill="#ffffff" stroke="#1D4ED8" strokeWidth="2" />
      <text x="756" y="160" textAnchor="middle" fill="#1D4ED8" fontSize="16" fontWeight="bold">建单</text>
      <rect x="820" y="120" width="66" height="70" rx="10" fill="#ffffff" stroke="#1D4ED8" strokeWidth="2" />
      <text x="853" y="160" textAnchor="middle" fill="#1D4ED8" fontSize="16" fontWeight="bold">通知</text>

      <line x1="368" y1="155" x2="386" y2="155" stroke="#94A3B8" strokeWidth="2" />
      <line x1="476" y1="155" x2="494" y2="155" stroke="#94A3B8" strokeWidth="2" />
      <line x1="584" y1="155" x2="602" y2="155" stroke="#94A3B8" strokeWidth="2" />
      <line x1="692" y1="155" x2="710" y2="155" stroke="#94A3B8" strokeWidth="2" />
      <line x1="800" y1="155" x2="818" y2="155" stroke="#94A3B8" strokeWidth="2" />

      <text x="580" y="250" textAnchor="middle" fill="#64748B" fontSize="16">接入方式：SDK · Logback Appender · 直接 HTTP（鉴权 + 限流 + 脱敏）</text>
      <text x="580" y="290" textAnchor="middle" fill="#64748B" fontSize="16">事务提交后触发异步流水线，避免脏读；任一组件故障自动降级兜底</text>
      <text x="580" y="340" textAnchor="middle" fill="#F59E0B" fontSize="16" fontWeight="bold">RECEIVED → ANALYZING → TICKETED → NOTIFIED / SUPPRESSED</text>

      <line x1="900" y1="215" x2="960" y2="215" stroke="#94A3B8" strokeWidth="3" />
      <polygon points="963,215 949,208 949,222" fill="#94A3B8" />

      <rect x="965" y="90" width="200" height="56" rx="10" fill="#0EA5E9" />
      <text x="1065" y="124" textAnchor="middle" fill="#ffffff" fontSize="18" fontWeight="bold">飞书群</text>
      <rect x="965" y="195" width="200" height="56" rx="10" fill="#0EA5E9" />
      <text x="1065" y="229" textAnchor="middle" fill="#ffffff" fontSize="18" fontWeight="bold">钉钉群</text>
      <rect x="965" y="300" width="200" height="56" rx="10" fill="#94A3B8" />
      <text x="1065" y="334" textAnchor="middle" fill="#ffffff" fontSize="18" fontWeight="bold">Jira（可选）</text>
    </svg>
  </Box>
  <Box style={{ height: 60, padding: '0 60px', alignItems: 'center', justifyContent: 'space-between' }}>
    <Text style={{ fontSize: 14, color: '#94A3B8' }}>AIEA · AI 错误根因分析平台</Text>
    <Text style={{ fontSize: 14, color: '#94A3B8' }}>07 / 15</Text>
  </Box>
</Slide>
