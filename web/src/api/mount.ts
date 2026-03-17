import http from '@/utils/http'
import type { ApiResponse, MountPoint, IndexedFile, IndexedFileListData, CreateMountRequest } from '@/types'

// ==================== 数据源/挂载点管理 ====================

// 创建数据源
export function createMount(data: CreateMountRequest) {
  return http.post<any, ApiResponse<MountPoint>>('/mounts', data)
}

// 数据源列表
export function listMounts() {
  return http.get<any, ApiResponse<MountPoint[]>>('/mounts')
}

// 数据源详情
export function getMount(id: number) {
  return http.get<any, ApiResponse<MountPoint>>(`/mounts/${id}`)
}

// 更新数据源
export function updateMount(id: number, data: Partial<CreateMountRequest>) {
  return http.put<any, ApiResponse>(`/mounts/${id}`, data)
}

// 删除数据源
export function deleteMount(id: number) {
  return http.delete<any, ApiResponse>(`/mounts/${id}`)
}

// 触发扫描
export function scanMount(id: number) {
  return http.post<any, ApiResponse>(`/mounts/${id}/scan`)
}

// 获取数据源统计
export function getMountStats(id: number) {
  return http.get<any, ApiResponse>(`/mounts/${id}/stats`)
}

// ==================== 索引文件浏览 ====================

// 浏览索引文件
export function listIndexedFiles(mountId: number, params: { path?: string; sort?: string; order?: string }) {
  return http.get<any, ApiResponse<IndexedFileListData>>(`/mounts/${mountId}/files`, { params })
}

// 搜索索引文件
export function searchIndexedFiles(keyword: string, mountId?: number) {
  return http.get<any, ApiResponse<IndexedFile[]>>('/mounts/search', { params: { keyword, mount_id: mountId || 0 } })
}

// 下载索引文件
export function getIndexedFileDownloadUrl(fileId: number): string {
  const token = localStorage.getItem('token')
  return `/api/mounts/files/${fileId}/download?token=${token}`
}

// 预览索引文件
export function getIndexedFilePreviewUrl(fileId: number): string {
  const token = localStorage.getItem('token')
  return `/api/mounts/files/${fileId}/preview?token=${token}`
}
