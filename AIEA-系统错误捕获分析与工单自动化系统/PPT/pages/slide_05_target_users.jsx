<Slide style={{ width: '1280px', height: '720px', padding: 0, background: '#ffffff' }}>
  <Box style={{ height: 120, padding: '0 60px', alignItems: 'center', borderBottom: '1px solid #E2E8F0' }}>
    <Text style={{ fontSize: 34, fontWeight: 'bold', color: '#1E293B' }}>目标用户</Text>
    <Text style={{ fontSize: 16, color: '#64748B', marginLeft: 18 }}>面向中大型研发团队的全角色覆盖</Text>
  </Box>
  <Box style={{ height: 540, padding: '30px 60px', gap: 24 }}>
    <Table
      style={{ width: '100%', height: 360 }}
      defaultTextStyle={{ fontSize: 18, textAlign: 'left', color: '#1E293B' }}
      defaultCellStyle={{ border: { left: { width: 1, color: '#E2E8F0' }, right: { width: 1, color: '#E2E8F0' }, top: { width: 1, color: '#E2E8F0' }, bottom: { width: 1, color: '#E2E8F0' } } }}
      cells={[
        [
          { text: '角色', textStyle: { bold: true, color: '#fff', fontSize: 18 }, cellStyle: { background: { color: '#1D4ED8' } } },
          { text: '使用场景', textStyle: { bold: true, color: '#fff', fontSize: 18 }, cellStyle: { background: { color: '#1D4ED8' } } },
        ],
        [
          { text: '后端 / 全栈工程师', textStyle: { bold: true } },
          { text: '异常自动上报，无需手工粘贴堆栈；直接在工单中看到 AI 根因' },
        ],
        [
          { text: '技术负责人 / Tech Lead', textStyle: { bold: true }, cellStyle: { background: { color: '#F1F5F9' } } },
          { text: '通过仪表盘掌握全团队异常态势，按服务 / 环境维度治理', cellStyle: { background: { color: '#F1F5F9' } } },
        ],
        [
          { text: 'SRE / 运维', textStyle: { bold: true } },
          { text: '配置通知路由，把不同服务告警精准推送到对应飞书 / 钉钉群' },
        ],
        [
          { text: '测试 / 产品 / 值班', textStyle: { bold: true }, cellStyle: { background: { color: '#F1F5F9' } } },
          { text: '在群聊中第一时间收到带根因的告警卡片，快速感知风险', cellStyle: { background: { color: '#F1F5F9' } } },
        ],
      ]}
    />
    <Box style={{ flexDirection: 'row', gap: 16, alignItems: 'center', background: 'rgba(245,158,11,0.1)', padding: '18px 24px', borderRadius: 12 }}>
      <FAIcon name='info-circle' style={{ fill: '#F59E0B', width: 30, height: 30 }} />
      <Text style={{ fontSize: 18, color: '#1E293B', lineHeight: 1.6 }}>适用组织：采用微服务 / 多服务架构、使用飞书或钉钉协作、需要工单闭环（内置工单或 Jira）的研发团队。</Text>
    </Box>
  </Box>
  <Box style={{ height: 60, padding: '0 60px', alignItems: 'center', justifyContent: 'space-between' }}>
    <Text style={{ fontSize: 14, color: '#94A3B8' }}>AIEA · AI 错误根因分析平台</Text>
    <Text style={{ fontSize: 14, color: '#94A3B8' }}>05 / 15</Text>
  </Box>
</Slide>
