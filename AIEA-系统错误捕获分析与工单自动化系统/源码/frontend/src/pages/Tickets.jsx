import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { Card, Table, Tag, Select, Input, Button, Space, Spin, message, Tooltip, Modal, Form, InputNumber, Statistic, Row, Col } from 'antd'
import {
  SearchOutlined, ReloadOutlined, UserOutlined, CheckCircleOutlined,
  CloseCircleOutlined, FireOutlined, ClockCircleOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { getTickets, getErrors, resolveTicket, closeTicket, ignoreTicket, reopenTicket, changeTicketPriority } from '../api'
import dayjs from 'dayjs'

const statusColors = {
  OPEN: 'red',
  IN_PROGRESS: 'processing',
  RESOLVED: 'green',
  CLOSED: 'default',
  IGNORED: 'orange',
}
const statusLabels = {
  OPEN: '待处理',
  IN_PROGRESS: '处理中',
  RESOLVED: '已解决',
  CLOSED: '已关闭',
  IGNORED: '已忽略',
}
const priorityColors = { P0: 'red', P1: 'orange', P2: 'blue', P3: 'default' }

export default function Tickets() {
  const [loading, setLoading] = useState(true)
  const [tickets, setTickets] = useState([])
  const [statusFilter, setStatusFilter] = useState(undefined)
  const [serviceFilter, setServiceFilter] = useState(undefined)
  const [searchText, setSearchText] = useState('')
  const [modal, setModal] = useState(null) // { type, ticket }
  const [modalLoading, setModalLoading] = useState(false)
  const [form] = Form.useForm()
  const [fingerprintToService, setFingerprintToService] = useState({})
  const navigate = useNavigate()

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (statusFilter) params.status = statusFilter
      const [ticketsRes, errorsRes] = await Promise.all([
        getTickets(params),
        getErrors().catch(() => ({ data: [] })),
      ])
      setTickets(ticketsRes.data)
      // 构建 fingerprint → service 映射，用于工单按服务筛选
      const map = {}
      errorsRes.data.forEach(e => {
        if (e.fingerprint && e.service) map[e.fingerprint] = e.service
      })
      setFingerprintToService(map)
    } catch (err) {
      message.error('加载失败: ' + (err.response?.data?.error || err.message))
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => { fetchData() }, [fetchData])

  // 提取去重后的服务名列表
  const serviceOptions = useMemo(() =>
    [...new Set(tickets.map(t => fingerprintToService[t.fingerprint]).filter(Boolean))].sort()
      .map(s => ({ value: s, label: s })),
  [tickets, fingerprintToService])

  const filtered = tickets
    .filter(t => !serviceFilter || fingerprintToService[t.fingerprint] === serviceFilter)
    .filter(t =>
      !searchText ||
      (t.title && t.title.toLowerCase().includes(searchText.toLowerCase())) ||
      (t.assignee && t.assignee.toLowerCase().includes(searchText.toLowerCase())) ||
      (t.fingerprint && t.fingerprint.includes(searchText)) ||
      String(t.id) === searchText
    )

  const stats = {
    total: tickets.length,
    open: tickets.filter(t => t.status === 'OPEN').length,
    inProgress: tickets.filter(t => t.status === 'IN_PROGRESS').length,
    resolved: tickets.filter(t => t.status === 'RESOLVED' || t.status === 'CLOSED').length,
  }

  const handleAction = async () => {
    try {
      const values = await form.validateFields()
      setModalLoading(true)
      const { ticket, type } = modal
      const operator = values.operator || 'anonymous'

      if (type === 'resolve') {
        await resolveTicket(ticket.id, values.resolution || '', operator)
        message.success('已标记为已解决')
      } else if (type === 'close') {
        await closeTicket(ticket.id, operator)
        message.success('已关闭工单')
      } else if (type === 'ignore') {
        await ignoreTicket(ticket.id, operator, values.remark || '')
        message.success('已忽略工单')
      } else if (type === 'reopen') {
        await reopenTicket(ticket.id, operator, values.remark || '')
        message.success('已重新打开工单')
      } else if (type === 'priority') {
        await changeTicketPriority(ticket.id, values.priority, operator)
        message.success('优先级已变更')
      }

      setModal(null)
      form.resetFields()
      fetchData()
    } catch (err) {
      if (err.errorFields) return
      message.error('操作失败: ' + (err.response?.data?.error || err.message))
    } finally {
      setModalLoading(false)
    }
  }

  const columns = [
    {
      title: '工单ID',
      dataIndex: 'id',
      width: 70,
      render: (id) => <a onClick={() => navigate(`/tickets/${id}`)}>#{id}</a>,
    },
    {
      title: '标题',
      dataIndex: 'title',
      ellipsis: true,
      render: (title, record) => (
        <Tooltip title={title}>
          <a onClick={() => navigate(`/tickets/${record.id}`)}>{title}</a>
        </Tooltip>
      ),
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 80,
      render: (p) => <Tag color={priorityColors[p] || 'default'}>{p || 'P2'}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (s) => <Tag color={statusColors[s] || 'default'}>{statusLabels[s] || s}</Tag>,
    },
    {
      title: '处理人',
      dataIndex: 'assignee',
      width: 100,
      render: (a) => a ? <Tag icon={<UserOutlined />}>{a}</Tag> : <span style={{ color: '#bfbfbf' }}>未认领</span>,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 150,
      render: (t) => t ? dayjs(t).format('MM-DD HH:mm') : '-',
      sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
      defaultSortOrder: 'descend',
    },
    {
      title: '解决时间',
      dataIndex: 'resolvedAt',
      width: 150,
      render: (t) => t ? dayjs(t).format('MM-DD HH:mm') : '-',
    },
    {
      title: '操作',
      width: 280,
      render: (_, record) => {
        const { status } = record
        return (
          <Space size="small">
            {(status === 'OPEN' || status === 'IN_PROGRESS') && (
              <>
                <Button size="small" type="link" onClick={() => setModal({ type: 'resolve', ticket: record })}>解决</Button>
                <Button size="small" type="link" onClick={() => setModal({ type: 'ignore', ticket: record })}>忽略</Button>
              </>
            )}
            {status === 'RESOLVED' && (
              <Button size="small" type="link" onClick={() => setModal({ type: 'close', ticket: record })}>关闭</Button>
            )}
            {(status === 'CLOSED' || status === 'IGNORED') && (
              <Button size="small" type="link" onClick={() => setModal({ type: 'reopen', ticket: record })}>重开</Button>
            )}
            <Button size="small" type="link" onClick={() => setModal({ type: 'priority', ticket: record })}>优先级</Button>
          </Space>
        )
      },
    },
  ]

  const modalTitles = {
    resolve: '标记为已解决',
    close: '关闭工单',
    ignore: '忽略工单',
    reopen: '重新打开工单',
    priority: '变更优先级',
  }

  return (
    <div>
      <div className="page-title">工单管理</div>
      <div className="page-subtitle">跟踪错误工单的处理进度，支持认领、解决、关闭、重开等操作</div>

      <Spin spinning={loading}>
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={12} md={6}>
            <Card className="stat-card" bordered={false}>
              <Statistic title="工单总数" value={stats.total} prefix={<FireOutlined style={{ color: '#1677ff' }} />} />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card className="stat-card" bordered={false}>
              <Statistic title="待处理" value={stats.open} prefix={<ClockCircleOutlined style={{ color: '#ff4d4f' }} />} valueStyle={{ color: stats.open > 0 ? '#ff4d4f' : undefined }} />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card className="stat-card" bordered={false}>
              <Statistic title="处理中" value={stats.inProgress} prefix={<ClockCircleOutlined style={{ color: '#1677ff' }} />} />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card className="stat-card" bordered={false}>
              <Statistic title="已解决/关闭" value={stats.resolved} prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />} valueStyle={{ color: '#52c41a' }} />
            </Card>
          </Col>
        </Row>

        <Card bordered={false} style={{ borderRadius: 12 }}>
          <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
            <Space wrap>
              <Select
                placeholder="按状态筛选"
                allowClear
                style={{ width: 140 }}
                value={statusFilter}
                onChange={setStatusFilter}
                options={Object.entries(statusLabels).map(([value, label]) => ({ value, label }))}
              />
              <Select
                placeholder="按服务筛选"
                allowClear
                style={{ width: 180 }}
                value={serviceFilter}
                onChange={setServiceFilter}
                options={serviceOptions}
                showSearch
              />
              <Input
                placeholder="搜索标题/处理人/ID"
                allowClear
                style={{ width: 250 }}
                prefix={<SearchOutlined />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </Space>
            <Space>
              <span style={{ color: '#8c8c8c', fontSize: 13 }}>共 {filtered.length} 条</span>
              <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>刷新</Button>
            </Space>
          </Space>

          <Table
            dataSource={filtered}
            columns={columns}
            rowKey="id"
            pagination={{ pageSize: 15, showSizeChanger: true }}
            size="middle"
            onRow={(record) => ({
              onClick: () => navigate(`/tickets/${record.id}`),
              style: { cursor: 'pointer' },
            })}
          />
        </Card>
      </Spin>

      {/* 操作弹窗 */}
      <Modal
        title={modalTitles[modal?.type]}
        open={!!modal}
        onCancel={() => { setModal(null); form.resetFields() }}
        onOk={handleAction}
        confirmLoading={modalLoading}
        destroyOnClose
      >
        <Form form={form} layout="vertical" preserve={false}>
          {modal?.type === 'resolve' && (
            <Form.Item name="resolution" label="解决方案">
              <Input.TextArea rows={3} placeholder="请描述解决方案..." />
            </Form.Item>
          )}
          {modal?.type === 'ignore' && (
            <Form.Item name="remark" label="忽略原因">
              <Input.TextArea rows={3} placeholder="请说明忽略原因..." />
            </Form.Item>
          )}
          {modal?.type === 'reopen' && (
            <Form.Item name="remark" label="重开原因">
              <Input.TextArea rows={3} placeholder="请说明重新打开的原因..." />
            </Form.Item>
          )}
          {modal?.type === 'priority' && (
            <Form.Item name="priority" label="优先级" rules={[{ required: true }]}>
              <Select options={[
                { value: 'P0', label: 'P0 - 紧急' },
                { value: 'P1', label: 'P1 - 高' },
                { value: 'P2', label: 'P2 - 中' },
                { value: 'P3', label: 'P3 - 低' },
              ]} />
            </Form.Item>
          )}
          <Form.Item name="operator" label="操作人">
            <Input placeholder="输入你的名字" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
