package service

import (
	"errors"
	"fmt"
	"nowen-file/model"
	"time"

	"gorm.io/gorm"
)

// WorkspaceService 协作空间服务
type WorkspaceService struct{}

// NewWorkspaceService 创建协作空间服务
func NewWorkspaceService() *WorkspaceService {
	return &WorkspaceService{}
}

// ==================== 空间管理 ====================

// CreateWorkspace 创建协作空间
func (s *WorkspaceService) CreateWorkspace(ownerID uint, name, description, icon string) (*model.Workspace, error) {
	if name == "" {
		return nil, errors.New("空间名称不能为空")
	}

	// 创建空间专属根文件夹
	fileService := &FileService{}
	folder, err := fileService.CreateFolder(ownerID, 0, "[空间] "+name)
	if err != nil {
		return nil, fmt.Errorf("创建空间文件夹失败: %v", err)
	}

	if icon == "" {
		icon = "📁"
	}

	ws := &model.Workspace{
		OwnerID:     ownerID,
		Name:        name,
		Description: description,
		Icon:        icon,
		RootFolder:  folder.ID,
	}

	if err := model.DB.Create(ws).Error; err != nil {
		return nil, fmt.Errorf("创建空间失败: %v", err)
	}

	// 将创建者添加为 owner 成员
	member := &model.WorkspaceMember{
		WorkspaceID: ws.ID,
		UserID:      ownerID,
		Role:        "owner",
		JoinedAt:    time.Now(),
	}
	model.DB.Create(member)

	return ws, nil
}

// GetWorkspace 获取空间详情（含成员数）
func (s *WorkspaceService) GetWorkspace(userID, wsID uint) (map[string]interface{}, error) {
	// 验证是否为成员
	if !s.IsMember(wsID, userID) {
		return nil, errors.New("您不是该空间的成员")
	}

	var ws model.Workspace
	if err := model.DB.First(&ws, wsID).Error; err != nil {
		return nil, errors.New("空间不存在")
	}

	var memberCount int64
	model.DB.Model(&model.WorkspaceMember{}).Where("workspace_id = ?", wsID).Count(&memberCount)

	// 获取当前用户角色
	var myMember model.WorkspaceMember
	model.DB.Where("workspace_id = ? AND user_id = ?", wsID, userID).First(&myMember)

	// 获取空间所有者信息
	var owner model.User
	model.DB.Select("id, username, nickname, avatar").First(&owner, ws.OwnerID)

	return map[string]interface{}{
		"workspace":    ws,
		"member_count": memberCount,
		"my_role":      myMember.Role,
		"owner":        owner,
	}, nil
}

// ListWorkspaces 获取用户参与的所有空间
func (s *WorkspaceService) ListWorkspaces(userID uint) ([]map[string]interface{}, error) {
	var members []model.WorkspaceMember
	model.DB.Where("user_id = ?", userID).Find(&members)

	var result []map[string]interface{}
	for _, m := range members {
		var ws model.Workspace
		if model.DB.First(&ws, m.WorkspaceID).Error == nil {
			var memberCount int64
			model.DB.Model(&model.WorkspaceMember{}).Where("workspace_id = ?", ws.ID).Count(&memberCount)

			var owner model.User
			model.DB.Select("id, username, nickname, avatar").First(&owner, ws.OwnerID)

			result = append(result, map[string]interface{}{
				"workspace":    ws,
				"my_role":      m.Role,
				"member_count": memberCount,
				"owner":        owner,
			})
		}
	}

	return result, nil
}

// UpdateWorkspace 更新空间信息（仅 owner/editor）
func (s *WorkspaceService) UpdateWorkspace(userID, wsID uint, name, description, icon string) error {
	role := s.GetMemberRole(wsID, userID)
	if role != "owner" {
		return errors.New("仅空间所有者可修改空间信息")
	}

	updates := map[string]interface{}{}
	if name != "" {
		updates["name"] = name
	}
	if description != "" {
		updates["description"] = description
	}
	if icon != "" {
		updates["icon"] = icon
	}

	return model.DB.Model(&model.Workspace{}).Where("id = ?", wsID).Updates(updates).Error
}

