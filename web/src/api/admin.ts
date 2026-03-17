import http from '@/utils/http'
import type { ApiResponse, User, AdminDashboard, AuditLog, PaginatedList } from '@/types'

// 系统概览
export function getDashboard() {
  return http.get<any, ApiResponse<AdminDashboard>>('/admin/dashboard')
}

// 用户列表
export function getUsers(page = 1, pageSize = 20) {
  return http.get<any, ApiResponse<PaginatedList<User>>>('/admin/users', { params: { page, page_size: pageSize } })
}

// 更新用户
export function updateUser(id: number, data: { role?: string; storage_limit?: number; nickname?: string }) {
  return http.put<any, ApiResponse>(`/admin/users/${id}`, data)
}

// 删除用户
export function deleteUser(id: number) {
  return http.delete<any, ApiResponse>(`/admin/users/${id}`)
}

// 重置密码
export function resetPassword(id: number, newPassword: string) {
  return http.post<any, ApiResponse>(`/admin/users/${id}/reset-password`, { new_password: newPassword })
}

// 审计日志列表
export function getAuditLogs(page = 1, pageSize = 20, userId?: number, action?: string) {
  return http.get<any, ApiResponse<PaginatedList<AuditLog>>>('/admin/logs', {
    params: { page, page_size: pageSize, user_id: userId || undefined, action: action || undefined },
  })
}

// 系统文件统计
export function getSystemFiles() {
  return http.get<any, ApiResponse<any>>('/admin/files')
}
