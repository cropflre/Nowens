// 用户相关类型
export interface User {
  id: number
  username: string
  nickname: string
  avatar: string
  role: string
  storage_limit: number
  storage_used: number
  created_at: string
  updated_at: string
}

// 文件/文件夹类型
export interface FileItem {
  id: number
  uuid: string
  user_id: number
  parent_id: number
  name: string
  is_dir: boolean
  size: number
  mime_type: string
  hash: string
  is_trash: boolean
  trashed_at?: string
  created_at: string
  updated_at: string
}

// 分享链接类型
export interface ShareLink {
  id: number
  code: string
  file_id: number
  user_id: number
  expire_at?: string
  view_count: number
  download_count: number
  created_at: string
}

// API 响应类型
export interface ApiResponse<T = any> {
  code: number
  msg: string
  data?: T
}

// 登录/注册响应
export interface AuthResponse {
  user: User
  token: string
}

// 文件列表响应
export interface FileListData {
  files: FileItem[]
  breadcrumb: FileItem[]
}

// 存储统计响应
export interface StorageStats {
  storage_limit: number
  storage_used: number
  type_stats: Array<{
    MimeType: string
    Total: number
    Count: number
  }>
}

// 预览信息响应
export interface PreviewInfo {
  file: FileItem
  previewable: boolean
  preview_type: 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'unknown'
  has_thumbnail: boolean
}

// 分享详情响应
export interface ShareDetail {
  need_password: boolean
  file_name?: string
  is_dir?: boolean
  size?: number
  mime_type?: string
  file?: FileItem
  share?: ShareLink
  previewable?: boolean
  preview_type?: string
}

// 文件版本
export interface FileVersion {
  id: number
  file_id: number
  user_id: number
  version: number
  size: number
  hash: string
  comment: string
  created_at: string
}

// 审计日志
export interface AuditLog {
  id: number
  user_id: number
  username: string
  action: string
  resource: string
  detail: string
  ip: string
  created_at: string
}

// 管理员 — 系统概览
export interface AdminDashboard {
  user_count: number
  file_count: number
  folder_count: number
  share_count: number
  total_storage: number
  today_uploads: number
}

// 分页响应
export interface PaginatedList<T> {
  list: T[]
  total: number
  page: number
}
