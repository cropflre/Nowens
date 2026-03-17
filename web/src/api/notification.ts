import http from '@/utils/http'
import type { ApiResponse, Notification, PaginatedList } from '@/types'

// 获取通知列表
export function getNotifications(params: { page?: number; page_size?: number; unread?: boolean }) {
  return http.get<any, ApiResponse<{ list: Notification[]; total: number; page: number }>>('/notifications', { params })
}

// 获取未读通知数量
export function getUnreadCount() {
  return http.get<any, ApiResponse<{ count: number }>>('/notifications/unread-count')
}

// 标记单条为已读
export function markAsRead(id: number) {
  return http.put<any, ApiResponse>(`/notifications/${id}/read`)
}

// 标记全部为已读
export function markAllAsRead() {
  return http.put<any, ApiResponse>('/notifications/read-all')
}

// 删除通知
export function deleteNotification(id: number) {
  return http.delete<any, ApiResponse>(`/notifications/${id}`)
}

// 清空所有通知
export function clearAllNotifications() {
  return http.delete<any, ApiResponse>('/notifications/clear')
}
