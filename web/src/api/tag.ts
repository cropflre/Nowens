import http from '@/utils/http'
import type { ApiResponse, Tag } from '@/types'

// 创建标签
export function createTag(data: { name: string; color?: string }) {
  return http.post<any, ApiResponse<Tag>>('/tags', data)
}

// 获取标签列表
export function getTags() {
  return http.get<any, ApiResponse<any[]>>('/tags')
}

// 更新标签
export function updateTag(id: number, data: { name?: string; color?: string }) {
  return http.put<any, ApiResponse>(`/tags/${id}`, data)
}

// 删除标签
export function deleteTag(id: number) {
  return http.delete<any, ApiResponse>(`/tags/${id}`)
}

// 给文件打标签
export function tagFile(data: { file_id: number; tag_id: number }) {
  return http.post<any, ApiResponse>('/tags/file', data)
}

// 取消文件标签
export function untagFile(fileId: number, tagId: number) {
  return http.delete<any, ApiResponse>(`/tags/file/${fileId}/${tagId}`)
}

// 获取文件的标签
export function getFileTags(fileId: number) {
  return http.get<any, ApiResponse<Tag[]>>(`/tags/file/${fileId}`)
}

// 按标签获取文件
export function getFilesByTag(tagId: number) {
  return http.get<any, ApiResponse<any[]>>(`/tags/${tagId}/files`)
}
