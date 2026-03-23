import http from '@/utils/http'
import type { ApiResponse, WebhookConfig } from '@/types'

// 创建 Webhook
export function createWebhook(data: { name: string; url: string; events: string; platform?: string; secret?: string }) {
  return http.post<any, ApiResponse<WebhookConfig>>('/webhooks', data)
}

// 获取 Webhook 列表
export function listWebhooks() {
  return http.get<any, ApiResponse<WebhookConfig[]>>('/webhooks')
}

// 更新 Webhook
export function updateWebhook(id: number, data: Partial<WebhookConfig>) {
  return http.put<any, ApiResponse>(`/webhooks/${id}`, data)
}

// 删除 Webhook
export function deleteWebhook(id: number) {
  return http.delete<any, ApiResponse>(`/webhooks/${id}`)
}

// 测试 Webhook
export function testWebhook(id: number) {
  return http.post<any, ApiResponse>(`/webhooks/${id}/test`)
}
