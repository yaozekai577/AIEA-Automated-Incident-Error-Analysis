import React, { useEffect, useState, useCallback, useRef } from 'react'
import { Card, Table, Tag, Spin, message, Tooltip, Empty, Statistic, Row, Col, Badge, InputNumber, Space, Typography } from 'antd'
import {
  ReloadOutlined, FireOutlined, ClockCircleOutlined, PauseCircleOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { getSuppressRules, updateSuppressRuleCooldown } from '../api'
import dayjs from 'dayjs'

/**
 * 前端实时计算冷却状态
 */
function calcCooldown(lastFiredAt, cooldownSec, now) {
  if (!lastFiredAt || !cooldownSec) return { inCooldown: false, remainingSec: 0, remainingText: null }
  const elapsed = now.diff(dayjs(lastFiredAt), 'second')
  if (elapsed < cooldownSec) {
    const remaining = cooldownSec - elapsed
    return { inCooldown: true, remainingSec: remaining, remainingText: formatRemaining(remaining) }
  }
  return { inCooldown: false, remainingSec: 0, remainingText: null }
}

function formatRemaining(seconds) {
  if (seconds < 60) return seconds + '秒'
  if (seconds < 3600) return Math.floor(seconds / 60) + '分' + (seconds % 60) + '秒'
  return Math.floor(seconds / 3600) + '时' + Math.floor((seconds % 3600) / 60) + '分'
}

export default function SuppressRules() {
  const [loading, setLoading] = useState(true)
  const [rules, setRules] = useState([])
  const [now, setNow] = useState(dayjs())
  const [editingFp, setEditingFp] = useState(null)
  const [editValue, setEditValue] = useState(null)
  const [saving, setSaving] = useState(false)
  const navigate = useNavigate()
  const timerRef = useRef(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getSuppressRules()
      setRules(res.data)
    } catch (err) {
      message.error('加载失败: ' + (err.response?.data?.error || err.message))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    // 每秒刷新 now，驱动冷却状态实时更新
    timerRef.current = setInterval(() => setNow(dayjs()), 1000)
    return () => clearInterval(timerRef.current)
  }, [fetchData])

  // 保存冷却时间（editValue 为分钟，发送时转为秒）
  const handleSaveCooldown = async (fingerprint) => {
    if (!editValue || editValue < 0.5 || editValue > 1440) {
      message.error('冷却时间须在 0.5~1440 分钟之间')
      return
    }
    const cooldownSec = Math.round(editValue * 60)
    setSaving(true)
    try {
      await updateSuppressRuleCooldown(fingerprint, cooldownSec)
      message.success('冷却时间已更新')
      setRules(prev => prev.map(r =>
        r.fingerprint === fingerprint ? { ...r, cooldownSec } : r
      ))
      setEditingFp(null)
    } catch (err) {
      message.error('更新失败: ' + (err.response?.data?.message || err.message))
    } finally {
      setSaving(false)
    }
  }

  // 实时计算每条规则的冷却状态
  const rulesWithCooldown = rules.map(r => {
    const cd = calcCooldown(r.lastFiredAt, r.cooldownSec, now)
    return { ...r, ...cd }
  })

  const totalHits = rules.reduce((sum, r) => sum + (r.hitCount || 0), 0)
  const inCooldownCount = rulesWithCooldown.filter(r => r.inCooldown).length
  const activeCount = rules.length - inCooldownCount

  const columns = [
    {
      title: '服务',
      dataIndex: 'service',
      width: 140,
      ellipsis: true,
      render: (s) => <Tag color="blue">{s || '-'}</Tag>,
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
      title: '指纹',
      dataIndex: 'fingerprint',
      width: 120,
      render: (fp) => (
        <Tooltip title={fp}>
          <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#8c8c8c' }}>
            {fp ? fp.substring(0, 12) + '...' : '-'}
          </span>
        </Tooltip>
      ),
    },
    {
      title: '命中次数',
      dataIndex: 'hitCount',
      width: 100,
      sorter: (a, b) => (a.hitCount || 0) - (b.hitCount || 0),
      defaultSortOrder: 'descend',
      render: (count) => (
        <span style={{ fontWeight: 600, color: count >= 10 ? '#ff4d4f' : count >= 5 ? '#faad14' : '#1677ff' }}>
          {count || 0}
        </span>
      ),
    },
    {
      title: '冷却时间',
      dataIndex: 'cooldownSec',
      width: 160,
      render: (sec, record) => {
        if (editingFp === record.fingerprint) {
          return (
            <Space size="small">
              <InputNumber
                size="small"
                min={0.5}
                max={1440}
                step={0.5}
                precision={1}
                value={editValue}
                onChange={setEditValue}
                style={{ width: 100 }}
                addonAfter="分钟"
                onPressEnter={() => handleSaveCooldown(record.fingerprint)}
              />
              <a onClick={() => handleSaveCooldown(record.fingerprint)} disabled={saving}>
                {saving ? '保存中' : '保存'}
              </a>
              <a onClick={() => setEditingFp(null)}>取消</a>
            </Space>
          )
        }
        const display = !sec ? '-' : sec >= 3600 ? (sec / 3600) + ' 小时' : sec >= 60 ? (sec / 60) + ' 分钟' : sec + ' 秒'
        return (
          <a
            onClick={() => { setEditingFp(record.fingerprint); setEditValue(sec ? sec / 60 : null) }}
            title="点击修改"
            style={{ textDecoration: 'underline dashed', textDecorationColor: '#d9d9d9' }}
          >
            {display}
          </a>
        )
      },
    },
    {
      title: '最近触发',
      dataIndex: 'lastFiredAt',
      width: 160,
      render: (t) => t ? dayjs(t).format('YYYY-MM-DD HH:mm:ss') : '-',
    },
    {
      title: '冷却状态',
      width: 200,
      render: (_, record) => {
        if (record.inCooldown) {
          return (
            <Badge status="processing" text={
              <span style={{ fontSize: 12, color: '#1677ff' }}>
                冷却中 · 剩 {record.remainingText}
              </span>
            } />
          )
        }
        return (
          <Badge status="success" text={
            <span style={{ fontSize: 12, color: '#52c41a' }}>可触发</span>
          } />
        )
      },
    },
    {
      title: '关联事件',
      dataIndex: 'eventCount',
      width: 90,
      render: (count) => count || 0,
    },
    {
      title: '操作',
      width: 80,
      render: (_, record) => (
        record.latestEventId
          ? <a onClick={() => navigate(`/errors/${record.latestEventId}`)}>详情 →</a>
          : '-'
      ),
    },
  ]

  return (
    <div>
      <div className="page-title">告警抑制规则</div>
      <div className="page-subtitle">查看各错误指纹的冷却窗口、命中次数和实时冷却状态</div>

      <Spin spinning={loading}>
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={12} md={6}>
            <Card className="stat-card" bordered={false}>
              <Statistic
                title="抑制规则总数"
                value={rules.length}
                prefix={<FireOutlined style={{ color: '#fa541c' }} />}
              />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card className="stat-card" bordered={false}>
              <Statistic
                title="总命中次数"
                value={totalHits}
                prefix={<ClockCircleOutlined style={{ color: '#1677ff' }} />}
              />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card className="stat-card" bordered={false}>
              <Statistic
                title="冷却中"
                value={inCooldownCount}
                prefix={<PauseCircleOutlined style={{ color: '#faad14' }} />}
                valueStyle={{ color: inCooldownCount > 0 ? '#faad14' : undefined }}
              />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card className="stat-card" bordered={false}>
              <Statistic
                title="可触发"
                value={activeCount}
                prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
        </Row>

        <Card
          bordered={false}
          style={{ borderRadius: 12 }}
          extra={<a onClick={fetchData}><ReloadOutlined /> 刷新</a>}
          title="指纹抑制规则列表"
        >
          {rules.length === 0 && !loading ? (
            <Empty description="暂无抑制规则，错误上报后将自动生成" />
          ) : (
            <Table
              dataSource={rulesWithCooldown}
              columns={columns}
              rowKey="fingerprint"
              pagination={{ pageSize: 15, showSizeChanger: true }}
              size="middle"
            />
          )}
        </Card>
      </Spin>
    </div>
  )
}
