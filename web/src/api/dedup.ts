import http from '@/utils/http'
import type { ApiResponse, DedupStats } from '@/types'

// 获取重复文件列表
export function getDuplicates(page = 1, pageSize = 20) {
  return http.get<any, ApiResponse<DedupStats>>('/dedup', { params: { page, page_size: pageSize } })
}

// 清理指定重复文件（传空数组则清理全部）
export function cleanDuplicates(hashes: string[] = []) {
  return http.post<any, ApiResponse<{ deleted_count: number; freed_size: number }>>('/dedup/clean', { hashes })
}
