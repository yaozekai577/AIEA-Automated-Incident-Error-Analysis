import React, { useEffect, useState, useCallback } from 'react'
import { Card, Descriptions, Tag, Button, Spin, message, Space, Alert, Row, Col, Form, Input, InputNumber, Tooltip } from 'antd'
import { ReloadOutlined, CheckCircleOutlined, CloseCircleOutlined, EditOutlined, SaveOutlined } from '@ant-design/icons'
import { getConfig, testLlm, testFeishu, getLlmConfig, updateLlmConfig } from '../api'

function BoolTag({ value }) {
  if (value === true || value === 'true') {
    return <Tag icon={<CheckCircleOutlined />} color="success">是</Tag>
  }
  return <Tag icon={<CloseCircleOutlined />} color="default">否</Tag>
}

function displayVal(value) {
  if (value === 0 || value === '0') return '0'
  return value || '-'
}

export default function Config() {
  const [loading, setLoading] = useState(true)
  const [config, setConfig] = useState(null)
  const [testingLlm, setTestingLlm] = useState(false)
  const [testingFeishu, setTestingFeishu] = useState(false)

  // LLM 编辑相关
  const [llmEditing, setLlmEditing] = useState(false)
  const [llmSaving, setLlmSaving] = useState(false)
  const [llmConfig, setLlmConfig] = useState(null)
  const [llmForm] = Form.useForm()

  const fetchConfig = useCallback(async () => {
    setLoading(true)
    try {
      const [cfgRes, llmRes] = await Promise.all([getConfig(), getLlmConfig()])
      setConfig(cfgRes.data)
      setLlmConfig(llmRes.data)
    } catch (err) {
      message.error('加载配置失败: ' + (err.response?.data?.error || err.message))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchConfig() }, [fetchConfig])

  const handleTestLlm = async () => {
    setTestingLlm(true)
    try {
      const res = await testLlm()
      if (res.data.success) {
        message.success('LLM 连通正常，回复: ' + String(res.data.reply).substring(0, 50))
      } else {
        message.error('LLM 连通失败: ' + (res.data.error || '未知错误'))
      }
    } catch (err) {
      message.error('请求失败: ' + err.message)
    } finally {
      setTestingLlm(false)
    }
  }

  const handleTestFeishu = async () => {
    setTestingFeishu(true)
    try {
      const res = await testFeishu()
      if (res.data.success) {
        message.success('飞书推送正常')
      } else {
        message.error('飞书推送失败: ' + (res.data.error || '未知错误'))
      }
    } catch (err) {
      message.error('请求失败: ' + err.message)
    } finally {
      setTestingFeishu(false)
    }
  }

  const handleLlmEdit = () => {
    llmForm.setFieldsValue({
      baseUrl: llmConfig.baseUrl,
      model: llmConfig.model,
      apiKey: '',
      analysisCacheTtl: llmConfig.analysisCacheTtl,
    })
    setLlmEditing(true)
  }

  const handleLlmSave = async () => {
    try {
      const values = await llmForm.validateFields()
      setLlmSaving(true)
      // apiKey 为空字符串表示不修改
      const payload = {
        baseUrl: values.baseUrl || undefined,
        model: values.model || undefined,
        analysisCacheTtl: values.analysisCacheTtl,
      }
      if (values.apiKey && values.apiKey.trim()) {
        payload.apiKey = values.apiKey.trim()
      }
      const res = await updateLlmConfig(payload)
      setLlmConfig(res.data)
      message.success('LLM 配置已保存，立即生效')
      setLlmEditing(false)
    } catch (err) {
      if (err.errorFields) return
      message.error('保存失败: ' + (err.response?.data?.message || err.message))
    } finally {
      setLlmSaving(false)
    }
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
  }

  if (!config) {
    return <Alert message="无法加载配置" type="error" />
  }

  return (
    <div>
      <div className="page-title">系统配置</div>
      <div className="page-subtitle">查看和管理流水线配置参数，测试 LLM 与飞书连通性</div>

      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ReloadOutlined />} onClick={fetchConfig}>刷新配置</Button>
        <Button type="primary" loading={testingLlm} onClick={handleTestLlm}>测试 LLM 连通</Button>
        <Button loading={testingFeishu} onClick={handleTestFeishu}>测试飞书推送</Button>
      </Space>

      <Card variant="borderless" style={{ borderRadius: 12, marginBottom: 16 }}>
        <Descriptions title="错误接入" column={{ xs: 1, md: 2 }} size="small" bordered>
          <Descriptions.Item label="已注册服务">{displayVal(config['ingest.registeredServices'])} 个</Descriptions.Item>
          <Descriptions.Item label="已启用服务">{displayVal(config['ingest.enabledServices'])} 个</Descriptions.Item>
          <Descriptions.Item label="去重冷却">{displayVal(config['ingest.dedupCooldownSeconds']) ? (config['ingest.dedupCooldownSeconds'] / 60) + ' 分钟' : '-'}</Descriptions.Item>
          <Descriptions.Item label="限流启用"><BoolTag value={config['ingest.rateLimitEnabled']} /></Descriptions.Item>
          <Descriptions.Item label="全局 QPS">{displayVal(config['ingest.globalQps'])}</Descriptions.Item>
          <Descriptions.Item label="每服务 QPS">{displayVal(config['ingest.perServiceQps'])}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card
        variant="borderless"
        style={{ borderRadius: 12, marginBottom: 16 }}
        title="大模型 (LLM)"
        extra={
          llmEditing ? (
            <Space>
              <Button type="primary" size="small" icon={<SaveOutlined />} loading={llmSaving} onClick={handleLlmSave}>保存</Button>
              <Button size="small" onClick={() => setLlmEditing(false)}>取消</Button>
            </Space>
          ) : (
            <Button size="small" icon={<EditOutlined />} onClick={handleLlmEdit}>编辑</Button>
          )
        }
      >
        {llmEditing ? (
          <Form form={llmForm} layout="vertical" size="small">
            <Form.Item name="baseUrl" label="Base URL（OpenAI 兼容格式）" rules={[{ required: true, message: '请输入 Base URL' }]}>
              <Input placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1" />
            </Form.Item>
            <Form.Item name="model" label="模型名称" rules={[{ required: true, message: '请输入模型名称' }]}>
              <Input placeholder="如: deepseek-v4-flash-0731, qwen-turbo, gpt-4o-mini" />
            </Form.Item>
            <Form.Item
              name="apiKey"
              label={
                <Space>
                  <span>API Key</span>
                  <Tooltip title="留空表示不修改现有 Key，输入新值会覆盖">
                    <span style={{ color: llmConfig?.apiKeyConfigured ? '#52c41a' : '#ff4d4f', fontSize: 12 }}>
                      {llmConfig?.apiKeyConfigured ? '（当前已配置）' : '（当前未配置）'}
                    </span>
                  </Tooltip>
                </Space>
              }
            >
              <Input.Password placeholder="留空不修改，输入新值则覆盖" />
            </Form.Item>
            <Form.Item name="analysisCacheTtl" label="同指纹缓存 TTL（秒，0=不缓存）" rules={[{ required: true }]}>
              <InputNumber min={0} max={86400} style={{ width: '100%' }} />
            </Form.Item>
          </Form>
        ) : (
          <Descriptions column={{ xs: 1, md: 2 }} size="small" bordered>
            <Descriptions.Item label="Base URL">{displayVal(llmConfig?.baseUrl)}</Descriptions.Item>
            <Descriptions.Item label="模型">{displayVal(llmConfig?.model)}</Descriptions.Item>
            <Descriptions.Item label="API Key 已配置"><BoolTag value={llmConfig?.apiKeyConfigured} /></Descriptions.Item>
            <Descriptions.Item label="分析缓存 TTL(秒)">{displayVal(llmConfig?.analysisCacheTtl)}</Descriptions.Item>
          </Descriptions>
        )}
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card variant="borderless" style={{ borderRadius: 12, marginBottom: 16 }}>
            <Descriptions title="通知路由（飞书/钉钉）" column={1} size="small" bordered>
              <Descriptions.Item label="飞书全局 Webhook"><BoolTag value={config['feishu.webhookConfigured']} /></Descriptions.Item>
              <Descriptions.Item label="服务级路由规则数">{displayVal(config['notifyRouting.totalRules'])} 条</Descriptions.Item>
              <Descriptions.Item label="已启用的路由规则">{displayVal(config['notifyRouting.enabledRules'])} 条</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card variant="borderless" style={{ borderRadius: 12, marginBottom: 16 }}>
            <Descriptions title="Jira" column={1} size="small" bordered>
              <Descriptions.Item label="启用"><BoolTag value={config['jira.enabled']} /></Descriptions.Item>
              <Descriptions.Item label="Base URL">{displayVal(config['jira.baseUrl'])}</Descriptions.Item>
              <Descriptions.Item label="项目 Key">{displayVal(config['jira.projectKey'])}</Descriptions.Item>
              <Descriptions.Item label="Local 环境建单"><BoolTag value={config['jira.enableForLocal']} /></Descriptions.Item>
              <Descriptions.Item label="未配置时 Mock"><BoolTag value={config['jira.mockWhenUnconfigured']} /></Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>

      <Card variant="borderless" style={{ borderRadius: 12 }}>
        <Descriptions title="流水线" column={{ xs: 1, md: 2 }} size="small" bordered>
          <Descriptions.Item label="启用"><BoolTag value={config['pipeline.enabled']} /></Descriptions.Item>
          <Descriptions.Item label="通知渠道">{displayVal(config['pipeline.notifyChannel'])}</Descriptions.Item>
          <Descriptions.Item label="通知启用"><BoolTag value={config['pipeline.notifyEnabled']} /></Descriptions.Item>
          <Descriptions.Item label="详情 Base URL">{displayVal(config['pipeline.detailBaseUrl'])}</Descriptions.Item>
        </Descriptions>
      </Card>
    </div>
  )
}
