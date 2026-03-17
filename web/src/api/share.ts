import http from '@/utils/http'
import type { ApiResponse, ShareLink, ShareDetail } from '@/types'

// 创建分享
export function createShare(data: { file_id: number; password?: string; expire_days?: number }) {
  return http.post<any, ApiResponse<ShareLink>>('/share', data)
}

// 我的分享列表
export function getShareList() {
  return http.get<any, ApiResponse<ShareLink[]>>('/share/list')
}

// 删除分享
export function deleteShare(id: number) {
  return http.delete<any, ApiResponse>(`/share/${id}`)
}

// 获取分享内容（公开）
export function getShareInfo(code: string) {
  return http.get<any, ApiResponse<ShareDetail>>(`/share/${code}`)
}

// 验证分享密码（公开）
export function verifySharePassword(code: string, password: string) {
  return http.post<any, ApiResponse<ShareDetail>>(`/share/${code}/verify`, { password })
}

// 获取分享文件预览 URL（公开）
export function getSharePreviewUrl(code: string, password?: string): string {
  let url = `/api/share/${code}/preview`
  if (password) {
    url += `?password=${encodeURIComponent(password)}`
  }
  return url
}

// 获取分享文件下载 URL（公开）
export function getShareDownloadUrl(code: string, password?: string): string {
  let url = `/api/share/${code}/download`
  if (password) {
    url += `?password=${encodeURIComponent(password)}`
  }
  return url
}