// DeleteWorkspace 删除空间（仅 owner）
func (s *WorkspaceService) DeleteWorkspace(userID, wsID uint) error {
	role := s.GetMemberRole(wsID, userID)
	if role != "owner" {
		return errors.New("仅空间所有者可删除空间")
	}

	// 删除成员
	model.DB.Where("workspace_id = ?", wsID).Delete(&model.WorkspaceMember{})
	// 删除权限
	model.DB.Where("folder_id IN (SELECT id FROM file_items WHERE parent_id = (SELECT root_folder FROM workspaces WHERE id = ?))", wsID).
		Delete(&model.FolderPermission{})
	// 删除空间
	model.DB.Delete(&model.Workspace{}, wsID)

	return nil
}

// ==================== 成员管理 ====================

// AddMember 添加成员（通过用户名）
func (s *WorkspaceService) AddMember(operatorID, wsID uint, username, role string) error {
	opRole := s.GetMemberRole(wsID, operatorID)
	if opRole != "owner" && opRole != "editor" {
		return errors.New("权限不足，无法添加成员")
	}

	// 查找用户
	var user model.User
	if err := model.DB.Where("username = ?", username).First(&user).Error; err != nil {
		return errors.New("用户不存在: " + username)
	}

	if user.ID == operatorID {
		return errors.New("不能添加自己")
	}

	// 检查是否已是成员
	if s.IsMember(wsID, user.ID) {
		return errors.New("该用户已是空间成员")
	}

	// 只有 owner 能添加 editor，editor 只能添加 viewer
	if role == "owner" {
		return errors.New("不能添加其他所有者")
	}
	if role == "editor" && opRole != "owner" {
		return errors.New("仅所有者可以添加编辑者")
	}
	if role == "" {
		role = "viewer"
	}

	member := &model.WorkspaceMember{
		WorkspaceID: wsID,
		UserID:      user.ID,
		Role:        role,
		JoinedAt:    time.Now(),
	}

	return model.DB.Create(member).Error
}

// RemoveMember 移除成员
func (s *WorkspaceService) RemoveMember(operatorID, wsID, targetUserID uint) error {
	opRole := s.GetMemberRole(wsID, operatorID)
	if opRole != "owner" {
		return errors.New("仅所有者可以移除成员")
	}

	if operatorID == targetUserID {
		return errors.New("不能移除自己")
	}

	result := model.DB.Where("workspace_id = ? AND user_id = ?", wsID, targetUserID).
		Delete(&model.WorkspaceMember{})
	if result.RowsAffected == 0 {
		return errors.New("该用户不是空间成员")
	}

	return nil
}

// UpdateMemberRole 更新成员角色
func (s *WorkspaceService) UpdateMemberRole(operatorID, wsID, targetUserID uint, newRole string) error {
	opRole := s.GetMemberRole(wsID, operatorID)
	if opRole != "owner" {
		return errors.New("仅所有者可以修改成员角色")
	}

	if newRole != "editor" && newRole != "viewer" {
		return errors.New("角色只能是 editor 或 viewer")
	}

	return model.DB.Model(&model.WorkspaceMember{}).
		Where("workspace_id = ? AND user_id = ?", wsID, targetUserID).
		Update("role", newRole).Error
}

// ListMembers 获取空间成员列表
func (s *WorkspaceService) ListMembers(userID, wsID uint) ([]map[string]interface{}, error) {
	if !s.IsMember(wsID, userID) {
		return nil, errors.New("您不是该空间的成员")
	}

	var members []model.WorkspaceMember
	model.DB.Where("workspace_id = ?", wsID).Order("role ASC, joined_at ASC").Find(&members)

	var result []map[string]interface{}
	for _, m := range members {
		var user model.User
		model.DB.Select("id, username, nickname, avatar").First(&user, m.UserID)
		result = append(result, map[string]interface{}{
			"id":        m.ID,
			"user_id":   m.UserID,
			"user":      user,
			"role":      m.Role,
			"joined_at": m.JoinedAt,
		})
	}

	return result, nil
}

// ==================== 权限检查 ====================

