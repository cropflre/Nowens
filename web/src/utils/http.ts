import axios from 'axios'
import { message } from 'antd'

// 创建 axios 实例
const http = axios.create({
  baseURL: '/api',
  timeout: 30000,
})

// 是否正在刷新 Token
let isRefreshing = false
// 等待刷新的请求队列
let refreshQueue: Array<(token: string) => void> = []

// 请求拦截器 — 自动附加 Token
http.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// 响应拦截器 — 统一错误处理 + Token 自动刷新
http.interceptors.response.use(
  (response) => {
    const res = response.data
    if (res.code !== 0) {
      // Token 过期，尝试刷新
      if (res.code === 401) {
        return handleTokenRefresh(response.config)
      }
      message.error(res.msg || '请求失败')
      return Promise.reject(new Error(res.msg))
    }
    return res
  },
  (error) => {
    if (error.response?.status === 401) {
      return handleTokenRefresh(error.config)
    }
    message.error(error.response?.data?.msg || '网络错误')
    return Promise.reject(error)
  }
)

// Token 刷新逻辑
async function handleTokenRefresh(originalConfig: any) {
  // 如果是刷新请求本身失败，直接登出
  if (originalConfig.url === '/auth/refresh') {
    forceLogout()
    return Promise.reject(new Error('Token 刷新失败'))
  }

  if (!isRefreshing) {
    isRefreshing = true
    const refreshToken = localStorage.getItem('refresh_token')

    if (!refreshToken) {
      forceLogout()
      return Promise.reject(new Error('无 Refresh Token'))
    }

    try {
      // 使用原始 axios 避免拦截器循环
      const res = await axios.post('/api/auth/refresh', { refresh_token: refreshToken })
      if (res.data?.code === 0) {
        const { token, refresh_token } = res.data.data
        localStorage.setItem('token', token)
        localStorage.setItem('refresh_token', refresh_token)

        // 重放队列中的请求
        refreshQueue.forEach((cb) => cb(token))
        refreshQueue = []
        isRefreshing = false

        // 重试原始请求
        originalConfig.headers.Authorization = `Bearer ${token}`
        return http(originalConfig)
      } else {
        throw new Error('刷新失败')
      }
    } catch {
      refreshQueue = []
      isRefreshing = false
      forceLogout()
      return Promise.reject(new Error('Token 刷新失败'))
    }
  } else {
    // 如果正在刷新，将请求加入队列
    return new Promise((resolve) => {
      refreshQueue.push((token: string) => {
        originalConfig.headers.Authorization = `Bearer ${token}`
        resolve(http(originalConfig))
      })
    })
  }
}

function forceLogout() {
  localStorage.removeItem('token')
  localStorage.removeItem('refresh_token')
  message.error('登录已过期，请重新登录')
  window.location.href = '/login'
}

export default http
