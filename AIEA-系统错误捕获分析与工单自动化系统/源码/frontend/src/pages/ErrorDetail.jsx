import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Card, Row, Col, Tag, Descriptions, Button, Spin, message, Tabs,
  Typography, Space, Tooltip, Empty, Divider, Timeline,
} from 'antd'
import {
  ArrowLeftOutlined, ReloadOutlined, BugOutlined, RobotOutlined,
  NotificationOutlined, LinkOutlined, CheckCircleOutlined, CloseCircleOutlined,
  BellOutlined,
} from '@ant-design/icons'
import { getErrorDetail, retryPipeline, getTicketsByEvent, getTicketDetail } from '../api'
import dayjs from 'dayjs'

const { Text, Paragraph, Title } = Typography

const statusColors = {
  RECEIVED: 'blue', ANALYZING: 'processing', NOTIFIED: 'green', TICKETED: 'cyan', FAILED: 'red',
  SUPPRESSED: 'default',
}
const statusLabels = {
  RECEIVED: '已接收', ANALYZING: '分析中', NOTIFIED: '已通知', TICKETED: '已建单', FAILED: '失败',
  SUPPRESSED: '已抑制',
}

function confidenceColor(c) {
  if (c == null) return '#8c8c8c'
  const v = parseFloat(c)
  if (v >= 0.7) return '#52c41a'
  if (v >= 0.4) return '#faad14'
  return '#ff4d4f'
}

function confidenceLabel(c) {
  if (c == null) return '未知'
  const v = parseFloat(c)
  if (v >= 0.7) return '高'
  if (v >= 0.4) return '中'
  return '低'
}

