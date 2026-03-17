import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { User } from '@/types'
import { getProfile, login as loginApi, register as registerApi } from '@/api/user'
import { ElMessage } from 'element-plus'
import router from '@/router'

export const useUserStore = defineStore('user', () => {
  const user = ref<User | null>(null)
  const token = ref<string>(localStorage.getItem('token') || '')
  const isLoggedIn = ref(!!token.value)

  // 登录
  async function login(username: string, password: string) {
    try {
      const res = await loginApi({ username, password })
      token.value = res.data!.token
      user.value = res.data!.user
      isLoggedIn.value = true
      localStorage.setItem('token', token.value)
      ElMessage.success('登录成功')
      router.push('/')
    } catch {
      // 错误已在拦截器处理
    }
  }

  // 注册
  async function register(username: string, password: string, nickname?: string) {
    try {
      const res = await registerApi({ username, password, nickname })
      token.value = res.data!.token
      user.value = res.data!.user
      isLoggedIn.value = true
      localStorage.setItem('token', token.value)
      ElMessage.success('注册成功')
      router.push('/')
    } catch {
      // 错误已在拦截器处理
    }
  }

  // 获取用户信息
  async function fetchProfile() {
    if (!token.value) return
    try {
      const res = await getProfile()
      user.value = res.data!
      isLoggedIn.value = true
    } catch {
      logout()
    }
  }

  // 退出登录
  function logout() {
    token.value = ''
    user.value = null
    isLoggedIn.value = false
    localStorage.removeItem('token')
    router.push('/login')
  }

  return {
    user,
    token,
    isLoggedIn,
    login,
    register,
    fetchProfile,
    logout,
  }
})
