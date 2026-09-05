import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Card, Row, Col, Tag, Descriptions, Button, Spin, message, Timeline,
  Typography, Space, Empty, Modal, Form, Input, Select, Divider,
} from 'antd'
import {
  ArrowLeftOutlined, UserOutlined, CheckCircleOutlined, CloseCircleOutlined,
  FireOutlined, ClockCircleOutlined, ReloadOutlined, RobotOutlined,
  CopyOutlined, CheckOutlined,
} from '@ant-design/icons'
import {
  getTicketDetail, claimTicket, resolveTicket, closeTicket, ignoreTicket,
  reopenTicket, changeTicketPriority, getErrorDetail,
} from '../api'
import dayjs from 'dayjs'

const { Text, Paragraph } = Typography

const statusColors = {
  OPEN: 'red', IN_PROGRESS: 'processing', RESOLVED: 'green', CLOSED: 'default', IGNORED: 'orange',
}
const statusLabels = {
  OPEN: '待处理', IN_PROGRESS: '处理中', RESOLVED: '已解决', CLOSED: '已关闭', IGNORED: '已忽略',
}
const priorityColors = { P0: 'red', P1: 'orange', P2: 'blue', P3: 'default' }
const actionLabels = {
  CREATE: '创建', CLAIM: '认领', RESOLVE: '解决', CLOSE: '关闭', IGNORE: '忽略',
  REOPEN: '重开', PRIORITY: '优先级', STATUS: '状态', RECURRENCE: '复发',
}