// 工单时间线：连续 RECURRENCE 折叠为可展开条目
function TicketTimeline({ logs, actionLabels }) {
  const [expandedMap, setExpandedMap] = useState({})

  const grouped = useMemo(() => {
    const groups = []
    let recGroup = []
    for (const log of logs) {
      if (log.action === 'RECURRENCE') {
        recGroup.push(log)
      } else {
        if (recGroup.length > 0) {
          groups.push({ type: 'recurrence', logs: recGroup })
          recGroup = []
        }
        groups.push({ type: 'single', log })
      }
    }
    if (recGroup.length > 0) {
      groups.push({ type: 'recurrence', logs: recGroup })
    }
    return groups
  }, [logs])

  return (
    <Timeline
      size="small"
      items={grouped.map((g, gi) => {
        if (g.type === 'recurrence') {
          const count = g.logs.length
          const latest = g.logs[count - 1]
          const expanded = expandedMap[gi]
          return {
            color: 'orange',
            children: (
              <div>
                <Text style={{ fontSize: 12, fontWeight: 500 }}>复发</Text>
                <Tag color="orange" style={{ marginLeft: 6, fontSize: 11 }}>× {count}</Tag>
                <Text type="secondary" style={{ fontSize: 11, marginLeft: 4 }}>
                  最近: {latest.createdAt ? dayjs(latest.createdAt).format('MM-DD HH:mm:ss') : '-'}
                </Text>
                <a
                  style={{ fontSize: 11, display: 'block', marginTop: 2 }}
                  onClick={() => setExpandedMap(prev => ({ ...prev, [gi]: !prev[gi] }))}
                >
                  {expanded ? '收起详情' : `展开 ${count} 条记录`}
                </a>
                {expanded && (
                  <div style={{ marginTop: 6, paddingLeft: 12, borderLeft: '2px solid #f0f0f0' }}>
                    {g.logs.map((log, li) => (
                      <div key={log.id || li} style={{ marginBottom: li < count - 1 ? 6 : 0 }}>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {log.createdAt ? dayjs(log.createdAt).format('YYYY-MM-DD HH:mm:ss') : '-'}
                          {log.remark ? ' · ' + log.remark : ''}
                        </Text>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ),
          }
        }
        const log = g.log
        return {
          color: log.action === 'CREATE' ? 'blue'
            : log.action === 'RESOLVE' || log.action === 'CLOSE' ? 'green'
            : log.action === 'IGNORE' ? 'orange'
            : log.action === 'REOPEN' ? 'red'
            : 'gray',
          children: (
            <div>
              <Text style={{ fontSize: 12, fontWeight: 500 }}>{actionLabels[log.action] || log.action}</Text>
              {log.remark && <Text type="secondary" style={{ fontSize: 11, marginLeft: 4 }}>{log.remark}</Text>}
              <div>
                {log.operator && <Text type="secondary" style={{ fontSize: 11 }}>{log.operator} · </Text>}
                <Text type="secondary" style={{ fontSize: 11 }}>{log.createdAt ? dayjs(log.createdAt).format('MM-DD HH:mm:ss') : '-'}</Text>
              </div>
            </div>
          ),
        }
      })}
    />
  )
}

export default function ErrorDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState(null)
  const [retrying, setRetrying] = useState(false)
  const [internalTickets, setInternalTickets] = useState([])
  const [ticketLogs, setTicketLogs] = useState({}) // { ticketId: [logs] }

  const fetchDetail = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getErrorDetail(id)
      setDetail(res.data)
      // 同时拉取内置工单及其操作日志
      try {
        const ticketRes = await getTicketsByEvent(id)
        const tickets = ticketRes.data
        setInternalTickets(tickets)
        // 并发拉取每个工单的操作日志
        const logEntries = await Promise.all(
          tickets.map(t => getTicketDetail(t.id).then(r => [t.id, r.data.logs]).catch(() => [t.id, []]))
        )
        setTicketLogs(Object.fromEntries(logEntries))
      } catch { setInternalTickets([]); setTicketLogs({}) }
    } catch (err) {
      if (err.response?.status === 404) {
        message.error('事件不存在')
      } else {
        message.error('加载失败: ' + (err.response?.data?.error || err.message))
      }
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchDetail() }, [fetchDetail])

  const handleRetry = async () => {
    setRetrying(true)
    try {
      await retryPipeline(id)
      message.success('已重新入队异步流水线')
      setTimeout(() => fetchDetail(), 1500)
    } catch (err) {
      message.error('重试失败: ' + (err.response?.data?.error || err.message))
    } finally {
      setRetrying(false)
    }
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
  }

  if (!detail) {
    return <Empty description="事件不存在" />
  }

  const { event, analysis, notifies, tickets } = detail

  // 解析 suggestions
  let suggestions = []
  if (analysis?.suggestions) {
    try { suggestions = JSON.parse(analysis.suggestions) } catch { suggestions = [analysis.suggestions] }
  }

  return (
    <div>
      {/* 顶部导航 */}
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>返回列表</Button>
        <Tag color={statusColors[event.status]} style={{ fontSize: 13, padding: '2px 12px' }}>
          {statusLabels[event.status] || event.status}
        </Tag>
        {(event.status === 'FAILED' || event.status === 'RECEIVED') && (
          <Button type="primary" icon={<ReloadOutlined />} loading={retrying} onClick={handleRetry}>
            重试流水线
          </Button>
        )}
      </Space>

      {/* 抑制提示 */}
      {event.status === 'SUPPRESSED' && (
        <Card bordered={false} style={{ borderRadius: 12, marginBottom: 16, background: '#fafafa', borderLeft: '3px solid #8c8c8c' }}>
          <Space>
            <BellOutlined style={{ color: '#8c8c8c' }} />
            <Text type="secondary">
              该错误因在冷却窗口内重复上报被抑制，未单独触发分析流水线。同指纹的错误已合并处理，可查看同指纹的其他事件或关联工单了解处理进展。
            </Text>
          </Space>
        </Card>
      )}

      {/* 基本信息 */}
      <Card bordered={false} style={{ borderRadius: 12, marginBottom: 16 }}>
        <Descriptions title={<span><BugOutlined /> 事件 #{event.id}</span>} column={{ xs: 1, sm: 2, md: 3 }}>
          <Descriptions.Item label="服务">{event.service}</Descriptions.Item>
          <Descriptions.Item label="环境">
            <Tag color={{ local: 'orange', dev: 'blue', staging: 'purple', prod: 'red' }[event.env] || 'default'}>
              {event.env}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={statusColors[event.status]}>{statusLabels[event.status] || event.status}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="指纹" span={3}>
            <Text code copyable style={{ fontSize: 12 }}>{event.fingerprint}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {event.createdAt ? dayjs(event.createdAt).format('YYYY-MM-DD HH:mm:ss') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="更新时间">
            {event.updatedAt ? dayjs(event.updatedAt).format('YYYY-MM-DD HH:mm:ss') : '-'}
          </Descriptions.Item>
        </Descriptions>
        <Divider style={{ margin: '12px 0' }} />
        <div>
          <Text strong>异常摘要</Text>
          <Paragraph style={{ marginTop: 4, marginBottom: 0 }}>
            <Text style={{ color: '#595959' }}>{event.message || '-'}</Text>
          </Paragraph>
        </div>
      </Card>

      <Row gutter={[16, 16]}>
        {/* 左侧：AI分析 + 堆栈 */}
        <Col xs={24} lg={16}>
          <Tabs
            defaultActiveKey="analysis"
            items={[
              {
                key: 'analysis',
                label: <span><RobotOutlined /> AI 根因分析</span>,
                children: (
                  <Card bordered={false} style={{ borderRadius: 12 }}>
                    {analysis ? (
                      <>
                        {/* 置信度 */}
                        <div style={{ marginBottom: 16 }}>
                          <Space>
                            <Text strong>置信度</Text>
                            <div className="confidence-bar">
                              <div
                                className="confidence-fill"
                                style={{
                                  width: `${(parseFloat(analysis.confidence) || 0) * 100}%`,
                                  background: confidenceColor(analysis.confidence),
                                }}
                              />
                            </div>
                            <Tag color={confidenceColor(analysis.confidence)} style={{ fontWeight: 600 }}>
                              {(parseFloat(analysis.confidence) * 100 || 0).toFixed(1)}% ({confidenceLabel(analysis.confidence)})
                            </Tag>
                            <Text type="secondary" style={{ fontSize: 12 }}>AI 建议，需人工确认</Text>
                          </Space>
                        </div>

                        <Divider style={{ margin: '12px 0' }} />

                        {/* 根因 */}
                        <div style={{ marginBottom: 16 }}>
                          <Text strong style={{ color: '#1677ff' }}>根因分析</Text>
                          <Paragraph style={{ marginTop: 8, marginBottom: 0, whiteSpace: 'pre-wrap' }}>
                            {analysis.rootCause || '-'}
                          </Paragraph>
                        </div>

                        {/* 修复建议 */}
                        {suggestions.length > 0 && (
                          <div style={{ marginBottom: 16 }}>
                            <Text strong style={{ color: '#52c41a' }}>修复建议</Text>
                            <ol style={{ marginTop: 8, paddingLeft: 20, marginBottom: 0 }}>
                              {suggestions.map((s, i) => (
                                <li key={i} style={{ marginBottom: 6, lineHeight: 1.6 }}>{s}</li>
                              ))}
                            </ol>
                          </div>
                        )}

                        {/* 模型信息 */}
                        <Divider style={{ margin: '12px 0' }} />
                        <Space split={<Divider type="vertical" />}>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            模型: {analysis.model || '-'}
                          </Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            分析时间: {analysis.createdAt ? dayjs(analysis.createdAt).format('MM-DD HH:mm') : '-'}
                          </Text>
                        </Space>
                      </>
                    ) : (
                      <Empty description="暂无分析结果" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                    )}
                  </Card>
                ),
              },
              {
                key: 'stack',
                label: <span><BugOutlined /> 堆栈</span>,
                children: (
                  <div>
                    <div className="stack-trace">{event.stack || '无堆栈信息'}</div>
                  </div>
                ),
              },
              {
                key: 'context',
                label: '上下文',
                children: (
                  <Card bordered={false} style={{ borderRadius: 12 }}>
                    {event.contextJson ? (
                      <pre className="json-block">
                        {JSON.stringify(JSON.parse(event.contextJson), null, 2)}
                      </pre>
                    ) : (
                      <Empty description="无上下文信息" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                    )}
                  </Card>
                ),
              },
              {
                key: 'raw',
                label: 'LLM 原始返回',
                children: (
                  <Card bordered={false} style={{ borderRadius: 12 }}>
                    {analysis?.rawResponse ? (
                      <pre className="json-block" style={{ maxHeight: 400 }}>{analysis.rawResponse}</pre>
                    ) : (
                      <Empty description="无原始返回" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                    )}
                  </Card>
                ),
              },
            ]}
          />
        </Col>

        {/* 右侧：通知 + Jira */}
        <Col xs={24} lg={8}>
          {/* 通知记录 */}
          <Card
            title={<span><NotificationOutlined /> 通知记录</span>}
            bordered={false}
            style={{ borderRadius: 12, marginBottom: 16 }}
            size="small"
          >
            {notifies && notifies.length > 0 ? (
              notifies.map((n, i) => (
                <div key={n.id || i} style={{ padding: '8px 0', borderBottom: i < notifies.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                  <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                    <Tag color={n.channel === 'feishu' ? 'green' : 'blue'}>
                      {n.channel === 'feishu' ? '飞书' : n.channel || '-'}
                    </Tag>
                    {n.httpStatus && (
                      <Tag color={n.httpStatus >= 200 && n.httpStatus < 300 ? 'success' : 'error'}>
                        HTTP {n.httpStatus}
                      </Tag>
                    )}
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {n.sentAt ? dayjs(n.sentAt).format('MM-DD HH:mm:ss') : '-'}
                    </Text>
                  </Space>
                </div>
              ))
            ) : (
              <Empty description="无通知记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </Card>

          {/* 内置工单 */}
          <Card
            title={<span><CheckCircleOutlined /> 内置工单</span>}
            bordered={false}
            style={{ borderRadius: 12, marginBottom: 16 }}
            size="small"
          >
            {internalTickets && internalTickets.length > 0 ? (
              internalTickets.map((t, i) => {
                const colors = { OPEN: 'red', IN_PROGRESS: 'processing', RESOLVED: 'green', CLOSED: 'default', IGNORED: 'orange' }
                const labels = { OPEN: '待处理', IN_PROGRESS: '处理中', RESOLVED: '已解决', CLOSED: '已关闭', IGNORED: '已忽略' }
                const pColors = { P0: 'red', P1: 'orange', P2: 'blue', P3: 'default' }
                const logs = ticketLogs[t.id] || []
                const actionLabels = { CREATE: '创建', CLAIM: '认领', RESOLVE: '解决', CLOSE: '关闭', IGNORE: '忽略', REOPEN: '重开', PRIORITY: '优先级', STATUS: '状态', RECURRENCE: '复发' }
                return (
                  <div key={t.id || i} style={{ padding: '8px 0', borderBottom: i < internalTickets.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                    <Space direction="vertical" style={{ width: '100%' }} size="small">
                      <Space>
                        <a onClick={() => navigate(`/tickets/${t.id}`)}><Text strong>工单 #{t.id}</Text></a>
                        <Tag color={colors[t.status] || 'default'}>{labels[t.status] || t.status}</Tag>
                        <Tag color={pColors[t.priority] || 'blue'}>{t.priority || 'P2'}</Tag>
                      </Space>
                      {t.assignee && (
                        <Text type="secondary" style={{ fontSize: 12 }}>处理人: {t.assignee}</Text>
                      )}
                      {t.resolution && (
                        <Text type="secondary" style={{ fontSize: 12 }}>解决方案: {t.resolution}</Text>
                      )}
                      <Space size="small" style={{ fontSize: 12 }}>
                        <Text type="secondary">创建: {t.createdAt ? dayjs(t.createdAt).format('MM-DD HH:mm') : '-'}</Text>
                        {t.resolvedAt && <Text type="secondary">解决: {dayjs(t.resolvedAt).format('MM-DD HH:mm')}</Text>}
                        {t.closedAt && <Text type="secondary">关闭: {dayjs(t.closedAt).format('MM-DD HH:mm')}</Text>}
                      </Space>
                      {logs.length > 0 && (
                        <div style={{ marginTop: 4, paddingLeft: 12, borderLeft: '2px solid #f0f0f0' }}>
                          <TicketTimeline logs={logs} actionLabels={actionLabels} />
                        </div>
                      )}
                    </Space>
                  </div>
                )
              })
            ) : (
              <Empty description="无内置工单" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </Card>

          {/* Jira 工单 */}
          <Card
            title={<span><LinkOutlined /> Jira 工单</span>}
            bordered={false}
            style={{ borderRadius: 12 }}
            size="small"
          >
            {tickets && tickets.length > 0 ? (
              tickets.map((t, i) => (
                <div key={t.id || i} style={{ padding: '8px 0', borderBottom: i < tickets.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Space>
                      <Tag color="cyan">{t.jiraKey}</Tag>
                      {t.project && <Text type="secondary" style={{ fontSize: 12 }}>{t.project}</Text>}
                    </Space>
                    {t.url && (
                      <a href={t.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12 }}>
                        <LinkOutlined /> {t.url}
                      </a>
                    )}
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {t.createdAt ? dayjs(t.createdAt).format('MM-DD HH:mm:ss') : '-'}
                    </Text>
                  </Space>
                </div>
              ))
            ) : (
              <Empty description="无 Jira 工单" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  )
}
