import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 15000,
})

// 错误事件列表
export const getErrors = (params = {}) => api.get('/errors', { params })

// 错误事件详情
export const getErrorDetail = (id) => api.get(`/errors/${id}`)

// 重试流水线
export const retryPipeline = (id) => api.post(`/errors/${id}/retry`)

// 系统配置
export const getConfig = () => api.get('/admin/config')

// LLM 连通性测试
export const testLlm = () => axios.get('/api/test/llm')

// 飞书连通性测试
export const testFeishu = () => axios.get('/api/test/feishu')

// ===== LLM 配置（前端可编辑） =====
export const getLlmConfig = () => api.get('/llm-config')
export const updateLlmConfig = (data) => api.put('/llm-config', data)

// 告警抑制规则
export const getSuppressRules = () => api.get('/stats/suppress-rules')

// 更新单指纹冷却时间
export const updateSuppressRuleCooldown = (fingerprint, cooldownSec) =>
  api.put(`/stats/suppress-rules/${fingerprint}/cooldown`, { cooldownSec })

// 全局统计概览
export const getStatsOverview = () => api.get('/stats/overview')

// ===== 内置工单 =====
export const getTickets = (params = {}) => api.get('/tickets', { params })
export const getTicketDetail = (id) => api.get(`/tickets/${id}`)
export const getTicketsByEvent = (eventId) => api.get(`/tickets/by-event/${eventId}`)
export const claimTicket = (id, assignee) => api.post(`/tickets/${id}/claim`, { assignee })
export const resolveTicket = (id, resolution, operator) => api.post(`/tickets/${id}/resolve`, { resolution, operator })
export const closeTicket = (id, operator) => api.post(`/tickets/${id}/close`, { operator })
export const ignoreTicket = (id, operator, remark) => api.post(`/tickets/${id}/ignore`, { operator, remark })
export const reopenTicket = (id, operator, remark) => api.post(`/tickets/${id}/reopen`, { operator, remark })
export const changeTicketPriority = (id, priority, operator) => api.post(`/tickets/${id}/priority`, { priority, operator })

// ===== 服务注册（上报 Token 管理） =====
export const getServiceRegistry = () => api.get('/service-registry')
export const createServiceRegistry = (data) => api.post('/service-registry', data)
export const updateServiceRegistry = (id, data) => api.put(`/service-registry/${id}`, data)
export const deleteServiceRegistry = (id) => api.delete(`/service-registry/${id}`)
export const regenerateServiceToken = (id) => api.post(`/service-registry/${id}/regenerate-token`)

// ===== 通知路由（多飞书机器人） =====
export const getNotifyRoutes = () => api.get('/notify-routing')
export const createNotifyRoute = (data) => api.post('/notify-routing', data)
export const updateNotifyRoute = (id, data) => api.put(`/notify-routing/${id}`, data)
export const deleteNotifyRoute = (id) => api.delete(`/notify-routing/${id}`)
export const testNotifyRoute = (id) => api.post(`/notify-routing/${id}/test`)
