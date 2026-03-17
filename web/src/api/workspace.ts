import http from '@/utils/http'
import type { ApiResponse } from '@/types'

// ==================== 协作空间 API ====================

// 创建空间
export function createWorkspace(data: { name: string; description?: string; icon?: string }) {
  return http.post<any, ApiResponse<any>>('/workspaces', data)
}

// 空间列表
export function listWorkspaces() {
  return http.get<any, ApiResponse<any[]>>('/workspaces')
}

// 空间详情
export function getWorkspace(id: number) {
  return http.get<any, ApiResponse<any>>(`/workspaces/${id}`)
}

// 更新空间
export function updateWorkspace(id: number, data: { name?: string; description?: string; icon?: string }) {
  return http.put<any, ApiResponse>(`/workspaces/${id}`, data)
}

// 删除空间
export function deleteWorkspace(id: number) {
  return http.delete<any, ApiResponse>(`/workspaces/${id}`)
}

// 添加成员
export function addWorkspaceMember(wsId: number, data: { username: string; role?: string }) {
  return http.post<any, ApiResponse>(`/workspaces/${wsId}/members`, data)
}

// 成员列表
export function listWorkspaceMembers(wsId: number) {
  return http.get<any, ApiResponse<any[]>>(`/workspaces/${wsId}/members`)
}

// 更新成员角色
export function updateMemberRole(wsId: number, userId: number, role: string) {
  return http.put<any, ApiResponse>(`/workspaces/${wsId}/members/${userId}`, { role })
}

// 移除成员
export function removeMember(wsId: number, userId: number) {
  return http.delete<any, ApiResponse>(`/workspaces/${wsId}/members/${userId}`)
}

// 搜索用户
export function searchUsers(keyword: string) {
  return http.get<any, ApiResponse<any[]>>(`/workspaces/search-users?q=${encodeURIComponent(keyword)}`)
}

// 设置文件夹权限
export function setFolderPermission(data: { folder_id: number; user_id: number; permission: string }) {
  return http.post<any, ApiResponse>('/workspaces/folder-permission', data)
}

// 查看文件夹权限
export function listFolderPermissions(folderId: number) {
  return http.get<any, ApiResponse<any[]>>(`/workspaces/folder-permission/${folderId}`)
}

// 移除文件夹权限
export function removeFolderPermission(folderId: number, userId: number) {
  return http.delete<any, ApiResponse>(`/workspaces/folder-permission/${folderId}/${userId}`)
}

// ==================== 远程 Agent API ====================

// 注册 Agent
export function registerAgent(data: { agent_id: string; agent_addr: string; name?: string }) {
  return http.post<any, ApiResponse<any>>('/agents/register', data)
}

// 检测 Agent
export function pingAgent(agentAddr: string) {
  return http.post<any, ApiResponse<any>>('/agents/ping', { agent_addr: agentAddr })
}

// 浏览 Agent 文件
export function listAgentFiles(mountId: number, path: string = '/') {
  return http.get<any, ApiResponse<any[]>>(`/agents/${mountId}/files?path=${encodeURIComponent(path)}`)
}

// 同步 Agent 文件索引
export function syncAgentFiles(mountId: number) {
  return http.post<any, ApiResponse>(`/agents/${mountId}/sync`)
}
