import http from '@/utils/http'
import type { ApiResponse, FileItem, FileListData, StorageStats, PreviewInfo, FileVersion } from '@/types'

// 获取文件列表
export function getFileList(params: { parent_id?: number; sort?: string; order?: string }) {
  return http.get<any, ApiResponse<FileListData>>('/files/list', { params })
}

// 创建文件夹
export function createFolder(data: { parent_id: number; name: string }) {
  return http.post<any, ApiResponse<FileItem>>('/files/folder', data)
}

// 上传文件
export function uploadFile(parentId: number, file: File, onProgress?: (percent: number) => void) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('parent_id', String(parentId))

  return http.post<any, ApiResponse<FileItem>>('/files/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 0, // 上传不设超时
    onUploadProgress: (event) => {
      if (event.total && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100))
      }
    },
  })
}

// 下载文件
export function getDownloadUrl(uuid: string): string {
  const token = localStorage.getItem('token')
  return `/api/files/download/${uuid}?token=${token}`
}

// 预览文件
export function getPreviewUrl(uuid: string): string {
  const token = localStorage.getItem('token')
  return `/api/files/preview/${uuid}?token=${token}`
}

// 重命名
export function renameFile(data: { file_id: number; new_name: string }) {
  return http.put<any, ApiResponse>('/files/rename', data)
}

// 移动文件
export function moveFile(data: { file_id: number; target_id: number }) {
  return http.put<any, ApiResponse>('/files/move', data)
}

// 移入回收站
export function trashFile(data: { file_id: number }) {
  return http.post<any, ApiResponse>('/files/trash', data)
}

// 恢复文件
export function restoreFile(data: { file_id: number }) {
  return http.post<any, ApiResponse>('/files/restore', data)
}

// 回收站列表
export function getTrashList() {
  return http.get<any, ApiResponse<FileItem[]>>('/files/trash')
}

// 永久删除
export function deleteFile(id: number) {
  return http.delete<any, ApiResponse>(`/files/${id}`)
}

// 搜索文件
export function searchFiles(keyword: string) {
  return http.get<any, ApiResponse<FileItem[]>>('/files/search', { params: { keyword } })
}

// 存储统计
export function getStorageStats() {
  return http.get<any, ApiResponse<StorageStats>>('/files/storage')
}

// 获取预览信息
export function getPreviewInfo(uuid: string) {
  return http.get<any, ApiResponse<PreviewInfo>>(`/files/preview-info/${uuid}`)
}

// 获取缩略图 URL
export function getThumbUrl(uuid: string): string {
  const token = localStorage.getItem('token')
  return `/api/files/thumb/${uuid}?token=${token}`
}

// 按类型搜索
export function searchByType(type: string) {
  return http.get<any, ApiResponse<FileItem[]>>(`/files/type/${type}`)
}

// ==================== 批量操作 ====================

// 批量移入回收站
export function batchTrash(fileIds: number[]) {
  return http.post<any, ApiResponse>('/files/batch/trash', { file_ids: fileIds })
}

// 批量移动
export function batchMove(fileIds: number[], targetId: number) {
  return http.post<any, ApiResponse>('/files/batch/move', { file_ids: fileIds, target_id: targetId })
}

// 批量永久删除
export function batchDelete(fileIds: number[]) {
  return http.post<any, ApiResponse>('/files/batch/delete', { file_ids: fileIds })
}

// ==================== 文件版本 ====================

// 获取文件版本列表
export function getFileVersions(fileId: number) {
  return http.get<any, ApiResponse<{ versions: FileVersion[]; version_count: number }>>(`/files/versions/${fileId}`)
}

// 回滚版本
export function restoreVersion(fileId: number, versionId: number) {
  return http.post<any, ApiResponse>('/files/versions/restore', { file_id: fileId, version_id: versionId })
}

// 删除版本
export function deleteVersion(fileId: number, versionId: number) {
  return http.delete<any, ApiResponse>(`/files/versions/${fileId}/${versionId}`)
}
