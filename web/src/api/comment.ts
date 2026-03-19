import http from '@/utils/http'
import type { ApiResponse } from '@/types'

export interface Comment {
  id: number
  file_id: number
  user_id: number
  username: string
  content: string
  created_at: string
  updated_at: string
}

// 添加评论
export function addComment(data: { file_id: number; content: string }) {
  return http.post<any, ApiResponse<Comment>>('/comments', data)
}

// 获取文件评论列表
export function listComments(fileId: number) {
  return http.get<any, ApiResponse<Comment[]>>(`/comments/${fileId}`)
}

// 更新评论
export function updateComment(id: number, content: string) {
  return http.put<any, ApiResponse>(`/comments/${id}`, { content })
}

// 删除评论
export function deleteComment(id: number) {
  return http.delete<any, ApiResponse>(`/comments/${id}`)
}