// IsMember 检查是否为空间成员
func (s *WorkspaceService) IsMember(wsID, userID uint) bool {
	var count int64
	model.DB.Model(&model.WorkspaceMember{}).
		Where("workspace_id = ? AND user_id = ?", wsID, userID).Count(&count)
	return count > 0
}

// GetMemberRole 获取成员角色
func (s *WorkspaceService) GetMemberRole(wsID, userID uint) string {
	var member model.WorkspaceMember
	if err := model.DB.Where("workspace_id = ? AND user_id = ?", wsID, userID).
		First(&member).Error; err != nil {
		return ""
	}
	return member.Role
}

// CanWrite 检查用户是否有写权限
func (s *WorkspaceService) CanWrite(wsID, userID uint) bool {
	role := s.GetMemberRole(wsID, userID)
	return role == "owner" || role == "editor"
}

// ==================== 文件夹级别权限 ====================

// SetFolderPermission 设置文件夹级别权限
func (s *WorkspaceService) SetFolderPermission(granterID, folderID, targetUserID uint, permission string) error {
	// 检查授权者是否是文件所有者
	var folder model.FileItem
	if err := model.DB.First(&folder, folderID).Error; err != nil {
		return errors.New("文件夹不存在")
	}

	if folder.UserID != granterID {
		return errors.New("只有文件所有者可以设置权限")
	}

	if !folder.IsDir {
		return errors.New("只能对文件夹设置权限")
	}

	if permission != "read" && permission != "write" {
		return errors.New("权限类型只能是 read 或 write")
	}

	// upsert
	var existing model.FolderPermission
	err := model.DB.Where("folder_id = ? AND user_id = ?", folderID, targetUserID).First(&existing).Error
	if err == gorm.ErrRecordNotFound {
		perm := &model.FolderPermission{
			FolderID:   folderID,
			UserID:     targetUserID,
			GrantedBy:  granterID,
			Permission: permission,
		}
		return model.DB.Create(perm).Error
	}
	return model.DB.Model(&existing).Update("permission", permission).Error
}

// RemoveFolderPermission 移除文件夹权限
func (s *WorkspaceService) RemoveFolderPermission(granterID, folderID, targetUserID uint) error {
	var folder model.FileItem
	if err := model.DB.First(&folder, folderID).Error; err != nil {
		return errors.New("文件夹不存在")
	}
	if folder.UserID != granterID {
		return errors.New("只有文件所有者可以管理权限")
	}

	model.DB.Where("folder_id = ? AND user_id = ?", folderID, targetUserID).
		Delete(&model.FolderPermission{})
	return nil
}

// ListFolderPermissions 获取文件夹的权限列表
func (s *WorkspaceService) ListFolderPermissions(userID, folderID uint) ([]map[string]interface{}, error) {
	var perms []model.FolderPermission
	model.DB.Where("folder_id = ?", folderID).Find(&perms)

	var result []map[string]interface{}
	for _, p := range perms {
		var user model.User
		model.DB.Select("id, username, nickname, avatar").First(&user, p.UserID)
		result = append(result, map[string]interface{}{
			"id":         p.ID,
			"user_id":    p.UserID,
			"user":       user,
			"permission": p.Permission,
			"created_at": p.CreatedAt,
		})
	}

	return result, nil
}

// GetFolderPermission 获取用户对某文件夹的权限
func (s *WorkspaceService) GetFolderPermission(folderID, userID uint) string {
	// 先检查是否是文件所有者
	var folder model.FileItem
	if model.DB.First(&folder, folderID).Error == nil && folder.UserID == userID {
		return "write" // 所有者有完整权限
	}

	var perm model.FolderPermission
	if err := model.DB.Where("folder_id = ? AND user_id = ?", folderID, userID).
		First(&perm).Error; err != nil {
		return "" // 无权限
	}
	return perm.Permission
}

// SearchUsers 搜索用户（用于添加成员时）
func (s *WorkspaceService) SearchUsers(keyword string, limit int) ([]model.User, error) {
	if limit <= 0 || limit > 20 {
		limit = 10
	}

	var users []model.User
	model.DB.Select("id, username, nickname, avatar").
		Where("username LIKE ? OR nickname LIKE ?", "%"+keyword+"%", "%"+keyword+"%").
		Limit(limit).Find(&users)

	return users, nil
}
