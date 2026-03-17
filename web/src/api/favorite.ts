import http from '@/utils/http'
import type { ApiResponse } from '@/types'

// 添加收藏
export function addFavorite(fileId: number) {
  return http.post<any, ApiResponse>('/favorites', { file_id: fileId })
}

// 取消收藏
export function removeFavorite(fileId: number) {
  return http.delete<any, ApiResponse>(`/favorites/${fileId}`)
}

// 获取收藏列表
export function getFavorites() {
  return http.get<any, ApiResponse<any[]>>('/favorites')
}

// 检查是否已收藏
export function checkFavorite(fileId: number) {
  return http.get<any, ApiResponse<{ is_favorited: boolean }>>(`/favorites/check/${fileId}`)
}
