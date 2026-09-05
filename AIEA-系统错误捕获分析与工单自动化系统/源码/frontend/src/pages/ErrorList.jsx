import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { Card, Table, Tag, Input, Select, Button, Space, message, Tooltip, Switch } from 'antd'
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { getErrors, getTickets } from '../api'
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

export default function ErrorList() {
  const [loading, setLoading] = useState(true)
  const [errors, setErrors] = useState([])
  const [ticketedEventIds, setTicketedEventIds] = useState(new Set())

  // 从 sessionStorage 恢复筛选状态
  const [statusFilter, setStatusFilter] = useState(() => sessionStorage.getItem('errList_status') || undefined)
  const [serviceFilter, setServiceFilter] = useState(() => sessionStorage.getItem('errList_service') || undefined)
  const [hasTicketOnly, setHasTicketOnly] = useState(() => sessionStorage.getItem('errList_ticketOnly') === 'true')
  const [searchText, setSearchText] = useState(() => sessionStorage.getItem('errList_search') || '')
  const navigate = useNavigate()

  // 筛选状态变化时持久化
  useEffect(() => { sessionStorage.setItem('errList_status', statusFilter || '') }, [statusFilter])
  useEffect(() => { sessionStorage.setItem('errList_service', serviceFilter || '') }, [serviceFilter])
  useEffect(() => { sessionStorage.setItem('errList_ticketOnly', String(hasTicketOnly)) }, [hasTicketOnly])
  useEffect(() => { sessionStorage.setItem('errList_search', searchText) }, [searchText])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (statusFilter) params.status = statusFilter
      const [errRes, ticketRes] = await Promise.all([
        getErrors(params),
        getTickets(),
      ])
      setErrors(errRes.data)
      setTicketedEventIds(new Set(ticketRes.data.map(t => t.eventId)))
    } catch (err) {
      message.error('加载失败: ' + (err.response?.data?.error || err.message))
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => { fetchData() }, [fetchData])

  // 提取去重后的服务名列表
  const serviceOptions = useMemo(() =>
    [...new Set(errors.map(e => e.service).filter(Boolean))].sort()
      .map(s => ({ value: s, label: s })),
  [errors])

  const filtered = errors
    .filter(e => !serviceFilter || e.service === serviceFilter)
    .filter(e => !hasTicketOnly || ticketedEventIds.has(e.id))
    .filter(e =>
      !searchText ||
      (e.message && e.message.toLowerCase().includes(searchText.toLowerCase())) ||
      (e.service && e.service.toLowerCase().includes(searchText.toLowerCase())) ||
      (e.fingerprint && e.fingerprint.includes(searchText)) ||
      String(e.id) === searchText
    )

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 70,
      render: (id) => <a onClick={() => navigate(`/errors/${id}`)}>#{id}</a>,
    },
    { title: '服务', dataIndex: 'service', width: 140, ellipsis: true },
    {
      title: '环境',
      dataIndex: 'env',
      width: 80,
      render: (env) => {
        const colors = { local: 'orange', dev: 'blue', staging: 'purple', prod: 'red' }
        return <Tag color={colors[env] || 'default'}>{env}</Tag>
      },
    },
    {
      title: '摘要',
      dataIndex: 'message',
      ellipsis: true,
      render: (msg) => (
        <Tooltip title={msg} placement="topLeft">
          <span style={{ color: '#595959' }}>{msg || '-'}</span>
        </Tooltip>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (s) => <Tag color={statusColors[s] || 'default'}>{statusLabels[s] || s}</Tag>,
    },
    {
      title: '工单',
      width: 70,
      render: (_, record) =>
        ticketedEventIds.has(record.id)
          ? <Tag color="cyan" style={{ fontSize: 11 }}>有</Tag>
          : <span style={{ color: '#d9d9d9', fontSize: 12 }}>-</span>,
    },
    {
      title: '时间',
      dataIndex: 'createdAt',
      width: 170,
      render: (t) => t ? dayjs(t).format('YYYY-MM-DD HH:mm:ss') : '-',
      sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
      defaultSortOrder: 'descend',
    },
  ]

  return (
    <div>
      <div className="page-title">错误事件</div>
      <div className="page-subtitle">查看所有上报的错误事件，支持按状态、服务名筛选和关键词搜索</div>

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
              placeholder="搜索服务名/摘要/ID"
              allowClear
              style={{ width: 250 }}
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
            <Space size="small">
              <Switch
                size="small"
                checked={hasTicketOnly}
                onChange={setHasTicketOnly}
              />
              <span style={{ fontSize: 13, color: hasTicketOnly ? '#1677ff' : '#8c8c8c' }}>仅有工单</span>
            </Space>
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
          loading={loading}
          pagination={{
            pageSize: 15,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
          size="middle"
          onRow={(record) => ({
            onClick: () => navigate(`/errors/${record.id}`),
            style: { cursor: 'pointer' },
          })}
        />
      </Card>
    </div>
  )
}
