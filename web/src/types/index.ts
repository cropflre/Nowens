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
  is_encrypted: boolean
  is_starred: boolean
  is_archived: boolean
  trashed_at?: string
  created_at: string
  updated_at: string
}

// 分片上传初始化响应
export interface ChunkUploadInit {
  upload_id: string
  total_chunks?: number
  chunk_size?: number
  instant: boolean
}

// 分片上传状态响应
export interface ChunkUploadStatus {
  upload: {
    upload_id: string
    file_name: string
    file_size: number
    total_chunks: number
    status: string
  }
  missing_chunks: number[]
  progress: number
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
  refresh_token: string
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

// ==================== 数据源/挂载点相关类型 ====================

// 挂载点/数据源
export interface MountPoint {
  id: number
  user_id: number
  name: string
  type: 'local' | 'smb' | 'nfs' | 'agent'
  base_path: string
  agent_id?: string
  agent_addr?: string
  smb_user?: string
  status: 'online' | 'offline' | 'syncing' | 'error'
  file_count: number
  dir_count: number
  total_size: number
  last_sync: string
  sync_msg?: string
  created_at: string
  updated_at: string
}

// 索引文件
export interface IndexedFile {
  id: number
  mount_id: number
  user_id: number
  remote_path: string
  parent_path: string
  name: string
  is_dir: boolean
  size: number
  mime_type: string
  hash?: string
  mod_time: string
  created_at: string
  updated_at: string
}

// 索引文件列表响应
export interface IndexedFileListData {
  files: IndexedFile[]
  breadcrumb: Array<{ name: string; path: string }> | null
}

// 创建数据源请求
export interface CreateMountRequest {
  name: string
  type: string
  base_path: string
  agent_id?: string
  agent_addr?: string
  smb_user?: string
  smb_pass?: string
}

// ==================== 收藏夹相关类型 ====================

export interface FavoriteItem {
  id: number
  file_id: number
  file: FileItem
  created_at: string
}

// ==================== 标签相关类型 ====================

export interface Tag {
  id: number
  name: string
  color: string
  file_count?: number
  created_at: string
}

export interface FileTag {
  id: number
  file_id: number
  tag_id: number
}

// ==================== 通知相关类型 ====================

export interface Notification {
  id: number
  user_id: number
  type: 'share_viewed' | 'storage_warning' | 'scan_complete' | 'system'
  title: string
  content: string
  is_read: boolean
  related_id: number
  created_at: string
}

// ==================== 定时同步调度类型 ====================

export interface SyncSchedule {
  id: number
  mount_id: number
  user_id: number
  cron_expr: string
  enabled: boolean
  last_run?: string
  next_run?: string
  created_at: string
  updated_at: string
}

// ==================== 仪表盘类型 ====================

export interface DashboardStats {
  file_count: number
  folder_count: number
  trash_count: number
  share_count: number
  favorite_count: number
  storage_used: number
  storage_limit: number
  recent_files: FileItem[]
  type_distribution: Array<{
    category: string
    total: number
    count: number
  }>
  upload_trend: Array<{
    date: string
    count: number
    size: number
  }>
}

// ==================== 协作空间类型 ====================

export interface Workspace {
  id: number
  owner_id: number
  name: string
  description: string
  icon: string
  root_folder: number
  created_at: string
  updated_at: string
}

export interface WorkspaceMember {
  id: number
  workspace_id: number
  user_id: number
  role: 'owner' | 'editor' | 'viewer'
  joined_at: string
}

export interface FolderPermission {
  id: number
  folder_id: number
  user_id: number
  granted_by: number
  permission: 'read' | 'write'
  created_at: string
}

// ==================== 远程 Agent 类型 ====================

export interface AgentStatus {
  agent_id: string
  version: string
  hostname: string
  os: string
  arch: string
  uptime: number
  disk_free: number
  disk_total: number
  file_count: number
}

export interface AgentFileInfo {
  name: string
  path: string
  is_dir: boolean
  size: number
  mod_time: string
}

// ==================== 文件去重类型 ====================

export interface DuplicateGroup {
  hash: string
  size: number
  count: number
  files: FileItem[]
  wasted_size: number
}

export interface DedupStats {
  total_duplicate_groups: number
  total_duplicate_files: number
  total_wasted_size: number
  groups: DuplicateGroup[]
}

// ==================== Webhook 类型 ====================

export interface WebhookConfig {
  id: number
  user_id: number
  name: string
  url: string
  events: string
  platform: 'custom' | 'wechat_work' | 'dingtalk' | 'slack' | 'feishu'
  enabled: boolean
  created_at: string
  updated_at: string
}

// ==================== MFA 类型 ====================

export interface MFAStatus {
  enabled: boolean
  setup: boolean
  created_at?: string
}

export interface MFASetupResponse {
  secret: string
  qrcode_url: string
}
