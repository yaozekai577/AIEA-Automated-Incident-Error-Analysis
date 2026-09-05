import React, { useEffect, useState, useMemo } from 'react'
import { Card, Table, Tag, Input, Spin, message, Tooltip, Progress, Empty } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
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

export default function ErrorGroups() {
  const [loading, setLoading] = useState(true)
  const [errors, setErrors] = useState([])
  const [ticketedEventIds, setTicketedEventIds] = useState(new Set())
  const [searchText, setSearchText] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const [errorsRes, ticketsRes] = await Promise.all([
          getErrors(),
          getTickets().catch(() => ({ data: [] })),
        ])
        setErrors(errorsRes.data)
        // 从 internal_ticket 的 eventId 构建有工单的事件集合
        setTicketedEventIds(new Set(ticketsRes.data.map(t => t.eventId)))
      } catch (err) {
        message.error('加载数据失败: ' + (err.response?.data?.error || err.message))
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // 按指纹分组
  const groups = useMemo(() => {
    const map = {}
    errors.forEach(e => {
      if (!map[e.fingerprint]) {
        map[e.fingerprint] = {
          fingerprint: e.fingerprint,
          service: e.service,
          env: e.env,
          message: e.message,
          count: 0,
          events: [],
          statuses: {},
          firstSeen: e.createdAt,
          lastSeen: e.createdAt,
          latestId: e.id,
        }
      }
      const g = map[e.fingerprint]
      g.count++
      g.events.push(e)
      g.statuses[e.status] = (g.statuses[e.status] || 0) + 1
      if (e.createdAt && (!g.firstSeen || dayjs(e.createdAt).isBefore(dayjs(g.firstSeen)))) {
        g.firstSeen = e.createdAt
      }
      if (e.createdAt && (!g.lastSeen || dayjs(e.createdAt).isAfter(dayjs(g.lastSeen)))) {
        g.lastSeen = e.createdAt
        g.latestId = e.id
      }
    })
    // 计算详情跳转目标：优先有内置工单的事件，否则用最新事件
    Object.values(map).forEach(g => {
      const ticketed = g.events.find(e => ticketedEventIds.has(e.id))
      g.detailId = ticketed ? ticketed.id : g.latestId
    })
    return Object.values(map).sort((a, b) => b.count - a.count)
  }, [errors, ticketedEventIds])

  const filtered = searchText
    ? groups.filter(g =>
        (g.service && g.service.toLowerCase().includes(searchText.toLowerCase())) ||
        (g.message && g.message.toLowerCase().includes(searchText.toLowerCase())) ||
        (g.fingerprint && g.fingerprint.includes(searchText))
      )
    : groups

  const maxCount = Math.max(...groups.map(g => g.count), 1)

  const columns = [
    {
      title: '服务',
      dataIndex: 'service',
      width: 160,
      ellipsis: true,
      render: (s) => <Tag color="blue">{s || '-'}</Tag>,
    },
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
      title: '错误摘要',
      dataIndex: 'message',
      ellipsis: true,
      render: (msg) => (
        <Tooltip title={msg} placement="topLeft">
          <span style={{ color: '#595959' }}>{msg || '-'}</span>
        </Tooltip>
      ),
    },
    {
      title: '出现次数',
      dataIndex: 'count',
      width: 140,
      sorter: (a, b) => a.count - b.count,
      defaultSortOrder: 'descend',
      render: (count) => (
        <div style={{ minWidth: 100 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 600, fontSize: 15, color: count >= 5 ? '#ff4d4f' : count >= 3 ? '#faad14' : '#1677ff' }}>
              {count}
            </span>
            <div style={{ flex: 1, minWidth: 40 }}>
              <Progress
                percent={(count / maxCount) * 100}
                size="small"
                showInfo={false}
                strokeColor={count >= 5 ? '#ff4d4f' : count >= 3 ? '#faad14' : '#1677ff'}
              />
            </div>
          </div>
        </div>
      ),
    },
    {
      title: '状态分布',
      dataIndex: 'statuses',
      width: 200,
      render: (statuses) => (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {Object.entries(statuses).map(([s, c]) => (
            <Tag key={s} color={statusColors[s] || 'default'} style={{ fontSize: 11 }}>
              {statusLabels[s] || s}: {c}
            </Tag>
          ))}
        </div>
      ),
    },
    {
      title: '首次出现',
      dataIndex: 'firstSeen',
      width: 150,
      render: (t) => t ? dayjs(t).format('MM-DD HH:mm') : '-',
    },
    {
      title: '最近出现',
      dataIndex: 'lastSeen',
      width: 150,
      render: (t) => t ? dayjs(t).format('MM-DD HH:mm') : '-',
    },
    {
      title: '操作',
      width: 80,
      render: (_, record) => (
        <a onClick={() => navigate(`/errors/${record.detailId}`)}>详情 →</a>
      ),
    },
  ]

  return (
    <div>
      <div className="page-title">错误聚合分析</div>
      <div className="page-subtitle">按错误指纹聚合，快速发现高频问题和重复发生的异常</div>

      <Card bordered={false} style={{ borderRadius: 12, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Input
            placeholder="搜索服务名/摘要/指纹"
            allowClear
            style={{ width: 300 }}
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
          <span style={{ color: '#8c8c8c', fontSize: 13 }}>
            共 {filtered.length} 个错误组 · 涉及 {filtered.reduce((sum, g) => sum + g.count, 0)} 条事件
          </span>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}><Spin /></div>
        ) : filtered.length === 0 ? (
          <Empty description="暂无数据" />
        ) : (
          <Table
            dataSource={filtered}
            columns={columns}
            rowKey="fingerprint"
            pagination={{ pageSize: 15, showSizeChanger: true }}
            size="middle"
          />
        )}
      </Card>
    </div>
  )
}
