import axios from 'axios'
import { message } from 'antd'

// 创建 axios 实例
const http = axios.create({
  baseURL: '/api',
  timeout: 30000,
})

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

// 响应拦截器 — 统一错误处理
http.interceptors.response.use(
  (response) => {
    const res = response.data
    if (res.code !== 0) {
      message.error(res.msg || '请求失败')
      // Token 过期，跳转登录
      if (res.code === 401) {
        localStorage.removeItem('token')
        window.location.href = '/login'
      }
      return Promise.reject(new Error(res.msg))
    }
    return res
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
      message.error('登录已过期，请重新登录')
    } else {
      message.error(error.response?.data?.msg || '网络错误')
    }
    return Promise.reject(error)
  }
)

export default http
