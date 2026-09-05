<Slide style={{ width: '1280px', height: '720px', padding: 0, background: '#ffffff' }}>
  <Box style={{ height: 120, padding: '0 60px', alignItems: 'center', borderBottom: '1px solid #E2E8F0' }}>
    <Text style={{ fontSize: 34, fontWeight: 'bold', color: '#1E293B' }}>背景与核心痛点</Text>
    <Text style={{ fontSize: 16, color: '#64748B', marginLeft: 18 }}>传统异常处理链路的五大结构性问题</Text>
  </Box>
  <Box style={{ height: 540, flexDirection: 'row', padding: '30px 60px', gap: 40 }}>
    <Box style={{ width: '34%', justifyContent: 'center', background: 'linear-gradient(135deg, #1D4ED8 0%, #0EA5E9 100%)', borderRadius: 16, padding: '40px 34px' }}>
      <Text style={{ fontSize: 30, fontWeight: 'bold', color: '#ffffff', lineHeight: 1.4 }}>流程长</Text>
      <Text style={{ fontSize: 30, fontWeight: 'bold', color: '#ffffff', lineHeight: 1.4, marginTop: 4 }}>重复多</Text>
      <Text style={{ fontSize: 30, fontWeight: 'bold', color: '#F59E0B', lineHeight: 1.4, marginTop: 4 }}>缺沉淀</Text>
      <Text style={{ fontSize: 18, color: 'rgba(255,255,255,0.85)', marginTop: 26, lineHeight: 1.7 }}>从异常发生到人员感知，平均延迟可达数十分钟甚至数小时。</Text>
    </Box>
    <Box style={{ flex: 1, justifyContent: 'space-between' }}>
      <Box style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 18 }}>
        <FAIcon name='clock' style={{ fill: '#1D4ED8', width: 34, height: 34, marginTop: 4 }} />
        <Box><Text style={{ fontSize: 22, fontWeight: 'bold', color: '#1E293B' }}>① 异常发现滞后</Text><Text style={{ fontSize: 16, color: '#64748B' }}>依赖人工巡检日志，微服务跨节点排查耗时巨大。</Text></Box>
      </Box>
      <Box style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 18 }}>
        <FAIcon name='redo' style={{ fill: '#1D4ED8', width: 34, height: 34, marginTop: 4 }} />
        <Box><Text style={{ fontSize: 22, fontWeight: 'bold', color: '#1E293B' }}>② 同类错误反复</Text><Text style={{ fontSize: 16, color: '#64748B' }}>缺少指纹归集，历史排查经验无法复用。</Text></Box>
      </Box>
      <Box style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 18 }}>
        <FAIcon name='comment' style={{ fill: '#1D4ED8', width: 34, height: 34, marginTop: 4 }} />
        <Box><Text style={{ fontSize: 22, fontWeight: 'bold', color: '#1E293B' }}>③ 群聊通知碎片化</Text><Text style={{ fontSize: 16, color: '#64748B' }}>缺环境/服务/版本上下文，重要告警被淹没。</Text></Box>
      </Box>
      <Box style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 18 }}>
        <FAIcon name='file' style={{ fill: '#1D4ED8', width: 34, height: 34, marginTop: 4 }} />
        <Box><Text style={{ fontSize: 22, fontWeight: 'bold', color: '#1E293B' }}>④ 工单手工创建</Text><Text style={{ fontSize: 16, color: '#64748B' }}>复制堆栈、填描述、指派处理人，流程割裂。</Text></Box>
      </Box>
      <Box style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 18 }}>
        <FAIcon name='user' style={{ fill: '#1D4ED8', width: 34, height: 34, marginTop: 4 }} />
        <Box><Text style={{ fontSize: 22, fontWeight: 'bold', color: '#1E293B' }}>⑤ 根因依赖经验</Text><Text style={{ fontSize: 16, color: '#64748B' }}>定位根因靠资深开发者，新人上手慢。</Text></Box>
      </Box>
    </Box>
  </Box>
  <Box style={{ height: 60, padding: '0 60px', alignItems: 'center', justifyContent: 'space-between' }}>
    <Text style={{ fontSize: 14, color: '#94A3B8' }}>AIEA · AI 错误根因分析平台</Text>
    <Text style={{ fontSize: 14, color: '#94A3B8' }}>04 / 15</Text>
  </Box>
</Slide>
