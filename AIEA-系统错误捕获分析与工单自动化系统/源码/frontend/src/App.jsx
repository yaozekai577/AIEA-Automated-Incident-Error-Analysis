import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import MainLayout from './components/MainLayout.jsx'
import RequireAuth from './auth/RequireAuth.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import ErrorList from './pages/ErrorList.jsx'
import ErrorDetail from './pages/ErrorDetail.jsx'
import ErrorGroups from './pages/ErrorGroups.jsx'
import SuppressRules from './pages/SuppressRules.jsx'
import NotifyRouting from './pages/NotifyRouting.jsx'
import ServiceRegistry from './pages/ServiceRegistry.jsx'
import Tickets from './pages/Tickets.jsx'
import TicketDetail from './pages/TicketDetail.jsx'
import Config from './pages/Config.jsx'

export default function App() {
  return (
    <Routes>
      {/* 登录页（无需鉴权） */}
      <Route path="/login" element={<Login />} />
      {/* 以下路由需要登录后才能访问 */}
      <Route element={<RequireAuth><MainLayout /></RequireAuth>}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/errors" element={<ErrorList />} />
        <Route path="/errors/:id" element={<ErrorDetail />} />
        <Route path="/error-groups" element={<ErrorGroups />} />
        <Route path="/suppress-rules" element={<SuppressRules />} />
        <Route path="/service-registry" element={<ServiceRegistry />} />
        <Route path="/notify-routing" element={<NotifyRouting />} />
        <Route path="/tickets" element={<Tickets />} />
        <Route path="/tickets/:id" element={<TicketDetail />} />
        <Route path="/config" element={<Config />} />
      </Route>
    </Routes>
  )
}
