package handler

import (
	"fmt"
	"net/http"
	"nowen-file/service"
	"strconv"

	"github.com/gin-gonic/gin"
)

// MountHandler 挂载点/数据源管理接口
type MountHandler struct {
	mountService        *service.MountService
	notificationService *service.NotificationService
}

// NewMountHandler 创建 MountHandler
func NewMountHandler() *MountHandler {
	return &MountHandler{
		mountService:        service.NewMountService(),
		notificationService: service.NewNotificationService(),
	}
}

// ==================== 挂载点管理接口 ====================

// CreateMount 创建数据源
// POST /api/mounts
func (h *MountHandler) CreateMount(c *gin.Context) {
	userID := c.GetUint("userID")

	var req struct {
		Name      string `json:"name" binding:"required"`
		Type      string `json:"type" binding:"required"`
		BasePath  string `json:"base_path" binding:"required"`
		AgentID   string `json:"agent_id"`
		AgentAddr string `json:"agent_addr"`
		SmbUser   string `json:"smb_user"`
		SmbPass   string `json:"smb_pass"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "参数错误: " + err.Error()})
		return
	}

	extra := map[string]string{
		"agent_id":   req.AgentID,
		"agent_addr": req.AgentAddr,
		"smb_user":   req.SmbUser,
		"smb_pass":   req.SmbPass,
	}

	mount, err := h.mountService.CreateMount(userID, req.Name, req.Type, req.BasePath, extra)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "msg": "创建成功", "data": mount})
}

// ListMounts 获取数据源列表
// GET /api/mounts
func (h *MountHandler) ListMounts(c *gin.Context) {
	userID := c.GetUint("userID")

	mounts, err := h.mountService.ListMounts(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "msg": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": mounts})
}

// GetMount 获取单个数据源详情
// GET /api/mounts/:id
func (h *MountHandler) GetMount(c *gin.Context) {
	userID := c.GetUint("userID")
	mountID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "无效的数据源ID"})
		return
	}

	mount, err := h.mountService.GetMount(userID, uint(mountID))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "msg": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": mount})
}

// UpdateMount 更新数据源
// PUT /api/mounts/:id
func (h *MountHandler) UpdateMount(c *gin.Context) {
	userID := c.GetUint("userID")
	mountID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "无效的数据源ID"})
		return
	}

	var req struct {
		Name     string `json:"name"`
		BasePath string `json:"base_path"`
		SmbUser  string `json:"smb_user"`
		SmbPass  string `json:"smb_pass"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "参数错误"})
		return
	}

	updates := make(map[string]interface{})
	if req.Name != "" {
		updates["name"] = req.Name
	}
	if req.BasePath != "" {
		updates["base_path"] = req.BasePath
	}
	if req.SmbUser != "" {
		updates["smb_user"] = req.SmbUser
	}
	if req.SmbPass != "" {
		updates["smb_pass"] = req.SmbPass
	}

	if err := h.mountService.UpdateMount(userID, uint(mountID), updates); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "msg": "更新成功"})
}

// DeleteMount 删除数据源
// DELETE /api/mounts/:id
func (h *MountHandler) DeleteMount(c *gin.Context) {
	userID := c.GetUint("userID")
	mountID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "无效的数据源ID"})
		return
	}

	if err := h.mountService.DeleteMount(userID, uint(mountID)); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "msg": "删除成功"})
}

// ScanMount 触发扫描数据源
// POST /api/mounts/:id/scan
func (h *MountHandler) ScanMount(c *gin.Context) {
	userID := c.GetUint("userID")
	mountID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "无效的数据源ID"})
		return
	}

	// 异步执行扫描
	go func() {
		if err := h.mountService.ScanMount(userID, uint(mountID)); err != nil {
			fmt.Printf("扫描数据源 %d 失败: %v\n", mountID, err)
			h.notificationService.CreateNotification(
				userID, service.NotifyScanComplete,
				"数据源扫描失败",
				fmt.Sprintf("数据源扫描失败: %v", err),
				uint(mountID),
			)
		} else {
			h.notificationService.CreateNotification(
				userID, service.NotifyScanComplete,
				"数据源扫描完成",
				"数据源扫描已完成，文件索引已更新",
				uint(mountID),
			)
		}
	}()

	c.JSON(http.StatusOK, gin.H{"code": 0, "msg": "开始扫描，请稍后刷新查看进度"})
}

// GetMountStats 获取数据源统计
// GET /api/mounts/:id/stats
func (h *MountHandler) GetMountStats(c *gin.Context) {
	mountID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "无效的数据源ID"})
		return
	}

	stats, err := h.mountService.GetMountStats(uint(mountID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "msg": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": stats})
}

// ==================== 索引文件浏览接口 ====================

// ListIndexedFiles 浏览索引文件
// GET /api/mounts/:id/files?path=&sort=name&order=asc
func (h *MountHandler) ListIndexedFiles(c *gin.Context) {
	userID := c.GetUint("userID")
	mountID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "无效的数据源ID"})
		return
	}

	parentPath := c.DefaultQuery("path", "")
	sortBy := c.DefaultQuery("sort", "name")
	order := c.DefaultQuery("order", "asc")

	files, err := h.mountService.ListIndexedFiles(userID, uint(mountID), parentPath, sortBy, order)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": err.Error()})
		return
	}

	// 获取面包屑
	breadcrumb := h.mountService.GetIndexedFileBreadcrumb(uint(mountID), parentPath)

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": gin.H{
			"files":      files,
			"breadcrumb": breadcrumb,
		},
	})
}

// SearchIndexedFiles 搜索索引文件
// GET /api/mounts/search?keyword=xxx&mount_id=0
func (h *MountHandler) SearchIndexedFiles(c *gin.Context) {
	userID := c.GetUint("userID")
	keyword := c.Query("keyword")
	if keyword == "" {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "请输入搜索关键词"})
		return
	}

	mountIDStr := c.DefaultQuery("mount_id", "0")
	mountID, _ := strconv.ParseUint(mountIDStr, 10, 32)

	files, err := h.mountService.SearchIndexedFiles(userID, keyword, uint(mountID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "msg": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": files})
}

// DownloadIndexedFile 下载索引文件
// GET /api/mounts/files/:file_id/download
func (h *MountHandler) DownloadIndexedFile(c *gin.Context) {
	userID := c.GetUint("userID")
	fileID, err := strconv.ParseUint(c.Param("file_id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "无效的文件ID"})
		return
	}

	reader, file, mount, err := h.mountService.GetIndexedFileReader(userID, uint(fileID))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": err.Error()})
		return
	}
	defer reader.Close()

	fullPath := h.mountService.GetIndexedFileFullPath(file, mount)
	_ = fullPath

	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", file.Name))
	c.Header("Content-Type", file.MimeType)
	c.Header("Content-Length", strconv.FormatInt(file.Size, 10))
	c.DataFromReader(http.StatusOK, file.Size, file.MimeType, reader, nil)
}

// PreviewIndexedFile 预览索引文件内容
// GET /api/mounts/files/:file_id/preview
func (h *MountHandler) PreviewIndexedFile(c *gin.Context) {
	userID := c.GetUint("userID")
	fileID, err := strconv.ParseUint(c.Param("file_id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "无效的文件ID"})
		return
	}

	reader, file, _, err := h.mountService.GetIndexedFileReader(userID, uint(fileID))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": err.Error()})
		return
	}
	defer reader.Close()

	c.Header("Content-Type", file.MimeType)
	c.Header("Content-Length", strconv.FormatInt(file.Size, 10))
	c.DataFromReader(http.StatusOK, file.Size, file.MimeType, reader, nil)
}
