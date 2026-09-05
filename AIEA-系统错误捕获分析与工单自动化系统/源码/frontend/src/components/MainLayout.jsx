import React, { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu, theme, Space, Avatar, Dropdown } from 'antd'
import {
  DashboardOutlined,
  BugOutlined,
  SettingOutlined,
  ThunderboltOutlined,
  GroupOutlined,
  BellOutlined,
  SolutionOutlined,
  NotificationOutlined,
  ApiOutlined,
  UserOutlined,
  LogoutOutlined,
} from '@ant-design/icons'
import { logout, getCurrentUser } from '../auth/auth.js'

const { Header, Sider, Content } = Layout

const menuItems = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: '仪表盘' },
  { key: '/errors', icon: <BugOutlined />, label: '错误事件' },
  { key: '/error-groups', icon: <GroupOutlined />, label: '错误聚合' },
  { key: '/suppress-rules', icon: <BellOutlined />, label: '告警规则' },
  { key: '/service-registry', icon: <ApiOutlined />, label: '服务注册' },
  { key: '/notify-routing', icon: <NotificationOutlined />, label: '通知路由' },
  { key: '/tickets', icon: <SolutionOutlined />, label: '工单管理' },
  { key: '/config', icon: <SettingOutlined />, label: '系统配置' },
]

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { token: themeToken } = theme.useToken()

  const selectedKey = '/' + location.pathname.split('/')[1]

  const currentUser = getCurrentUser()

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <Layout style={{ height: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        style={{ background: themeToken.colorBgContainer, height: '100vh', position: 'sticky', top: 0, left: 0, overflow: 'auto' }}
      >
        <div style={{
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          borderBottom: `1px solid ${themeToken.colorBorderSecondary}`,
        }}>
          <ThunderboltOutlined style={{ fontSize: 24, color: themeToken.colorPrimary }} />
          {!collapsed && (
            <span style={{
              fontSize: 18,
              fontWeight: 700,
              background: `linear-gradient(135deg, ${themeToken.colorPrimary}, #722ed1)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              AIEA
            </span>
          )}
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 'none' }}
        />
      </Sider>
      <Layout>
        <Header style={{
          background: themeToken.colorBgContainer,
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `1px solid ${themeToken.colorBorderSecondary}`,
          height: 56,
        }}>
          <span style={{ fontSize: 15, color: themeToken.colorTextSecondary }}>
            AI 错误根因分析与工单自动化平台
          </span>
          <Dropdown menu={{
            items: [
              {
                key: 'logout',
                icon: <LogoutOutlined />,
                label: '退出登录',
                onClick: handleLogout,
              },
            ],
          }} placement="bottomRight">
            <Space style={{ cursor: 'pointer' }}>
              <Avatar size="small" icon={<UserOutlined />} style={{ background: themeToken.colorPrimary }} />
              <span style={{ fontSize: 14, color: themeToken.colorText }}>
                {currentUser || 'admin'}
              </span>
            </Space>
          </Dropdown>
        </Header>
        <Content style={{ margin: 24, minHeight: 280, overflowY: 'auto' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