export default function TicketDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState(null)
  const [errorEvent, setErrorEvent] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [modal, setModal] = useState(null)
  const [modalLoading, setModalLoading] = useState(false)
  const [form] = Form.useForm()
  const [expandedRecurrence, setExpandedRecurrence] = useState({})

  const fetchDetail = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getTicketDetail(id)
      setDetail(res.data)
      // 拉取关联事件的完整信息（含堆栈和 AI 分析）
      try {
        const errRes = await getErrorDetail(res.data.ticket.eventId)
        setErrorEvent(errRes.data?.event || null)
        setAnalysis(errRes.data?.analysis || null)
      } catch { setErrorEvent(null); setAnalysis(null) }
    } catch (err) {
      if (err.response?.status === 404) {
        message.error('工单不存在')
      } else {
        message.error('加载失败: ' + (err.response?.data?.error || err.message))
      }
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchDetail() }, [fetchDetail])

  // 将连续的 RECURRENCE 日志合并为一组，其余保持独立
  const groupedLogs = React.useMemo(() => {
    const allLogs = detail?.logs
    if (!allLogs) return []
    const groups = []
    let recGroup = []
    for (const log of allLogs) {
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
  }, [detail])

  const toggleRecurrence = (idx) => {
    setExpandedRecurrence(prev => ({ ...prev, [idx]: !prev[idx] }))
  }

  // 从堆栈中提取关键位置信息（前 5 行非框架堆栈）
  const extractStackLocations = (stack) => {
    if (!stack) return []
    const lines = stack.split('\n').filter(l => l.trim().startsWith('at '))
    // 过滤掉 JDK / Spring 框架堆栈，保留业务代码
    const businessLines = lines.filter(l =>
      !l.includes('java.base/') &&
      !l.includes('java.lang.') &&
      !l.includes('org.springframework.') &&
      !l.includes('org.apache.') &&
      !l.includes('com.fasterxml.') &&
      !l.includes('jakarta.') &&
      !l.includes('org.hibernate.') &&
      !l.includes('java.net.')
    )
    const picked = (businessLines.length > 0 ? businessLines : lines).slice(0, 5)
    return picked.map(l => l.trim())
  }

  // 生成修复提示词
  const buildFixPrompt = () => {
    if (!errorEvent) return ''
    const parts = []

    parts.push('## 错误背景')
    parts.push(`- 服务: ${errorEvent.service || '-'}`)
    parts.push(`- 环境: ${errorEvent.env || '-'}`)
    parts.push(`- 异常信息: ${errorEvent.message || '-'}`)
    parts.push('')

    const locations = extractStackLocations(errorEvent.stack)
    if (locations.length > 0) {
      parts.push('## 错误代码位置')
      locations.forEach(l => parts.push(`- ${l}`))
      parts.push('')
    }

    if (analysis?.rootCause) {
      parts.push('## 根因分析')
      parts.push(analysis.rootCause)
      parts.push('')
    }

    let sugs = []
    if (analysis?.suggestions) {
      try { sugs = JSON.parse(analysis.suggestions) } catch { sugs = [analysis.suggestions] }
    }
    if (sugs.length > 0) {
      parts.push('## 初步修复建议')
      sugs.forEach((s, i) => parts.push(`${i + 1}. ${s}`))
      parts.push('')
    }

    parts.push('## 修复要求')
    parts.push('请根据上述错误位置和根因分析进行修复，注意以下几点：')
    parts.push('1. 先理解报错方法的实现目的和业务逻辑，再进行修改')
    parts.push('2. 修复时要考虑边界情况和异常处理，避免引入新问题')
    parts.push('3. 修复后说明改动的原因和影响范围')

    if (errorEvent.stack) {
      parts.push('')
      parts.push('## 完整堆栈')
      parts.push('```')
      parts.push(errorEvent.stack)
      parts.push('```')
    }

    return parts.join('\n')
  }

  const [copied, setCopied] = useState(false)
  const handleCopyPrompt = () => {
    const prompt = buildFixPrompt()
    navigator.clipboard.writeText(prompt).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleAction = async () => {
    try {
      const values = await form.validateFields()
      setModalLoading(true)
      const operator = values.operator || 'anonymous'
      const ticketId = detail.ticket.id

      if (modal === 'claim') {
        await claimTicket(ticketId, values.assignee || operator)
        message.success('认领成功')
      } else if (modal === 'resolve') {
        await resolveTicket(ticketId, values.resolution || '', operator)
        message.success('已标记为已解决')
      } else if (modal === 'close') {
        await closeTicket(ticketId, operator)
        message.success('已关闭')
      } else if (modal === 'ignore') {
        await ignoreTicket(ticketId, operator, values.remark || '')
        message.success('已忽略')
      } else if (modal === 'reopen') {
        await reopenTicket(ticketId, operator, values.remark || '')
        message.success('已重新打开')
      } else if (modal === 'priority') {
        await changeTicketPriority(ticketId, values.priority, operator)
        message.success('优先级已变更')
      }

      setModal(null)
      form.resetFields()
      fetchDetail()
    } catch (err) {
      if (err.errorFields) return
      message.error('操作失败: ' + (err.response?.data?.error || err.message))
    } finally {
      setModalLoading(false)
    }
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
  }
  if (!detail) {
    return <Empty description="工单不存在" />
  }

  const { ticket, logs } = detail
  const status = ticket.status

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/tickets')}>返回列表</Button>
        <Tag color={statusColors[status]} style={{ fontSize: 13, padding: '2px 12px' }}>
          {statusLabels[status] || status}
        </Tag>
        <Tag color={priorityColors[ticket.priority] || 'blue'}>{ticket.priority || 'P2'}</Tag>
        <Button icon={<ReloadOutlined />} onClick={fetchDetail} size="small">刷新</Button>
      </Space>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          {/* 工单信息 */}
          <Card bordered={false} style={{ borderRadius: 12, marginBottom: 16 }}>
            <Descriptions title={<span><FireOutlined /> 工单 #{ticket.id}</span>} column={{ xs: 1, sm: 2, md: 3 }}>
              <Descriptions.Item label="关联事件">
                <a onClick={() => navigate(`/errors/${ticket.eventId}`)}>#{ticket.eventId}</a>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusColors[status]}>{statusLabels[status] || status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="优先级">
                <Tag color={priorityColors[ticket.priority] || 'blue'}>{ticket.priority || 'P2'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="处理人">
                {ticket.assignee ? <Tag icon={<UserOutlined />}>{ticket.assignee}</Tag> : <Text type="secondary">未认领</Text>}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {ticket.createdAt ? dayjs(ticket.createdAt).format('YYYY-MM-DD HH:mm:ss') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="解决时间">
                {ticket.resolvedAt ? dayjs(ticket.resolvedAt).format('YYYY-MM-DD HH:mm:ss') : '-'}
              </Descriptions.Item>
            </Descriptions>
            <Divider style={{ margin: '12px 0' }} />
            <div>
              <Text strong>标题</Text>
              <Paragraph style={{ marginTop: 4, marginBottom: 0 }}>
                <Text>{ticket.title || '-'}</Text>
              </Paragraph>
            </div>
            {ticket.resolution && (
              <>
                <Divider style={{ margin: '12px 0' }} />
                <div>
                  <Text strong style={{ color: '#52c41a' }}>解决方案</Text>
                  <Paragraph style={{ marginTop: 4, marginBottom: 0, whiteSpace: 'pre-wrap' }}>
                    {ticket.resolution}
                  </Paragraph>
                </div>
              </>
            )}
            <Divider style={{ margin: '12px 0' }} />
            <Space wrap>
              {(status === 'OPEN' || status === 'IN_PROGRESS') && (
                <>
                  {status === 'OPEN' && (
                    <Button type="primary" icon={<UserOutlined />} onClick={() => setModal('claim')}>认领</Button>
                  )}
                  <Button icon={<CheckCircleOutlined />} onClick={() => setModal('resolve')}>解决</Button>
                  <Button icon={<CloseCircleOutlined />} onClick={() => setModal('ignore')}>忽略</Button>
                </>
              )}
              {status === 'RESOLVED' && (
                <Button onClick={() => setModal('close')}>关闭工单</Button>
              )}
              {(status === 'CLOSED' || status === 'IGNORED') && (
                <Button onClick={() => setModal('reopen')}>重新打开</Button>
              )}
              <Button onClick={() => setModal('priority')}>变更优先级</Button>
            </Space>
          </Card>

          {/* AI 根因分析与修复建议 */}
          {analysis && (
            <Card
              bordered={false}
              style={{ borderRadius: 12, marginBottom: 16 }}
              title={<span><RobotOutlined /> AI 根因分析与修复建议</span>}
              size="small"
            >
              {analysis.rootCause && (
                <div style={{ marginBottom: 16 }}>
                  <Text strong style={{ color: '#1677ff' }}>根因分析</Text>
                  <Paragraph style={{ marginTop: 8, marginBottom: 0, whiteSpace: 'pre-wrap' }}>
                    {analysis.rootCause}
                  </Paragraph>
                </div>
              )}
              {analysis.suggestions && (
                <div>
                  <Text strong style={{ color: '#52c41a' }}>修复建议</Text>
                  {(() => {
                    let sugs = []
                    try { sugs = JSON.parse(analysis.suggestions) } catch { sugs = [analysis.suggestions] }
                    return (
                      <ol style={{ marginTop: 8, paddingLeft: 20, marginBottom: 0 }}>
                        {sugs.map((s, i) => (
                          <li key={i} style={{ marginBottom: 6, lineHeight: 1.6 }}>{s}</li>
                        ))}
                      </ol>
                    )
                  })()}
                </div>
              )}
              {analysis.confidence != null && (
                <div style={{ marginTop: 12 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    置信度: {(parseFloat(analysis.confidence) * 100).toFixed(1)}% · 模型: {analysis.model || '-'}
                  </Text>
                </div>
              )}
            </Card>
          )}

          {/* 修复提示词 */}
          {errorEvent && (
            <Card
              bordered={false}
              style={{ borderRadius: 12, marginBottom: 16 }}
              title={
                <span>
                  <CopyOutlined /> 修复提示词
                  <Text type="secondary" style={{ fontSize: 12, fontWeight: 400, marginLeft: 8 }}>
                    可直接复制粘贴给 AI 编程助手
                  </Text>
                </span>
              }
              size="small"
              extra={
                <Button
                  size="small"
                  type={copied ? 'default' : 'primary'}
                  icon={copied ? <CheckOutlined /> : <CopyOutlined />}
                  onClick={handleCopyPrompt}
                >
                  {copied ? '已复制' : '复制提示词'}
                </Button>
              }
            >
              <pre className="json-block" style={{ maxHeight: 300, fontSize: 12, lineHeight: 1.6 }}>
                {buildFixPrompt()}
              </pre>
            </Card>
          )}
        </Col>

        {/* 操作时间线 */}
        <Col xs={24} lg={8}>
          <Card
            title={<span><ClockCircleOutlined /> 处理时间线</span>}
            bordered={false}
            style={{ borderRadius: 12 }}
            size="small"
          >
            {logs && logs.length > 0 ? (
              <Timeline
                items={groupedLogs.map((g, gi) => {
                  if (g.type === 'recurrence') {
                    const count = g.logs.length
                    const latest = g.logs[count - 1]
                    const expanded = expandedRecurrence[gi]
                    return {
                      color: 'orange',
                      children: (
                        <div key={gi}>
                          <div>
                            <Text strong>复发</Text>
                            <Tag color="orange" style={{ marginLeft: 6, fontSize: 12 }}>× {count}</Tag>
                            <Text type="secondary" style={{ fontSize: 12, marginLeft: 4 }}>
                              最近: {latest.createdAt ? dayjs(latest.createdAt).format('MM-DD HH:mm:ss') : '-'}
                            </Text>
                          </div>
                          {latest.remark && (
                            <Text type="secondary" style={{ fontSize: 12 }}>{latest.remark}</Text>
                          )}
                          <a
                            style={{ fontSize: 12, marginTop: 2, display: 'inline-block' }}
                            onClick={() => toggleRecurrence(gi)}
                          >
                            {expanded ? '收起详情' : `展开 ${count} 条记录`}
                          </a>
                          {expanded && (
                            <div style={{ marginTop: 8, paddingLeft: 12, borderLeft: '2px solid #f0f0f0' }}>
                              {g.logs.map((log, li) => (
                                <div key={log.id || li} style={{ marginBottom: li < count - 1 ? 8 : 0 }}>
                                  <Text type="secondary" style={{ fontSize: 12 }}>
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
                      <div key={log.id}>
                        <div>
                          <Text strong>{actionLabels[log.action] || log.action}</Text>
                          {log.oldValue && log.newValue && (
                            <Text type="secondary" style={{ fontSize: 12 }}> {log.oldValue} → {log.newValue}</Text>
                          )}
                        </div>
                        {log.remark && (
                          <Text type="secondary" style={{ fontSize: 12 }}>{log.remark}</Text>
                        )}
                        <div style={{ marginTop: 2 }}>
                          {log.operator && <Text type="secondary" style={{ fontSize: 12 }}>操作人: {log.operator} · </Text>}
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {log.createdAt ? dayjs(log.createdAt).format('YYYY-MM-DD HH:mm:ss') : '-'}
                          </Text>
                        </div>
                      </div>
                    ),
                  }
                })}
              />
            ) : (
              <Empty description="暂无操作记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </Card>
        </Col>
      </Row>

      {/* 操作弹窗 */}
      <Modal
        title={{
          claim: '认领工单',
          resolve: '标记为已解决',
          close: '关闭工单',
          ignore: '忽略工单',
          reopen: '重新打开工单',
          priority: '变更优先级',
        }[modal]}
        open={!!modal}
        onCancel={() => { setModal(null); form.resetFields() }}
        onOk={handleAction}
        confirmLoading={modalLoading}
        destroyOnClose
      >
        <Form form={form} layout="vertical" preserve={false}>
          {modal === 'claim' && (
            <Form.Item name="assignee" label="处理人" rules={[{ required: true, message: '请输入处理人' }]}>
              <Input placeholder="输入你的名字" />
            </Form.Item>
          )}
          {modal === 'resolve' && (
            <Form.Item name="resolution" label="解决方案">
              <Input.TextArea rows={3} placeholder="请描述解决方案..." />
            </Form.Item>
          )}
          {modal === 'ignore' && (
            <Form.Item name="remark" label="忽略原因">
              <Input.TextArea rows={3} placeholder="请说明忽略原因..." />
            </Form.Item>
          )}
          {modal === 'reopen' && (
            <Form.Item name="remark" label="重开原因">
              <Input.TextArea rows={3} placeholder="请说明重新打开的原因..." />
            </Form.Item>
          )}
          {modal === 'priority' && (
            <Form.Item name="priority" label="优先级" rules={[{ required: true }]}>
              <Select options={[
                { value: 'P0', label: 'P0 - 紧急' },
                { value: 'P1', label: 'P1 - 高' },
                { value: 'P2', label: 'P2 - 中' },
                { value: 'P3', label: 'P3 - 低' },
              ]} />
            </Form.Item>
          )}
          {modal !== 'claim' && (
            <Form.Item name="operator" label="操作人">
              <Input placeholder="输入你的名字" />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  )
}
