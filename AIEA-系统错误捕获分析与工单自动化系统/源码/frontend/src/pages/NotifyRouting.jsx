import React, { useEffect, useState, useCallback } from 'react'
import {
  Card, Table, Tag, Spin, message, Tooltip, Empty, Button, Space, Modal,
  Form, Input, Switch, Select, Popconfirm, Typography, Row, Col, Statistic,
} from 'antd'
import {
  ReloadOutlined, PlusOutlined, EditOutlined, DeleteOutlined,
  SendOutlined, RobotOutlined, CheckCircleOutlined, StopOutlined,
} from '@ant-design/icons'
import {
  getNotifyRoutes, createNotifyRoute, updateNotifyRoute,
  deleteNotifyRoute, testNotifyRoute,
} from '../api'
import dayjs from 'dayjs'

const { Text } = Typography

const CHANNEL_OPTIONS = [
  { value: 'feishu', label: '飞书', color: 'green' },
  { value: 'dingtalk', label: '钉钉', color: 'blue' },
]

function channelTag(channel) {
  const opt = CHANNEL_OPTIONS.find(o => o.value === channel) || CHANNEL_OPTIONS[0]
  return <Tag color={opt.color}>{opt.label}</Tag>
}

function channelLabel(channel) {
  const opt = CHANNEL_OPTIONS.find(o => o.value === channel) || CHANNEL_OPTIONS[0]
  return opt.label
}

