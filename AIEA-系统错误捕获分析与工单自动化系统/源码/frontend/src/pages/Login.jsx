import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { login, isAuthenticated } from '../auth/auth.js'
import './Login.css'

/**
 * 登录页 —— 参考 docs/loginhtml 动画小人登录界面
 * 账号密码写死 admin / admin
 *
 * 动画交互：
 *  1. 输入账号 → 紫色小人倾斜
 *  2. 输入密码 → 全体小人变形 + 眼睛向左看
 *  3. 点击登录且账号密码都为空 → 嘴巴变惊讶 + 全体倾斜
 *  4. 眼睛跟随鼠标（输入密码时自动失效）
 */
export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()

  // 已登录则直接跳转
  useEffect(() => {
    if (isAuthenticated()) {
      navigate('/dashboard', { replace: true })
    }
  }, [navigate])

  // 表单状态
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')

  // 动画状态
  const isTypingEmail = account.trim() !== ''
  const isTypingPwd = password.trim() !== ''
  const [surprised, setSurprised] = useState(false)

  // 眼睛跟随鼠标
  const containerRef = useRef(null)

  useEffect(() => {
    const handleMouseMove = (e) => {
      // 输入密码时眼睛跟随失效
      if (password.trim() !== '') return

      const container = containerRef.current
      if (!container) return

      const eyes = container.querySelectorAll('.p-eye, .b-eye, .y-eye, .o-eye')
      eyes.forEach((eye) => {
        const rect = eye.getBoundingClientRect()
        const eyeX = rect.left + rect.width / 2
        const eyeY = rect.top + rect.height / 2

        const deltaX = e.clientX - eyeX
        const deltaY = e.clientY - eyeY
        const angle = Math.atan2(deltaY, deltaX)

        const distance = Math.min(8, Math.hypot(deltaX, deltaY) / 6)
        const moveX = Math.cos(angle) * distance
        const moveY = Math.sin(angle) * distance

        eye.style.transform = `translate(${moveX}px, ${moveY}px)`
      })
    }

    document.addEventListener('mousemove', handleMouseMove)
    return () => document.removeEventListener('mousemove', handleMouseMove)
  }, [password])

  // 登录提交
  const handleLogin = (e) => {
    e?.preventDefault()

    const u = account.trim()
    const p = password.trim()

    // 账号密码都为空 → 触发惊讶动画
    if (u === '' && p === '') {
      setSurprised(true)
      setError('请输入账号和密码')
      return
    }

    if (u === '') {
      setError('请输入账号')
      return
    }
    if (p === '') {
      setError('请输入密码')
      return
    }

    setSurprised(false)

    if (login(u, p)) {
      setError('')
      // 登录成功，跳转到来源页或默认仪表盘
      const from = location.state?.from?.pathname || '/dashboard'
      navigate(from, { replace: true })
    } else {
      setError('账号或密码错误，请输入正确的账号密码')
    }
  }

  // 惊讶动画 class
  const surprisedClass = surprised ? ' surprised' : ''
  const leanAllClass = surprised ? ' leanall' : ''
  const peekingClass = isTypingPwd ? ' peeking' : ''
  const lookLeftClass = isTypingPwd ? ' look-left' : ''
  const leanClass = isTypingEmail ? ' lean' : ''

  return (
    <div className="login-page" ref={containerRef}>
      <div className="login-container">
        {/* 左侧动画小人区域 */}
        <div className="left-section">
          {/* 紫色小人 */}
          <div className={`purple${leanClass}${peekingClass}${leanAllClass}`}>
            <div className="p-eyes">
              <div className={`p-eye${lookLeftClass}`}></div>
              <div className={`p-eye${lookLeftClass}`}></div>
            </div>
            <div className={`p-mouth${surprisedClass}`}></div>
          </div>

          {/* 黑色小人 */}
          <div className={`black${peekingClass}${leanAllClass}`}>
            <div className="b-eyes">
              <div className={`b-eye${lookLeftClass}`}></div>
              <div className={`b-eye${lookLeftClass}`}></div>
            </div>
            <div className={`b-mouth${surprisedClass}`}></div>
          </div>

          {/* 黄色小人 */}
          <div className={`yellow${peekingClass}${leanAllClass}`}>
            <div className="y-eyes">
              <div className={`y-eye${lookLeftClass}`}></div>
              <div className={`y-eye${lookLeftClass}`}></div>
            </div>
            <div className={`y-mouth${surprisedClass}`}></div>
          </div>

          {/* 橙色小人 */}
          <div className={`orange${peekingClass}${leanAllClass}`}>
            <div className="o-eyes">
              <div className={`o-eye${lookLeftClass}`}></div>
              <div className={`o-eye${lookLeftClass}`}></div>
            </div>
            <div className={`o-mouth${surprisedClass}`}></div>
          </div>
        </div>

        {/* 右侧表单区域 */}
        <div className="right-section">
          <h1>欢迎回来!</h1>
          <p className="subtitle">请输入您的登录信息</p>

          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label>账号</label>
              <input
                type="text"
                value={account}
                onChange={(e) => {
                  setAccount(e.target.value)
                  setError('')
                  setSurprised(false)
                }}
                placeholder="admin"
                autoComplete="username"
              />
            </div>

            <div className="form-group">
              <label>密码</label>
              <input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setError('')
                  setSurprised(false)
                }}
                placeholder="admin"
                autoComplete="current-password"
              />
              <span
                className="eye-icon"
                onClick={() => setShowPwd(!showPwd)}
              >
                {showPwd ? '🙈' : '👁'}
              </span>
            </div>

            <div className="form-options">
              <label className="remember-me">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                记住密码
              </label>
              <a
                href="#"
                className="forgot-password"
                onClick={(e) => e.preventDefault()}
              >
                忘记密码?
              </a>
            </div>

            {error && <div className="login-error">{error}</div>}

            <button type="submit" className="btn-primary">
              登录
            </button>
          </form>

          <button
            type="button"
            className="btn-google"
            onClick={() => {
              setAccount('admin')
              setPassword('admin')
              setError('')
            }}
          >
            🔑 一键填充测试账号
          </button>

          <p className="login-hint">默认账号: admin &nbsp;|&nbsp; 默认密码: admin</p>
        </div>
      </div>
    </div>
  )
}
