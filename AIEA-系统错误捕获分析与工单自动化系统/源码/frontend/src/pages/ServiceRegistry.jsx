import React, { useEffect, useState, useCallback } from 'react'
import {
  Card, Table, Tag, Spin, message, Tooltip, Empty, Button, Space, Modal,
  Form, Input, Switch, Popconfirm, Typography, Row, Col, Statistic,
} from 'antd'
import {
  ReloadOutlined, PlusOutlined, EditOutlined, DeleteOutlined,
  KeyOutlined, SafetyOutlined, CheckCircleOutlined, StopOutlined,
  CopyOutlined, ApiOutlined,
} from '@ant-design/icons'
import {
  getServiceRegistry, createServiceRegistry, updateServiceRegistry,
  deleteServiceRegistry, regenerateServiceToken,
} from '../api'
import dayjs from 'dayjs'

const { Text, Paragraph } = Typography

export default function ServiceRegistry() {
  const [loading, setLoading] = useState(true)
  const [services, setServices] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editingService, setEditingService] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getServiceRegistry()
      setServices(res.data)
    } catch (err) {
      message.error('加载失败: ' + (err.response?.data?.message || err.message))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleAdd = () => {
    setEditingService(null)
    form.resetFields()
    form.setFieldsValue({ enabled: true })
    setModalOpen(true)
  }

  const handleEdit = (record) => {
    setEditingService(record)
    form.setFieldsValue({
      service: record.service,
      description: record.description,
      enabled: record.enabled,
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      if (editingService) {
        await updateServiceRegistry(editingService.id, {
          description: values.description || '',
          enabled: values.enabled,
        })
        message.success('服务信息已更新')
      } else {
        const res = await createServiceRegistry({
          service: values.service,
          description: values.description || '',
        })
        const newToken = res.data.apiToken
        message.success('服务注册成功，Token 已生成')
        // 弹出 Token 展示
        Modal.info({
          title: '服务 Token（请妥善保存）',
          width: 520,
          content: (
            <div style={{ marginTop: 16 }}>
              <Paragraph type="warning" style={{ marginBottom: 8 }}>
                此 Token 仅在创建时完整展示一次，请立即复制保存！
              </Paragraph>
              <Input.Group compact>
                <Input
                  style={{ width: 'calc(100% - 80px)', fontFamily: 'monospace' }}
                  value={newToken}
                  readOnly
                />
                <Button
                  style={{ width: 80 }}
                  icon={<CopyOutlined />}
                  onClick={() => {
                    navigator.clipboard.writeText(newToken)
                    message.success('已复制到剪贴板')
                  }}
                >
                  复制
                </Button>
              </Input.Group>
            </div>
          ),
        })
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
      await deleteServiceRegistry(id)
      message.success('服务已删除')
      fetchData()
    } catch (err) {
      message.error('删除失败: ' + (err.response?.data?.message || err.message))
    }
  }

  const handleRegenerateToken = async (record) => {
    try {
      const res = await regenerateServiceToken(record.id)
      const newToken = res.data.apiToken
      message.success('Token 已重置')
      Modal.info({
        title: '新 Token（请妥善保存）',
        width: 520,
        content: (
          <div style={{ marginTop: 16 }}>
            <Paragraph type="warning" style={{ marginBottom: 8 }}>
              旧 Token 已立即失效！此新 Token 仅展示一次，请立即复制保存！
            </Paragraph>
            <Input.Group compact>
              <Input
                style={{ width: 'calc(100% - 80px)', fontFamily: 'monospace' }}
                value={newToken}
                readOnly
              />
              <Button
                style={{ width: 80 }}
                icon={<CopyOutlined />}
                onClick={() => {
                  navigator.clipboard.writeText(newToken)
                  message.success('已复制到剪贴板')
                }}
              >
                复制
              </Button>
            </Input.Group>
          </div>
        ),
      })
      fetchData()
    } catch (err) {
      message.error('重置失败: ' + (err.response?.data?.message || err.message))
    }
  }

  const handleToggleEnabled = async (record) => {
    try {
      await updateServiceRegistry(record.id, { enabled: !record.enabled })
      setServices(prev => prev.map(s =>
        s.id === record.id ? { ...s, enabled: !s.enabled } : s
      ))
      message.success(record.enabled ? '已禁用' : '已启用')
    } catch (err) {
      message.error('操作失败: ' + (err.response?.data?.message || err.message))
    }
  }

  const enabledCount = services.filter(s => s.enabled).length

  const columns = [
    {
      title: '服务名',
      dataIndex: 'service',
      width: 180,
      render: (s) => <Tag color="blue" style={{ fontWeight: 500 }}>{s}</Tag>,
    },
    {
      title: 'API Token',
      dataIndex: 'apiToken',
      width: 340,
      render: (token) => (
        <Space>
          <Text
            style={{ fontSize: 12, fontFamily: 'monospace', color: '#595959' }}
            ellipsis
          >
            {token}
          </Text>
        </Space>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      width: 220,
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
      width: 200,
      render: (_, record) => (
        <Space size="small">
          <Popconfirm
            title="确认重置 Token？"
            description={`旧 Token 将立即失效，使用旧 Token 的 SDK 需要更新配置`}
            onConfirm={() => handleRegenerateToken(record)}
            okText="确认重置"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button
              type="link"
              size="small"
              icon={<KeyOutlined />}
            >
              重置Token
            </Button>
          </Popconfirm>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除此服务？"
            description={`删除后该服务的错误上报将被拒绝`}
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
      <div className="page-title">服务注册</div>
      <div className="page-subtitle">
        管理接入服务及其上报 Token，每个服务分配独立 Token 用于 SDK 鉴权
      </div>

      <Spin spinning={loading}>
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={12} md={8}>
            <Card className="stat-card" bordered={false}>
              <Statistic
                title="已注册服务"
                value={services.length}
                prefix={<ApiOutlined style={{ color: '#1677ff' }} />}
              />
            </Card>
          </Col>
          <Col xs={12} md={8}>
            <Card className="stat-card" bordered={false}>
              <Statistic
                title="已启用"
                value={enabledCount}
                prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={12} md={8}>
            <Card className="stat-card" bordered={false}>
              <Statistic
                title="已禁用"
                value={services.length - enabledCount}
                prefix={<StopOutlined style={{ color: '#ff4d4f' }} />}
                valueStyle={{ color: services.length - enabledCount > 0 ? '#ff4d4f' : undefined }}
              />
            </Card>
          </Col>
        </Row>

        <Card
          bordered={false}
          style={{ borderRadius: 12 }}
          title="服务注册列表"
          extra={
            <Space>
              <Button icon={<ReloadOutlined />} onClick={fetchData}>刷新</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                注册新服务
              </Button>
            </Space>
          }
        >
          {services.length === 0 && !loading ? (
            <Empty description="暂无已注册服务">
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                注册新服务
              </Button>
            </Empty>
          ) : (
            <Table
              dataSource={services}
              columns={columns}
              rowKey="id"
              pagination={{ pageSize: 15, showSizeChanger: true }}
              size="middle"
            />
          )}
        </Card>
      </Spin>

      <Modal
        title={editingService ? '编辑服务信息' : '注册新服务'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        confirmLoading={saving}
        okText="保存"
        cancelText="取消"
        width={560}
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
              disabled={!!editingService}
            />
          </Form.Item>
          {!editingService && (
            <Form.Item>
              <Text type="secondary" style={{ fontSize: 12 }}>
                保存后系统将自动生成该服务的专属 Token
              </Text>
            </Form.Item>
          )}
          <Form.Item
            name="description"
            label="描述"
          >
            <Input.TextArea
              rows={2}
              placeholder="如: 订单服务"
            />
          </Form.Item>
          {editingService && (
            <Form.Item
              name="enabled"
              label="启用"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  )
}
