import http from '@/utils/http'
import type { ApiResponse, FileItem, FileListData, StorageStats, PreviewInfo, FileVersion, ChunkUploadInit, ChunkUploadStatus } from '@/types'

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

// 复制文件/文件夹
export function copyFile(data: { file_id: number; target_id: number }) {
  return http.post<any, ApiResponse<FileItem>>('/files/copy', data)
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

// 批量打包下载（ZIP）
export function batchDownload(fileIds: number[]) {
  const token = localStorage.getItem('token')
  return http.post('/files/batch/download', { file_ids: fileIds }, {
    responseType: 'blob',
    timeout: 0, // 不限超时
    headers: { Authorization: `Bearer ${token}` },
    // 跳过响应拦截器中的 JSON 解析
    transformResponse: [(data: any) => data],
  })
}

// ==================== 分片上传 ====================

// 默认分片大小: 5MB
export const CHUNK_SIZE = 5 * 1024 * 1024

// 初始化分片上传
export function initChunkUpload(data: {
  parent_id: number
  file_name: string
  file_size: number
  chunk_size: number
  mime_type: string
  hash?: string
}) {
  return http.post<any, ApiResponse<ChunkUploadInit>>('/files/chunk/init', data)
}

// 上传单个分片
export function uploadChunk(uploadId: string, chunkIndex: number, chunk: Blob, onProgress?: (percent: number) => void) {
  const formData = new FormData()
  formData.append('upload_id', uploadId)
  formData.append('chunk_index', String(chunkIndex))
  formData.append('chunk', chunk)

  return http.post<any, ApiResponse>('/files/chunk/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 0,
    onUploadProgress: (event) => {
      if (event.total && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100))
      }
    },
  })
}

// 合并分片
export function mergeChunks(uploadId: string) {
  return http.post<any, ApiResponse<FileItem>>('/files/chunk/merge', { upload_id: uploadId })
}

// 查询分片上传进度
export function getChunkUploadStatus(uploadId: string) {
  return http.get<any, ApiResponse<ChunkUploadStatus>>('/files/chunk/status', { params: { upload_id: uploadId } })
}

// 智能上传：小文件直传，大文件分片
export async function smartUpload(
  parentId: number,
  file: File,
  onProgress?: (percent: number) => void
): Promise<ApiResponse<FileItem>> {
  // 小于 10MB 使用普通上传
  if (file.size < 10 * 1024 * 1024) {
    return uploadFile(parentId, file, onProgress)
  }

  // 大文件使用分片上传
  const chunkSize = CHUNK_SIZE
  const totalChunks = Math.ceil(file.size / chunkSize)

  // 1. 初始化
  const initRes = await initChunkUpload({
    parent_id: parentId,
    file_name: file.name,
    file_size: file.size,
    chunk_size: chunkSize,
    mime_type: file.type || 'application/octet-stream',
  })

  if (initRes.data?.instant) {
    onProgress?.(100)
    return initRes as any
  }

  const uploadId = initRes.data!.upload_id

  // 2. 逐片上传
  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize
    const end = Math.min(start + chunkSize, file.size)
    const chunk = file.slice(start, end)

    await uploadChunk(uploadId, i, chunk)

    // 更新总进度
    const overallPercent = Math.round(((i + 1) / totalChunks) * 95) // 95% 给分片上传
    onProgress?.(overallPercent)
  }

  // 3. 合并
  const mergeRes = await mergeChunks(uploadId)
  onProgress?.(100)
  return mergeRes
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
