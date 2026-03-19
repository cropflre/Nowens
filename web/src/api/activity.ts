import http from '@/utils/http'
import type { ApiResponse } from '@/types'

export interface Activity {
  id: number
  user_id: number
  username: string
  action: string
  target_type: string
  target_id: number
  target_name: string
  detail: string
  created_at: string
}

// 获取用户活动流
export function listActivities(page = 1, pageSize = 20) {
  return http.get<any, ApiResponse<{ list: Activity[]; total: number; page: number }>>('/activities', {
    params: { page, page_size: pageSize },
  })
}
