package handler

import (
	"net/http"
	"nowen-file/model"
	"nowen-file/service"
	"strconv"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// AdminHandler 管理员后台接口
type AdminHandler struct {
	auditService *service.AuditService
}

// NewAdminHandler 创建管理员接口实例
func NewAdminHandler() *AdminHandler {
	return &AdminHandler{
		auditService: service.NewAuditService(),
	}
}

// Dashboard 系统概览
// GET /api/admin/dashboard
func (h *AdminHandler) Dashboard(c *gin.Context) {
	var userCount int64
	model.DB.Model(&model.User{}).Count(&userCount)

	var fileCount int64
	model.DB.Model(&model.FileItem{}).Where("is_dir = ? AND is_trash = ?", false, false).Count(&fileCount)

	var folderCount int64
	model.DB.Model(&model.FileItem{}).Where("is_dir = ? AND is_trash = ?", true, false).Count(&folderCount)

	var shareCount int64
	model.DB.Model(&model.ShareLink{}).Count(&shareCount)

	// 总存储使用量
	var totalStorage int64
	model.DB.Model(&model.User{}).Select("COALESCE(SUM(storage_used), 0)").Scan(&totalStorage)

	// 今日上传量
	var todayUploads int64
	model.DB.Model(&model.FileItem{}).
		Where("is_dir = ? AND DATE(created_at) = DATE('now')", false).
		Count(&todayUploads)

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": gin.H{
			"user_count":    userCount,
			"file_count":    fileCount,
			"folder_count":  folderCount,
			"share_count":   shareCount,
			"total_storage": totalStorage,
			"today_uploads": todayUploads,
		},
	})
}

// ListUsers 用户列表
// GET /api/admin/users?page=1&page_size=20
func (h *AdminHandler) ListUsers(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	var users []model.User
	var total int64

	model.DB.Model(&model.User{}).Count(&total)
	model.DB.Order("id ASC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&users)

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": gin.H{
			"list":  users,
			"total": total,
			"page":  page,
		},
	})
}