export default function NotifyRouting() {
  const [loading, setLoading] = useState(true)
  const [routes, setRoutes] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editingRoute, setEditingRoute] = useState(null)
  const [saving, setSaving] = useState(false)
  const [testingId, setTestingId] = useState(null)
  const [form] = Form.useForm()

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getNotifyRoutes()
      setRoutes(res.data)
    } catch (err) {
      message.error('加载失败: ' + (err.response?.data?.message || err.message))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleAdd = () => {
    setEditingRoute(null)
    form.resetFields()
    form.setFieldsValue({ enabled: true, channel: 'feishu' })
    setModalOpen(true)
  }

  const handleEdit = (record) => {
    setEditingRoute(record)
    form.setFieldsValue({
      service: record.service,
      channel: record.channel,
      webhookUrl: record.webhookUrl,
      description: record.description,
      enabled: record.enabled,
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      if (editingRoute) {
        await updateNotifyRoute(editingRoute.id, values)
        message.success('路由规则已更新')
      } else {
        await createNotifyRoute(values)
        message.success('路由规则已创建')
      }
      setModalOpen(false)
      fetchData()
    } catch (err) {
      if (err.errorFields) return
      message.error('保存失败: ' + (err.response?.data?.message || err.message))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await deleteNotifyRoute(id)
      message.success('路由规则已删除')
      fetchData()
    } catch (err) {
      message.error('删除失败: ' + (err.response?.data?.message || err.message))
    }
  }

  const handleTest = async (record) => {
    setTestingId(record.id)
    try {
      const res = await testNotifyRoute(record.id)
      if (res.data.success) {
        message.success(channelLabel(record.channel) + '推送正常')
      } else {
        message.error(channelLabel(record.channel) + '推送失败: ' + (res.data.error || '未知错误'))
      }
    } catch (err) {
      message.error('请求失败: ' + (err.response?.data?.message || err.message))
    } finally {
      setTestingId(null)
    }
  }

  const handleToggleEnabled = async (record) => {
    try {
      await updateNotifyRoute(record.id, { enabled: !record.enabled })
      setRoutes(prev => prev.map(r =>
        r.id === record.id ? { ...r, enabled: !r.enabled } : r
      ))
      message.success(record.enabled ? '已禁用' : '已启用')
    } catch (err) {
      message.error('操作失败: ' + (err.response?.data?.message || err.message))
    }
  }

  const enabledCount = routes.filter(r => r.enabled).length
  const feishuCount = routes.filter(r => r.channel === 'feishu').length
  const dingtalkCount = routes.filter(r => r.channel === 'dingtalk').length

  const columns = [
    {
      title: '服务名',
      dataIndex: 'service',
      width: 160,
      render: (s) => <Tag color="blue" style={{ fontWeight: 500 }}>{s}</Tag>,
    },
    {
      title: '渠道',
      dataIndex: 'channel',
      width: 90,
      render: (ch) => channelTag(ch),
    },
    {
      title: 'Webhook 地址',
      dataIndex: 'webhookUrl',
      width: 300,
      ellipsis: true,
      render: (url) => (
        <Tooltip title={url}>
          <Text style={{ fontSize: 12, fontFamily: 'monospace', color: '#595959' }} ellipsis>
            {url}
          </Text>
        </Tooltip>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      width: 260,
      ellipsis: true,
      render: (desc) => desc || <Text type="secondary">-</Text>,
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      width: 80,
      render: (enabled, record) => (
        <Switch
          size="small"
          checked={enabled}
          onChange={() => handleToggleEnabled(record)}
        />
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 150,
      render: (t) => t ? dayjs(t).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '操作',
      width: 170,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<SendOutlined />}
            loading={testingId === record.id}
            onClick={() => handleTest(record)}
          >
            测试
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除此路由规则？"
            description={`删除后该服务的 ${channelLabel(record.channel)} 通知将回退到全局 Webhook`}
            onConfirm={() => handleDelete(record.id)}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div className="page-title">通知路由</div>
      <div className="page-subtitle">
        为不同业务服务配置专属飞书/钉钉机器人，实现错误通知按服务+渠道路由到不同 IM 群
      </div>

      <Spin spinning={loading}>
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={12} md={6}>
            <Card className="stat-card" bordered={false}>
              <Statistic
                title="路由规则总数"
                value={routes.length}
                prefix={<RobotOutlined style={{ color: '#1677ff' }} />}
              />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card className="stat-card" bordered={false}>
              <Statistic
                title="已启用"
                value={enabledCount}
                prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card className="stat-card" bordered={false}>
              <Statistic
                title="飞书规则"
                value={feishuCount}
                prefix={<Tag color="green" style={{ fontSize: 12 }}>飞书</Tag>}
              />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card className="stat-card" bordered={false}>
              <Statistic
                title="钉钉规则"
                value={dingtalkCount}
                prefix={<Tag color="blue" style={{ fontSize: 12 }}>钉钉</Tag>}
              />
            </Card>
          </Col>
        </Row>

        <Card
          bordered={false}
          style={{ borderRadius: 12 }}
          title="IM 机器人路由规则"
          extra={
            <Space>
              <Button icon={<ReloadOutlined />} onClick={fetchData}>刷新</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                新增路由
              </Button>
            </Space>
          }
        >
          {routes.length === 0 && !loading ? (
            <Empty description="暂无路由规则，所有服务报错将走全局 IM 机器人">
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                新增路由
              </Button>
            </Empty>
          ) : (
            <Table
              dataSource={routes}
              columns={columns}
              rowKey="id"
              pagination={{ pageSize: 15, showSizeChanger: true }}
              size="middle"
            />
          )}
        </Card>
      </Spin>

      <Modal
        title={editingRoute ? '编辑路由规则' : '新增路由规则'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        confirmLoading={saving}
        okText="保存"
        cancelText="取消"
        width={600}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="service"
            label="服务名"
            rules={[{ required: true, message: '请输入服务名' }]}
            tooltip="对应 SDK 上报时的 service 字段，如 order-service、payment-service"
          >
            <Input
              placeholder="如: order-service"
              disabled={!!editingRoute}
            />
          </Form.Item>
          <Form.Item
            name="channel"
            label="通知渠道"
            rules={[{ required: true, message: '请选择通知渠道' }]}
            tooltip="同一服务可分别配置飞书和钉钉两条路由规则"
          >
            <Select
              options={CHANNEL_OPTIONS}
              placeholder="选择通知渠道"
              disabled={!!editingRoute}
            />
          </Form.Item>
          <Form.Item
            name="webhookUrl"
            label="Webhook 地址"
            rules={[{ required: true, message: '请输入 Webhook 地址' }]}
          >
            <Input.Password
              placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/xxx 或 https://oapi.dingtalk.com/robot/send?access_token=xxx"
            />
          </Form.Item>
          <Form.Item
            name="description"
            label="描述"
          >
            <Input.TextArea
              rows={2}
              placeholder="如: 订单服务专属飞书群"
            />
          </Form.Item>
          <Form.Item
            name="enabled"
            label="启用"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
