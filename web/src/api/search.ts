import http from '@/utils/http'
import type { ApiResponse } from '@/types'

export interface FullTextSearchResult {
  file_id: number
  file_name: string
  score: number
  highlight: string // HTML 高亮片段
}

// 全文搜索
export function fullTextSearch(keyword: string, page = 1, pageSize = 20) {
  return http.get<any, ApiResponse<{ list: FullTextSearchResult[]; total: number; page: number }>>(
    '/files/fulltext-search',
    { params: { keyword, page, page_size: pageSize } }
  )
}

// 重建全文索引
export function rebuildSearchIndex() {
  return http.post<any, ApiResponse>('/files/fulltext-rebuild')
}
