import http from '@/utils/http'
import type { ApiResponse } from '@/types'

// 获取个人仪表盘数据
export function getDashboard() {
  return http.get<any, ApiResponse<any>>('/dashboard')
}

// 秒传检查
export function checkInstantUpload(data: { hash: string; parent_id: number; file_name: string; size: number; mime_type?: string }) {
  return http.post<any, ApiResponse<{ instant: boolean; file?: any }>>('/files/instant-upload', data)
}

// 获取文本文件内容（在线编辑）
export function getTextContent(uuid: string) {
  return http.get<any, ApiResponse<{ content: string; file: any; mime_type: string }>>(`/files/content/${uuid}`)
}

// 保存文本文件内容
export function saveTextContent(uuid: string, content: string) {
  return http.put<any, ApiResponse<any>>(`/files/content/${uuid}`, { content })
}

// 获取定时同步任务列表
export function getSyncSchedules() {
  return http.get<any, ApiResponse<any[]>>('/sync-schedules')
}

// 创建定时同步任务
export function createSyncSchedule(data: { mount_id: number; cron_expr: string }) {
  return http.post<any, ApiResponse<any>>('/sync-schedules', data)
}

// 更新定时同步任务
export function updateSyncSchedule(id: number, data: { cron_expr?: string; enabled?: boolean }) {
  return http.put<any, ApiResponse>(`/sync-schedules/${id}`, data)
}

// 删除定时同步任务
export function deleteSyncSchedule(id: number) {
  return http.delete<any, ApiResponse>(`/sync-schedules/${id}`)
}

// 按数据源获取定时任务
export function getScheduleByMount(mountId: number) {
  return http.get<any, ApiResponse<any>>(`/sync-schedules/mount/${mountId}`)
}
