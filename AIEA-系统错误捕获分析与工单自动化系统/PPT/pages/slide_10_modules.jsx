<Slide style={{ width: '1280px', height: '720px', padding: 0, background: '#ffffff' }}>
  <Box style={{ height: 120, padding: '0 60px', alignItems: 'center', borderBottom: '1px solid #E2E8F0' }}>
    <Text style={{ fontSize: 34, fontWeight: 'bold', color: '#1E293B' }}>核心功能模块</Text>
    <Text style={{ fontSize: 16, color: '#64748B', marginLeft: 18 }}>覆盖异常治理全生命周期的八大能力</Text>
  </Box>
  <Box style={{ height: 540, flexDirection: 'row', padding: '26px 60px', gap: 28 }}>
    <Box style={{ flex: 1, gap: 16 }}>
      <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 16, background: '#F1F5F9', borderRadius: 12, padding: '16px 20px' }}>
        <Box style={{ width: 52, height: 52, borderRadius: 12, background: '#1D4ED8', justifyContent: 'center', alignItems: 'center' }}><FAIcon name='upload' style={{ fill: '#ffffff', width: 26, height: 26 }} /></Box>
        <Box><Text style={{ fontSize: 21, fontWeight: 'bold', color: '#1E293B' }}>错误接入</Text><Text style={{ fontSize: 15, color: '#64748B' }}>SDK / Logback Appender / HTTP 零侵入上报</Text></Box>
      </Box>
      <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 16, background: '#F1F5F9', borderRadius: 12, padding: '16px 20px' }}>
        <Box style={{ width: 52, height: 52, borderRadius: 12, background: '#1D4ED8', justifyContent: 'center', alignItems: 'center' }}><FAIcon name='filter' style={{ fill: '#ffffff', width: 26, height: 26 }} /></Box>
        <Box><Text style={{ fontSize: 21, fontWeight: 'bold', color: '#1E293B' }}>智能去重</Text><Text style={{ fontSize: 15, color: '#64748B' }}>堆栈指纹归一化 + Redis 冷却窗口</Text></Box>
      </Box>
      <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 16, background: '#F1F5F9', borderRadius: 12, padding: '16px 20px' }}>
        <Box style={{ width: 52, height: 52, borderRadius: 12, background: '#1D4ED8', justifyContent: 'center', alignItems: 'center' }}><FAIcon name='robot' style={{ fill: '#ffffff', width: 26, height: 26 }} /></Box>
        <Box><Text style={{ fontSize: 21, fontWeight: 'bold', color: '#1E293B' }}>AI 根因分析</Text><Text style={{ fontSize: 15, color: '#64748B' }}>GLM-5.2 生成结构化报告，失败降级兜底</Text></Box>
      </Box>
      <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 16, background: '#F1F5F9', borderRadius: 12, padding: '16px 20px' }}>
        <Box style={{ width: 52, height: 52, borderRadius: 12, background: '#1D4ED8', justifyContent: 'center', alignItems: 'center' }}><FAIcon name='bell' style={{ fill: '#ffffff', width: 26, height: 26 }} /></Box>
        <Box><Text style={{ fontSize: 21, fontWeight: 'bold', color: '#1E293B' }}>协作通知</Text><Text style={{ fontSize: 15, color: '#64748B' }}>飞书/钉钉按服务 + 渠道路由推送</Text></Box>
      </Box>
    </Box>
    <Box style={{ flex: 1, gap: 16 }}>
      <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 16, background: '#F1F5F9', borderRadius: 12, padding: '16px 20px' }}>
        <Box style={{ width: 52, height: 52, borderRadius: 12, background: '#0EA5E9', justifyContent: 'center', alignItems: 'center' }}><FAIcon name='clipboard-list' style={{ fill: '#ffffff', width: 26, height: 26 }} /></Box>
        <Box><Text style={{ fontSize: 21, fontWeight: 'bold', color: '#1E293B' }}>工单闭环</Text><Text style={{ fontSize: 15, color: '#64748B' }}>内置工单全生命周期，不依赖 Jira</Text></Box>
      </Box>
      <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 16, background: '#F1F5F9', borderRadius: 12, padding: '16px 20px' }}>
        <Box style={{ width: 52, height: 52, borderRadius: 12, background: '#0EA5E9', justifyContent: 'center', alignItems: 'center' }}><FAIcon name='chart-bar' style={{ fill: '#ffffff', width: 26, height: 26 }} /></Box>
        <Box><Text style={{ fontSize: 21, fontWeight: 'bold', color: '#1E293B' }}>管理控制台</Text><Text style={{ fontSize: 15, color: '#64748B' }}>React 可视化，10 个页面统一管理</Text></Box>
      </Box>
      <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 16, background: '#F1F5F9', borderRadius: 12, padding: '16px 20px' }}>
        <Box style={{ width: 52, height: 52, borderRadius: 12, background: '#0EA5E9', justifyContent: 'center', alignItems: 'center' }}><FAIcon name='cog' style={{ fill: '#ffffff', width: 26, height: 26 }} /></Box>
        <Box><Text style={{ fontSize: 21, fontWeight: 'bold', color: '#1E293B' }}>动态配置</Text><Text style={{ fontSize: 15, color: '#64748B' }}>DB &gt; yaml &gt; 默认值，前端热更新</Text></Box>
      </Box>
      <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 16, background: '#F1F5F9', borderRadius: 12, padding: '16px 20px' }}>
        <Box style={{ width: 52, height: 52, borderRadius: 12, background: '#0EA5E9', justifyContent: 'center', alignItems: 'center' }}><FAIcon name='shield' style={{ fill: '#ffffff', width: 26, height: 26 }} /></Box>
        <Box><Text style={{ fontSize: 21, fontWeight: 'bold', color: '#1E293B' }}>敏感脱敏</Text><Text style={{ fontSize: 15, color: '#64748B' }}>双层脱敏，上报 Token 仅展示一次</Text></Box>
      </Box>
    </Box>
  </Box>
  <Box style={{ height: 60, padding: '0 60px', alignItems: 'center', justifyContent: 'space-between' }}>
    <Text style={{ fontSize: 14, color: '#94A3B8' }}>AIEA · AI 错误根因分析平台</Text>
    <Text style={{ fontSize: 14, color: '#94A3B8' }}>10 / 15</Text>
  </Box>
</Slide>
