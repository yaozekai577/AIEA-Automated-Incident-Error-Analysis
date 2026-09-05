<Slide style={{ width: '1280px', height: '720px', padding: 0, background: '#ffffff' }}>
  <Box style={{ height: 120, padding: '0 60px', alignItems: 'center', borderBottom: '1px solid #E2E8F0' }}>
    <Text style={{ fontSize: 34, fontWeight: 'bold', color: '#1E293B' }}>关键技术亮点</Text>
    <Text style={{ fontSize: 16, color: '#64748B', marginLeft: 18 }}>六个工程化创新点</Text>
  </Box>
  <Box style={{ height: 540, padding: '26px 60px', gap: 22, justifyContent: 'center' }}>
    <Box style={{ flexDirection: 'row', gap: 22 }}>
      <Box style={{ flex: 1, background: '#F1F5F9', borderRadius: 14, padding: '22px 24px' }}>
        <Box style={{ width: 56, height: 56, borderRadius: 14, background: '#1D4ED8', justifyContent: 'center', alignItems: 'center', marginBottom: 14 }}><FAIcon name='fingerprint' style={{ fill: '#ffffff', width: 28, height: 28 }} /></Box>
        <Text style={{ fontSize: 21, fontWeight: 'bold', color: '#1E293B' }}>堆栈指纹归一化</Text>
        <Text style={{ fontSize: 15, color: '#64748B', marginTop: 8, lineHeight: 1.55 }}>去行号 / UUID / hex / 时间戳，SHA-256 生成 64 位指纹。</Text>
      </Box>
      <Box style={{ flex: 1, background: '#F1F5F9', borderRadius: 14, padding: '22px 24px' }}>
        <Box style={{ width: 56, height: 56, borderRadius: 14, background: '#1D4ED8', justifyContent: 'center', alignItems: 'center', marginBottom: 14 }}><FAIcon name='clock' style={{ fill: '#ffffff', width: 28, height: 28 }} /></Box>
        <Text style={{ fontSize: 21, fontWeight: 'bold', color: '#1E293B' }}>Redis 冷却窗口</Text>
        <Text style={{ fontSize: 15, color: '#64748B', marginTop: 8, lineHeight: 1.55 }}>同类错误自动合并计数，冷却期内不重复刷屏。</Text>
      </Box>
      <Box style={{ flex: 1, background: '#F1F5F9', borderRadius: 14, padding: '22px 24px' }}>
        <Box style={{ width: 56, height: 56, borderRadius: 14, background: '#1D4ED8', justifyContent: 'center', alignItems: 'center', marginBottom: 14 }}><FAIcon name='bolt' style={{ fill: '#ffffff', width: 28, height: 28 }} /></Box>
        <Text style={{ fontSize: 21, fontWeight: 'bold', color: '#1E293B' }}>异步流水线</Text>
        <Text style={{ fontSize: 15, color: '#64748B', marginTop: 8, lineHeight: 1.55 }}>分析→建单→通知，事务提交后触发，避免脏读。</Text>
      </Box>
    </Box>
    <Box style={{ flexDirection: 'row', gap: 22 }}>
      <Box style={{ flex: 1, background: '#F1F5F9', borderRadius: 14, padding: '22px 24px' }}>
        <Box style={{ width: 56, height: 56, borderRadius: 14, background: '#0EA5E9', justifyContent: 'center', alignItems: 'center', marginBottom: 14 }}><FAIcon name='sitemap' style={{ fill: '#ffffff', width: 28, height: 28 }} /></Box>
        <Text style={{ fontSize: 21, fontWeight: 'bold', color: '#1E293B' }}>多通道通知路由</Text>
        <Text style={{ fontSize: 15, color: '#64748B', marginTop: 8, lineHeight: 1.55 }}>按服务 + 渠道精准推送到不同飞书 / 钉钉群。</Text>
      </Box>
      <Box style={{ flex: 1, background: '#F1F5F9', borderRadius: 14, padding: '22px 24px' }}>
        <Box style={{ width: 56, height: 56, borderRadius: 14, background: '#0EA5E9', justifyContent: 'center', alignItems: 'center', marginBottom: 14 }}><FAIcon name='plug' style={{ fill: '#ffffff', width: 28, height: 28 }} /></Box>
        <Text style={{ fontSize: 21, fontWeight: 'bold', color: '#1E293B' }}>零侵入接入</Text>
        <Text style={{ fontSize: 15, color: '#64748B', marginTop: 8, lineHeight: 1.55 }}>SDK 与 Logback Appender 两种方式，业务改动极小。</Text>
      </Box>
      <Box style={{ flex: 1, background: '#F1F5F9', borderRadius: 14, padding: '22px 24px' }}>
        <Box style={{ width: 56, height: 56, borderRadius: 14, background: '#0EA5E9', justifyContent: 'center', alignItems: 'center', marginBottom: 14 }}><FAIcon name='ticket-alt' style={{ fill: '#ffffff', width: 28, height: 28 }} /></Box>
        <Text style={{ fontSize: 21, fontWeight: 'bold', color: '#1E293B' }}>内置工单不依赖 Jira</Text>
        <Text style={{ fontSize: 15, color: '#64748B', marginTop: 8, lineHeight: 1.55 }}>完整生命周期 + 操作时间线，可选对接 Jira。</Text>
      </Box>
    </Box>
  </Box>
  <Box style={{ height: 60, padding: '0 60px', alignItems: 'center', justifyContent: 'space-between' }}>
    <Text style={{ fontSize: 14, color: '#94A3B8' }}>AIEA · AI 错误根因分析平台</Text>
    <Text style={{ fontSize: 14, color: '#94A3B8' }}>12 / 15</Text>
  </Box>
</Slide>
