// 纯前端认证模块：账号密码写死 admin/admin
// 通过 localStorage 保持登录态，刷新页面不丢失

const AUTH_KEY = 'aiea_auth'
const USER_KEY = 'aiea_user'

const ADMIN_USER = 'admin'
const ADMIN_PWD = 'admin'

/** 判断当前是否已登录 */
export function isAuthenticated() {
  return localStorage.getItem(AUTH_KEY) === 'true'
}

/**
 * 登录校验
 * @param {string} username
 * @param {string} password
 * @returns {boolean} 是否登录成功
 */
export function login(username, password) {
  if (username === ADMIN_USER && password === ADMIN_PWD) {
    localStorage.setItem(AUTH_KEY, 'true')
    localStorage.setItem(USER_KEY, username)
    return true
  }
  return false
}

/** 退出登录，清除登录态 */
export function logout() {
  localStorage.removeItem(AUTH_KEY)
  localStorage.removeItem(USER_KEY)
}

/** 获取当前登录用户名 */
export function getCurrentUser() {
  return localStorage.getItem(USER_KEY) || ''
}
