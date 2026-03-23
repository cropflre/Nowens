import http from '@/utils/http'
import type { ApiResponse, MFAStatus, MFASetupResponse } from '@/types'

// 获取 MFA 状态
export function getMFAStatus() {
  return http.get<any, ApiResponse<MFAStatus>>('/mfa/status')
}

// 设置 MFA（获取密钥和二维码）
export function setupMFA() {
  return http.post<any, ApiResponse<MFASetupResponse>>('/mfa/setup')
}

// 验证并启用 MFA
export function verifyMFA(code: string) {
  return http.post<any, ApiResponse>('/mfa/verify', { code })
}

// 禁用 MFA
export function disableMFA(code: string) {
  return http.post<any, ApiResponse>('/mfa/disable', { code })
}
