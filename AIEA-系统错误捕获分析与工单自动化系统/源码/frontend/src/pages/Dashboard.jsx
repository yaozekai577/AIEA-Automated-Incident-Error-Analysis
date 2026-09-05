import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { Card, Col, Row, Statistic, Table, Tag, Spin, message, Progress, Tooltip, Switch, Space, Alert } from 'antd'
import {
  BugOutlined,
  CheckCircleOutlined,
  AlertOutlined,
  SyncOutlined,
  RobotOutlined,
  NotificationOutlined,
  LinkOutlined,
  KeyOutlined,
  BellOutlined,
  FireOutlined, ThunderboltOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { getErrors, getStatsOverview } from '../api'
import dayjs from 'dayjs'

const statusColors = {
  RECEIVED: 'blue',
  ANALYZING: 'processing',
  NOTIFIED: 'green',
  TICKETED: 'cyan',
  FAILED: 'red',
  SUPPRESSED: 'default',
}

const statusLabels = {
  RECEIVED: '已接收',
  ANALYZING: '分析中',
  NOTIFIED: '已通知',
  TICKETED: '已建单',
  FAILED: '失败',
  SUPPRESSED: '已抑制',
}

const envColors = { local: 'orange', dev: 'blue', staging: 'purple', prod: 'red' }
const envLabels = { local: '本地', dev: '开发', staging: '预发', prod: '生产' }

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [errors, setErrors] = useState([])
  const [overview, setOverview] = useState(null)
  const navigate = useNavigate()

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [errorsRes, overviewRes] = await Promise.all([
        getErrors(),
        getStatsOverview().catch(() => ({ data: null })),
      ])
      setErrors(errorsRes.data)
      setOverview(overviewRes.data)
    } catch (err) {
      message.error('加载数据失败: ' + (err.response?.data?.error || err.message))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const [autoRefresh, setAutoRefresh] = useState(true)
  useEffect(() => {
    if (!autoRefresh) return
    const timer = setInterval(fetchData, 15000)
    return () => clearInterval(timer)
  }, [autoRefresh, fetchData])

  const stats = {
    total: errors.length,
    failed: errors.filter(e => e.status === 'FAILED').length,
    notified: errors.filter(e => e.status === 'NOTIFIED' || e.status === 'TICKETED').length,
    analyzing: errors.filter(e => e.status === 'RECEIVED' || e.status === 'ANALYZING').length,
    suppressed: errors.filter(e => e.status === 'SUPPRESSED').length,
  }

  // 按服务统计
  const serviceStats = Object.entries(
    errors.reduce((acc, e) => {
      acc[e.service] = (acc[e.service] || 0) + 1
      return acc
    }, {})
  ).sort((a, b) => b[1] - a[1])

  // 最近 7 天趋势
  const last7Days = []
  for (let i = 6; i >= 0; i--) {
    const day = dayjs().subtract(i, 'day')
    const dayStr = day.format('MM-DD')
    const count = errors.filter(e =>
      dayjs(e.createdAt).isSame(day, 'day')
    ).length
    last7Days.push({ day: dayStr, count })
  }

  const maxDayCount = Math.max(...last7Days.map(d => d.count), 1)

  const recentErrors = [...errors]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 8)

  // 错误热力图数据 (7天 × 24小时)
  const heatmapData = useMemo(() => {
    const grid = Array.from({ length: 7 }, () => Array(24).fill(0))
    errors.forEach(e => {
      if (e.createdAt) {
        const d = dayjs(e.createdAt)
        const day = d.day() === 0 ? 6 : d.day() - 1 // 周一=0, 周日=6
        grid[day][d.hour()]++
      }
    })
    return grid
  }, [errors])
  const maxHeat = Math.max(...heatmapData.flat(), 1)

  // 系统健康度评分 (0-100)
  const healthScore = useMemo(() => {
    if (errors.length === 0) return 100
    const failRate = stats.failed / errors.length
    const stuckRate = stats.analyzing / errors.length
    const score = 100 - failRate * 50 - stuckRate * 30
    return Math.max(0, Math.min(100, Math.round(score)))
  }, [errors.length, stats])

  // 智能洞察
  const insights = useMemo(() => {
    const tips = []
    const todayCount = last7Days[6]?.count || 0
    const yesterdayCount = last7Days[5]?.count || 0
    if (yesterdayCount > 0 && todayCount > yesterdayCount) {
      const pct = Math.round(((todayCount - yesterdayCount) / yesterdayCount) * 100)
      tips.push({ type: 'warning', text: `今日错误数较昨日增长 ${pct}%，建议关注` })
    } else if (todayCount > 0 && yesterdayCount > 0 && todayCount < yesterdayCount) {
      const pct = Math.round(((yesterdayCount - todayCount) / yesterdayCount) * 100)
      tips.push({ type: 'success', text: `今日错误数较昨日下降 ${pct}%` })
    }
    if (serviceStats.length > 0 && stats.total > 0) {
      const topSvc = serviceStats[0]
      const pct = Math.round((topSvc[1] / stats.total) * 100)
      if (pct >= 40) {
        tips.push({ type: 'warning', text: `服务「${topSvc[0]}」贡献了 ${pct}% 的错误，建议重点关注` })
      }
    }
    if (stats.failed > 0) {
      tips.push({ type: 'error', text: `有 ${stats.failed} 个错误处理失败，可能需要人工介入` })
    }
    let peakHour = -1, peakCount = 0
    const hourTotals = Array(24).fill(0)
    heatmapData.forEach(row => row.forEach((c, h) => hourTotals[h] += c))
    hourTotals.forEach((c, h) => { if (c > peakCount) { peakCount = c; peakHour = h } })
    if (peakHour >= 0 && peakCount >= 3) {
      tips.push({ type: 'info', text: `错误高发时段: ${peakHour}:00 - ${peakHour + 1}:00（共 ${peakCount} 次）` })
    }
    return tips
  }, [last7Days, serviceStats, stats, heatmapData])

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 70,
      render: (id) => <a onClick={() => navigate(`/errors/${id}`)}>#{id}</a>,
    },
    { title: '服务', dataIndex: 'service', width: 140, ellipsis: true },
    {
      title: '摘要',
      dataIndex: 'message',
      ellipsis: true,
      render: (msg) => <span style={{ color: '#595959' }}>{msg || '-'}</span>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (s) => <Tag color={statusColors[s] || 'default'}>{statusLabels[s] || s}</Tag>,
    },
    {
      title: '时间',
      dataIndex: 'createdAt',
      width: 160,
      render: (t) => t ? dayjs(t).format('MM-DD HH:mm:ss') : '-',
    },
  ]

  // AI 置信度分布
  const confData = overview ? [
    { label: '高 (≥70%)', count: overview.highConfidence || 0, color: '#52c41a' },
    { label: '中 (40%-70%)', count: overview.midConfidence || 0, color: '#faad14' },
    { label: '低 (<40%)', count: overview.lowConfidence || 0, color: '#ff4d4f' },
  ] : []
  const confTotal = confData.reduce((s, d) => s + d.count, 0)

  // 环境分布
  const envDist = overview?.envDistribution || {}

  return (
    <Spin spinning={loading}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div className="page-title" style={{ marginBottom: 0 }}>仪表盘</div>
          <div className="page-subtitle" style={{ marginBottom: 0, marginTop: 2 }}>全局错误概览、趋势分析、AI 置信度与通知统计</div>
        </div>
        <Space size="middle" align="center">
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '4px 14px', borderRadius: 20,
            background: healthScore >= 80 ? '#f6ffed' : healthScore >= 60 ? '#fffbe6' : '#fff2f0',
            border: `1px solid ${healthScore >= 80 ? '#b7eb8f' : healthScore >= 60 ? '#ffe58f' : '#ffccc7'}`,
          }}>
            <span style={{ fontSize: 12, color: '#8c8c8c' }}>系统健康度</span>
            <span style={{
              fontSize: 20, fontWeight: 700,
              color: healthScore >= 80 ? '#52c41a' : healthScore >= 60 ? '#faad14' : '#ff4d4f',
            }}>{healthScore}</span>
          </div>
          <Space size="small">
            <span style={{ fontSize: 13, color: '#8c8c8c' }}>自动刷新</span>
            <Switch checked={autoRefresh} onChange={setAutoRefresh} size="small" />
            {autoRefresh && <ThunderboltOutlined spin style={{ color: '#1677ff' }} />}
          </Space>
        </Space>
      </div>

      {/* 第一行：核心统计卡片（flex 等分布局，任意数量自动一行排满） */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        {[
          { title: '错误总数', value: stats.total, icon: <BugOutlined style={{ color: '#1677ff' }} /> },
          { title: '唯一指纹', value: overview?.uniqueFingerprints ?? '-', icon: <KeyOutlined style={{ color: '#722ed1' }} /> },
          { title: '已通知', value: stats.notified, icon: <CheckCircleOutlined style={{ color: '#52c41a' }} />, valueStyle: { color: '#52c41a' } },
          { title: '处理中', value: stats.analyzing, icon: <SyncOutlined spin style={{ color: '#1677ff' }} /> },
          { title: '已抑制', value: stats.suppressed, icon: <BellOutlined style={{ color: '#8c8c8c' }} /> },
          { title: '失败', value: stats.failed, icon: <AlertOutlined style={{ color: '#ff4d4f' }} />, valueStyle: { color: stats.failed > 0 ? '#ff4d4f' : undefined } },
          { title: '内置工单', value: overview?.internalTicketTotal ?? 0, icon: <CheckCircleOutlined style={{ color: '#13c2c2' }} />, valueStyle: { color: '#13c2c2' } },
        ].map((item) => (
          <div key={item.title} style={{ flex: '1 1 0', minWidth: 140 }}>
            <Card className="stat-card" bordered={false}>
              <Statistic
                title={item.title}
                value={item.value}
                prefix={item.icon}
                valueStyle={item.valueStyle}
              />
            </Card>
          </div>
        ))}
      </div>

      {/* 智能洞察 */}
      {insights.length > 0 && (
        <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {insights.map((tip, i) => (
            <Alert key={i} type={tip.type} message={tip.text} showIcon style={{ borderRadius: 8 }} />
          ))}
        </div>
      )}

      {/* 第二行：7天趋势 + 服务分布 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={14}>
          <Card title="近 7 天错误趋势" bordered={false} style={{ borderRadius: 12 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 200, padding: '0 8px' }}>
              {last7Days.map((d, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: '#8c8c8c' }}>{d.count}</span>
                  <div style={{
                    width: '100%',
                    maxWidth: 40,
                    height: d.count > 0 ? `${(d.count / maxDayCount) * 150}px` : 2,
                    minHeight: 2,
                    borderRadius: 4,
                    background: d.count > 0
                      ? `linear-gradient(180deg, #1677ff, #69b1ff)`
                      : '#f0f0f0',
                    transition: 'height 0.3s ease',
                  }} />
                  <span style={{ fontSize: 12, color: '#8c8c8c' }}>{d.day}</span>
                </div>
              ))}
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card title="服务错误分布" bordered={false} style={{ borderRadius: 12 }}>
            {serviceStats.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#bfbfbf', padding: 40 }}>暂无数据</div>
            ) : (
              serviceStats.map(([service, count]) => {
                const maxCount = serviceStats[0][1]
                const pct = (count / maxCount) * 100
                return (
                  <div key={service} style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 13 }}>{service}</span>
                      <span style={{ fontSize: 13, color: '#8c8c8c' }}>{count}</span>
                    </div>
                    <div style={{ height: 8, background: '#f0f0f0', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${pct}%`,
                        borderRadius: 4,
                        background: 'linear-gradient(90deg, #1677ff, #722ed1)',
                        transition: 'width 0.3s ease',
                      }} />
                    </div>
                  </div>
                )
              })
            )}
          </Card>
        </Col>
      </Row>

      {/* 错误热力图 */}
      <Card
        title={<span><FireOutlined /> 错误热力图（星期 × 小时）</span>}
        bordered={false}
        style={{ borderRadius: 12, marginBottom: 16 }}
      >
        <div style={{ overflowX: 'auto' }}>
          <div style={{ display: 'inline-block', minWidth: 760 }}>
            <div style={{ display: 'flex', marginLeft: 48, marginBottom: 4 }}>
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} style={{ width: 28, textAlign: 'center', fontSize: 10, color: '#8c8c8c' }}>
                  {h % 6 === 0 ? h + ':00' : ''}
                </div>
              ))}
            </div>
            {['周一', '周二', '周三', '周四', '周五', '周六', '周日'].map((day, di) => (
              <div key={day} style={{ display: 'flex', alignItems: 'center', marginBottom: 2 }}>
                <div style={{ width: 44, fontSize: 11, color: '#8c8c8c', textAlign: 'right', paddingRight: 4 }}>
                  {day}
                </div>
                {heatmapData[di].map((count, hi) => {
                  const intensity = count / maxHeat
                  const bg = count === 0 ? '#f5f5f5'
                    : intensity > 0.66 ? '#ff4d4f'
                    : intensity > 0.33 ? '#ff7875'
                    : intensity > 0.15 ? '#ffa39e'
                    : '#fff1f0'
                  return (
                    <Tooltip key={hi} title={`${day} ${hi}:00 - ${hi + 1}:00 · ${count} 次错误`}>
                      <div className="heat-cell" style={{
                        width: 28, height: 24, background: bg, borderRadius: 3, margin: '0 1px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, color: count > 0 && intensity > 0.33 ? '#fff' : '#bfbfbf',
                      }}>
                        {count > 0 ? count : ''}
                      </div>
                    </Tooltip>
                  )
                })}
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, marginLeft: 48 }}>
              <span style={{ fontSize: 11, color: '#8c8c8c' }}>少</span>
              {['#f5f5f5', '#fff1f0', '#ffa39e', '#ff7875', '#ff4d4f'].map(c => (
                <div key={c} style={{ width: 16, height: 12, background: c, borderRadius: 2 }} />
              ))}
              <span style={{ fontSize: 11, color: '#8c8c8c' }}>多</span>
            </div>
          </div>
        </div>
      </Card>

      {/* 第三行：AI置信度 + 通知成功率 + 环境分布 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {/* AI 置信度分布 */}
        <Col xs={24} md={8}>
          <Card
            title={<span><RobotOutlined /> AI 分析置信度分布</span>}
            bordered={false}
            style={{ borderRadius: 12 }}
          >
            {confTotal === 0 ? (
              <div style={{ textAlign: 'center', color: '#bfbfbf', padding: 30 }}>暂无分析数据</div>
            ) : (
              <>
                {confData.map((d) => {
                  const pct = confTotal > 0 ? (d.count / confTotal) * 100 : 0
                  return (
                    <div key={d.label} style={{ marginBottom: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 13 }}>{d.label}</span>
                        <span style={{ fontSize: 13, color: d.color, fontWeight: 600 }}>{d.count} ({pct.toFixed(0)}%)</span>
                      </div>
                      <Progress
                        percent={pct}
                        size="small"
                        showInfo={false}
                        strokeColor={d.color}
                      />
                    </div>
                  )
                })}
                <div style={{ textAlign: 'center', marginTop: 8, color: '#8c8c8c', fontSize: 12 }}>
                  共 {overview?.totalAnalyses ?? 0} 次分析
                </div>
              </>
            )}
          </Card>
        </Col>

        {/* 通知成功率 */}
        <Col xs={24} md={8}>
          <Card
            title={<span><NotificationOutlined /> 通知统计</span>}
            bordered={false}
            style={{ borderRadius: 12 }}
          >
            {overview && overview.totalNotifies > 0 ? (
              <>
                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                  <Statistic
                    title="通知成功率"
                    value={overview.notifySuccessRate}
                    suffix="%"
                    valueStyle={{
                      color: overview.notifySuccessRate >= 90 ? '#52c41a' : overview.notifySuccessRate >= 60 ? '#faad14' : '#ff4d4f',
                      fontSize: 28,
                    }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-around' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 600, color: '#52c41a' }}>{overview.notifySuccessCount}</div>
                    <div style={{ fontSize: 12, color: '#8c8c8c' }}>成功</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 600, color: '#ff4d4f' }}>{overview.notifyFailCount}</div>
                    <div style={{ fontSize: 12, color: '#8c8c8c' }}>失败</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 600, color: '#1677ff' }}>{overview.totalNotifies}</div>
                    <div style={{ fontSize: 12, color: '#8c8c8c' }}>总计</div>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', color: '#bfbfbf', padding: 30 }}>暂无通知数据</div>
            )}
          </Card>
        </Col>

        {/* 环境分布 */}
        <Col xs={24} md={8}>
          <Card
            title={<span><BugOutlined /> 环境分布</span>}
            bordered={false}
            style={{ borderRadius: 12 }}
          >
            {Object.keys(envDist).length === 0 ? (
              <div style={{ textAlign: 'center', color: '#bfbfbf', padding: 30 }}>暂无数据</div>
            ) : (
              Object.entries(envDist).map(([env, count]) => {
                const total = Object.values(envDist).reduce((a, b) => a + b, 0)
                const pct = (count / total) * 100
                return (
                  <div key={env} style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 13 }}>
                        <Tag color={envColors[env] || 'default'} style={{ marginRight: 6 }}>
                          {envLabels[env] || env}
                        </Tag>
                      </span>
                      <span style={{ fontSize: 13, color: '#8c8c8c' }}>{count}</span>
                    </div>
                    <Progress
                      percent={pct}
                      size="small"
                      showInfo={false}
                      strokeColor={envColors[env] || '#1677ff'}
                    />
                  </div>
                )
              })
            )}
          </Card>
        </Col>
      </Row>

      {/* 告警抑制概览 */}
      {overview && overview.suppressRuleCount > 0 && (
        <Card
          title={<span><BellOutlined /> 告警抑制概览</span>}
          bordered={false}
          style={{ borderRadius: 12, marginBottom: 16 }}
          extra={<a onClick={() => navigate('/suppress-rules')}>查看详情 →</a>}
        >
          <Row gutter={16}>
            <Col xs={12} md={6}>
              <Statistic title="抑制规则数" value={overview.suppressRuleCount} />
            </Col>
            <Col xs={12} md={6}>
              <Statistic title="总命中次数" value={overview.totalSuppressHits} />
            </Col>
          </Row>
        </Card>
      )}

      {/* 内置工单概览 */}
      {overview && overview.internalTicketTotal > 0 && (
        <Card
          title={<span><CheckCircleOutlined /> 工单概览</span>}
          bordered={false}
          style={{ borderRadius: 12, marginBottom: 16 }}
          extra={<a onClick={() => navigate('/tickets')}>查看详情 →</a>}
        >
          <Row gutter={16}>
            <Col xs={12} md={6}>
              <Statistic title="工单总数" value={overview.internalTicketTotal} />
            </Col>
            <Col xs={12} md={6}>
              <Statistic title="待处理" value={overview.internalTicketOpen}
                valueStyle={{ color: overview.internalTicketOpen > 0 ? '#ff4d4f' : undefined }} />
            </Col>
            <Col xs={12} md={6}>
              <Statistic title="处理中" value={overview.internalTicketInProgress} />
            </Col>
            <Col xs={12} md={6}>
              <Statistic title="已解决" value={overview.internalTicketResolved}
                valueStyle={{ color: '#52c41a' }} />
            </Col>
          </Row>
        </Card>
      )}

      {/* 最近错误 */}
      <Card
        title="最近错误事件"
        bordered={false}
        style={{ borderRadius: 12 }}
        extra={<a onClick={() => navigate('/errors')}>查看全部 →</a>}
      >
        <Table
          dataSource={recentErrors}
          columns={columns}
          rowKey="id"
          pagination={false}
          size="middle"
          onRow={(record) => ({
            onClick: () => navigate(`/errors/${record.id}`),
            style: { cursor: 'pointer' },
          })}
        />
      </Card>
    </Spin>
  )
}
