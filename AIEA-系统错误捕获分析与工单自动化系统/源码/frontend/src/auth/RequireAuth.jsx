import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { isAuthenticated } from './auth.js'

/**
 * 路由守卫：未登录时重定向到 /login
 * 登录后可继续访问受保护的子路由
 */
export default function RequireAuth({ children }) {
  const location = useLocation()

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return children
}
