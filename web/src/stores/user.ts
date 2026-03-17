import { create } from 'zustand'
import type { User } from '@/types'
import { getProfile, login as loginApi, register as registerApi } from '@/api/user'
import { message } from 'antd'

interface UserState {
  user: User | null
  token: string
  isLoggedIn: boolean
  login: (username: string, password: string) => Promise<boolean>
  register: (username: string, password: string, nickname?: string) => Promise<boolean>
  fetchProfile: () => Promise<void>
  logout: () => void
}

export const useUserStore = create<UserState>((set, get) => ({
  user: null,
  token: localStorage.getItem('token') || '',
  isLoggedIn: !!localStorage.getItem('token'),

  login: async (username: string, password: string) => {
    try {
      const res = await loginApi({ username, password })
      const { token, user } = res.data!
      set({ token, user, isLoggedIn: true })
      localStorage.setItem('token', token)
      message.success('登录成功')
      return true
    } catch {
      return false
    }
  },

  register: async (username: string, password: string, nickname?: string) => {
    try {
      const res = await registerApi({ username, password, nickname })
      const { token, user } = res.data!
      set({ token, user, isLoggedIn: true })
      localStorage.setItem('token', token)
      message.success('注册成功')
      return true
    } catch {
      return false
    }
  },

  fetchProfile: async () => {
    const { token } = get()
    if (!token) return
    try {
      const res = await getProfile()
      set({ user: res.data!, isLoggedIn: true })
    } catch {
      get().logout()
    }
  },

  logout: () => {
    set({ token: '', user: null, isLoggedIn: false })
    localStorage.removeItem('token')
    window.location.href = '/login'
  },
}))
