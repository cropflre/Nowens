import http from '@/utils/http'
import type { ApiResponse, AuthResponse, User } from '@/types'

// 用户注册
export function register(data: { username: string; password: string; nickname?: string }) {
  return http.post<any, ApiResponse<AuthResponse>>('/auth/register', data)
}

// 用户登录
export function login(data: { username: string; password: string; mfa_code?: string }) {
  return http.post<any, ApiResponse<AuthResponse>>('/auth/login', data)
}

// 刷新 Token
export function refreshToken(refreshToken: string) {
  return http.post<any, ApiResponse<{ token: string; refresh_token: string }>>('/auth/refresh', { refresh_token: refreshToken })
}

// 获取当前用户信息
export function getProfile() {
  return http.get<any, ApiResponse<User>>('/user/profile')
}

// 更新用户资料
export function updateProfile(data: { nickname?: string; avatar?: string }) {
  return http.put<any, ApiResponse>('/user/profile', data)
}