// UpdateUser 更新用户信息（管理员操作）
// PUT /api/admin/users/:id
func (h *AdminHandler) UpdateUser(c *gin.Context) {
	userID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "参数错误"})
		return
	}

	var req struct {
		Role         string `json:"role"`          // 角色: admin / user
		StorageLimit int64  `json:"storage_limit"` // 存储限额（字节）
		Nickname     string `json:"nickname"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "参数错误"})
		return
	}

	updates := map[string]interface{}{}
	if req.Role != "" {
		if req.Role != "admin" && req.Role != "user" {
			c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "无效的角色"})
			return
		}
		updates["role"] = req.Role
	}
	if req.StorageLimit > 0 {
		updates["storage_limit"] = req.StorageLimit
	}
	if req.Nickname != "" {
		updates["nickname"] = req.Nickname
	}

	if len(updates) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "没有需要更新的字段"})
		return
	}

	result := model.DB.Model(&model.User{}).Where("id = ?", userID).Updates(updates)
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "msg": "用户不存在"})
		return
	}

	// 记录审计日志
	adminID := c.GetUint("user_id")
	adminName, _ := c.Get("username")
	h.auditService.Log(adminID, adminName.(string), service.ActionAdminUpdate, "user",
		"管理员修改用户["+strconv.FormatUint(userID, 10)+"]信息", c.ClientIP())

	c.JSON(http.StatusOK, gin.H{"code": 0, "msg": "更新成功"})
}

// DeleteUser 删除用户（管理员操作）
// DELETE /api/admin/users/:id
func (h *AdminHandler) DeleteUser(c *gin.Context) {
	userID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "参数错误"})
		return
	}

	adminID := c.GetUint("user_id")
	if uint(userID) == adminID {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "不能删除自己"})
		return
	}

	// 软删除：不实际删除，只标记
	result := model.DB.Where("id = ?", userID).Delete(&model.User{})
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "msg": "用户不存在"})
		return
	}

	adminName, _ := c.Get("username")
	h.auditService.Log(adminID, adminName.(string), service.ActionAdminUpdate, "user",
		"管理员删除用户["+strconv.FormatUint(userID, 10)+"]", c.ClientIP())

	c.JSON(http.StatusOK, gin.H{"code": 0, "msg": "删除成功"})
}

// ListAuditLogs 审计日志列表
// GET /api/admin/logs?page=1&page_size=20&user_id=0&action=
func (h *AdminHandler) ListAuditLogs(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	filterUserID, _ := strconv.ParseUint(c.Query("user_id"), 10, 64)
	filterAction := c.Query("action")

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	logs, total, err := h.auditService.ListLogs(page, pageSize, uint(filterUserID), filterAction)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "msg": "查询日志失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": gin.H{
			"list":  logs,
			"total": total,
			"page":  page,
		},
	})
}

// SystemFiles 全局文件统计
// GET /api/admin/files
func (h *AdminHandler) SystemFiles(c *gin.Context) {
	// 按 MIME 类型统计
	type MimeStat struct {
		MimeType string `json:"mime_type"`
		Total    int64  `json:"total"`
		Count    int64  `json:"count"`
	}
	var mimeStats []MimeStat
	model.DB.Model(&model.FileItem{}).
		Select("mime_type, SUM(size) as total, COUNT(*) as count").
		Where("is_dir = ? AND is_trash = ?", false, false).
		Group("mime_type").
		Order("total DESC").
		Find(&mimeStats)

	// 按用户统计
	type UserStat struct {
		UserID      uint   `json:"user_id"`
		Username    string `json:"username"`
		FileCount   int64  `json:"file_count"`
		StorageUsed int64  `json:"storage_used"`
	}
	var userStats []UserStat
	model.DB.Table("users").
		Select("users.id as user_id, users.username, COUNT(file_items.id) as file_count, users.storage_used").
		Joins("LEFT JOIN file_items ON users.id = file_items.user_id AND file_items.is_dir = ? AND file_items.is_trash = ?", false, false).
		Group("users.id").
		Order("users.storage_used DESC").
		Limit(20).
		Find(&userStats)

	// 回收站统计
	var trashCount int64
	var trashSize int64
	model.DB.Model(&model.FileItem{}).Where("is_trash = ? AND is_dir = ?", true, false).Count(&trashCount)
	model.DB.Model(&model.FileItem{}).Where("is_trash = ? AND is_dir = ?", true, false).
		Select("COALESCE(SUM(size), 0)").Scan(&trashSize)

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": gin.H{
			"mime_stats":  mimeStats,
			"user_stats":  userStats,
			"trash_count": trashCount,
			"trash_size":  trashSize,
		},
	})
}

// ResetPassword 重置用户密码（管理员操作）
// POST /api/admin/users/:id/reset-password
func (h *AdminHandler) ResetPassword(c *gin.Context) {
	userID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "参数错误"})
		return
	}

	var req struct {
		NewPassword string `json:"new_password" binding:"required,min=6"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "密码不能少于6位"})
		return
	}

	// 加密密码
	hashedPwd, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "msg": "密码加密失败"})
		return
	}

	result := model.DB.Model(&model.User{}).Where("id = ?", userID).Update("password", string(hashedPwd))
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "msg": "用户不存在"})
		return
	}

	adminID := c.GetUint("user_id")
	adminName, _ := c.Get("username")
	h.auditService.Log(adminID, adminName.(string), service.ActionAdminUpdate, "user",
		"管理员重置用户["+strconv.FormatUint(userID, 10)+"]密码", c.ClientIP())

	c.JSON(http.StatusOK, gin.H{"code": 0, "msg": "密码重置成功"})
}

// 确保 gorm 和 bcrypt 导入被使用
var _ = (*gorm.DB)(nil)
