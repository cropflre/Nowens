package handler

import (
	"net/http"
	"nowen-file/service"
	"strconv"

	"github.com/gin-gonic/gin"
)

// WorkspaceHandler 协作空间接口
type WorkspaceHandler struct {
	wsService *service.WorkspaceService
}

// NewWorkspaceHandler 创建协作空间接口
func NewWorkspaceHandler() *WorkspaceHandler {
	return &WorkspaceHandler{
		wsService: service.NewWorkspaceService(),
	}
}

// CreateWorkspace 创建空间
// POST /api/workspaces
func (h *WorkspaceHandler) CreateWorkspace(c *gin.Context) {
	userID := GetUserID(c)

	var req struct {
		Name        string `json:"name" binding:"required"`
		Description string `json:"description"`
		Icon        string `json:"icon"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "空间名称不能为空")
		return
	}

	ws, err := h.wsService.CreateWorkspace(userID, req.Name, req.Description, req.Icon)
	if err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}

	Success(c, ws)
}

// ListWorkspaces 我参与的空间列表
// GET /api/workspaces
func (h *WorkspaceHandler) ListWorkspaces(c *gin.Context) {
	userID := GetUserID(c)

	list, err := h.wsService.ListWorkspaces(userID)
	if err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	Success(c, list)
}

// GetWorkspace 空间详情
// GET /api/workspaces/:id
func (h *WorkspaceHandler) GetWorkspace(c *gin.Context) {
	userID := GetUserID(c)
	wsID := parseUintParam(c, "id")

	detail, err := h.wsService.GetWorkspace(userID, wsID)
	if err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}

	Success(c, detail)
}

// UpdateWorkspace 更新空间
// PUT /api/workspaces/:id
func (h *WorkspaceHandler) UpdateWorkspace(c *gin.Context) {
	userID := GetUserID(c)
	wsID := parseUintParam(c, "id")

	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		Icon        string `json:"icon"`
	}
	c.ShouldBindJSON(&req)

	if err := h.wsService.UpdateWorkspace(userID, wsID, req.Name, req.Description, req.Icon); err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}

	SuccessMsg(c, "更新成功")
}

// DeleteWorkspace 删除空间
// DELETE /api/workspaces/:id
func (h *WorkspaceHandler) DeleteWorkspace(c *gin.Context) {
	userID := GetUserID(c)
	wsID := parseUintParam(c, "id")

	if err := h.wsService.DeleteWorkspace(userID, wsID); err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}

	SuccessMsg(c, "空间已删除")
}

// AddMember 添加成员
// POST /api/workspaces/:id/members
func (h *WorkspaceHandler) AddMember(c *gin.Context) {
	userID := GetUserID(c)
	wsID := parseUintParam(c, "id")

	var req struct {
		Username string `json:"username" binding:"required"`
		Role     string `json:"role"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "请提供用户名")
		return
	}

	if err := h.wsService.AddMember(userID, wsID, req.Username, req.Role); err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}

	SuccessMsg(c, "成员已添加")
}

// RemoveMember 移除成员
// DELETE /api/workspaces/:id/members/:user_id
func (h *WorkspaceHandler) RemoveMember(c *gin.Context) {
	userID := GetUserID(c)
	wsID := parseUintParam(c, "id")
	targetID := parseUintParam(c, "user_id")

	if err := h.wsService.RemoveMember(userID, wsID, targetID); err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}

	SuccessMsg(c, "成员已移除")
}

// UpdateMemberRole 更新成员角色
// PUT /api/workspaces/:id/members/:user_id
func (h *WorkspaceHandler) UpdateMemberRole(c *gin.Context) {
	userID := GetUserID(c)
	wsID := parseUintParam(c, "id")
	targetID := parseUintParam(c, "user_id")

	var req struct {
		Role string `json:"role" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "请提供角色")
		return
	}

	if err := h.wsService.UpdateMemberRole(userID, wsID, targetID, req.Role); err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}

	SuccessMsg(c, "角色已更新")
}

// ListMembers 成员列表
// GET /api/workspaces/:id/members
func (h *WorkspaceHandler) ListMembers(c *gin.Context) {
	userID := GetUserID(c)
	wsID := parseUintParam(c, "id")

	members, err := h.wsService.ListMembers(userID, wsID)
	if err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}

	Success(c, members)
}

// SetFolderPermission 设置文件夹权限
// POST /api/workspaces/folder-permission
func (h *WorkspaceHandler) SetFolderPermission(c *gin.Context) {
	userID := GetUserID(c)

	var req struct {
		FolderID   uint   `json:"folder_id" binding:"required"`
		UserID     uint   `json:"user_id" binding:"required"`
		Permission string `json:"permission" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "参数错误")
		return
	}

	if err := h.wsService.SetFolderPermission(userID, req.FolderID, req.UserID, req.Permission); err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}

	SuccessMsg(c, "权限已设置")
}

// RemoveFolderPermission 移除文件夹权限
// DELETE /api/workspaces/folder-permission/:folder_id/:user_id
func (h *WorkspaceHandler) RemoveFolderPermission(c *gin.Context) {
	userID := GetUserID(c)
	folderID := parseUintParam(c, "folder_id")
	targetID := parseUintParam(c, "user_id")

	if err := h.wsService.RemoveFolderPermission(userID, folderID, targetID); err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}

	SuccessMsg(c, "权限已移除")
}

// ListFolderPermissions 查看文件夹权限
// GET /api/workspaces/folder-permission/:folder_id
func (h *WorkspaceHandler) ListFolderPermissions(c *gin.Context) {
	userID := GetUserID(c)
	folderID := parseUintParam(c, "folder_id")

	perms, err := h.wsService.ListFolderPermissions(userID, folderID)
	if err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	Success(c, perms)
}

// SearchUsers 搜索用户（用于添加成员）
// GET /api/workspaces/search-users?q=keyword
func (h *WorkspaceHandler) SearchUsers(c *gin.Context) {
	keyword := c.Query("q")
	if keyword == "" {
		Success(c, []interface{}{})
		return
	}

	users, err := h.wsService.SearchUsers(keyword, 10)
	if err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	Success(c, users)
}

// parseUintParam 解析 URL 路径参数为 uint
func parseUintParam(c *gin.Context, name string) uint {
	val, _ := strconv.ParseUint(c.Param(name), 10, 64)
	return uint(val)
}
