import http from '@/utils/http'
import type { ApiResponse, AuthResponse, User } from '@/types'

// 用户注册
export function register(data: { username: string; password: string; nickname?: string }) {
  return http.post<any, ApiResponse<AuthResponse>>('/auth/register', data)
}

// 用户登录
export function login(data: { username: string; password: string }) {
  return http.post<any, ApiResponse<AuthResponse>>('/auth/login', data)
}

// 获取当前用户信息
export function getProfile() {
  return http.get<any, ApiResponse<User>>('/user/profile')
}

// 更新用户资料
export function updateProfile(data: { nickname?: string; avatar?: string }) {
  return http.put<any, ApiResponse>('/user/profile', data)
}
