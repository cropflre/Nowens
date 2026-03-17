package handler

import (
	"fmt"
	"io"
	"net/http"
	"nowen-file/service"
	"strconv"

	"github.com/gin-gonic/gin"
)

// ShareHandler 分享接口
type ShareHandler struct {
	shareService        *service.ShareService
	fileService         *service.FileService
	notificationService *service.NotificationService
}

// NewShareHandler 创建分享接口实例（兼容旧接口）
func NewShareHandler(uploadDir string) *ShareHandler {
	return &ShareHandler{
		shareService: service.NewShareService(),
		fileService:  service.NewFileService(uploadDir),
	}
}

// NewShareHandlerWithFileService 使用已有的 FileService 创建分享接口
func NewShareHandlerWithFileService(fs *service.FileService) *ShareHandler {
	return &ShareHandler{
		shareService:        service.NewShareService(),
		fileService:         fs,
		notificationService: service.NewNotificationService(),
	}
}

// CreateShare 创建分享链接
// POST /api/share
func (h *ShareHandler) CreateShare(c *gin.Context) {
	userID := c.GetUint("user_id")

	var req struct {
		FileID     uint   `json:"file_id" binding:"required"`
		Password   string `json:"password"`
		ExpireDays int    `json:"expire_days"` // 0 表示永不过期
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "参数错误"})
		return
	}

	share, err := h.shareService.CreateShare(userID, req.FileID, req.Password, req.ExpireDays)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"msg":  "创建分享成功",
		"data": share,
	})
}

// GetShare 获取分享内容（公开接口，不需要登录）
// GET /api/share/:code
func (h *ShareHandler) GetShare(c *gin.Context) {
	code := c.Param("code")

	share, file, err := h.shareService.GetShare(code)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "msg": err.Error()})
		return
	}

	// 如果有密码保护，只返回基础信息
	if share.Password != "" {
		c.JSON(http.StatusOK, gin.H{
			"code": 0,
			"data": gin.H{
				"need_password": true,
				"file_name":     file.Name,
				"is_dir":        file.IsDir,
				"size":          file.Size,
				"mime_type":     file.MimeType,
			},
		})
		return
	}

	// 发送通知：分享被查看
	go h.notificationService.CreateNotification(
		share.UserID,
		service.NotifyShareViewed,
		"分享被查看",
		fmt.Sprintf("你分享的文件「%s」被人查看了", file.Name),
		share.ID,
	)

	previewType := service.GetPreviewType(file.MimeType)
	previewable := service.IsPreviewable(file.MimeType)

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": gin.H{
			"need_password": false,
			"file":          file,
			"share":         share,
			"previewable":   previewable,
			"preview_type":  previewType,
		},
	})
}

// VerifySharePassword 验证分享密码
// POST /api/share/:code/verify
func (h *ShareHandler) VerifySharePassword(c *gin.Context) {
	code := c.Param("code")

	var req struct {
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "请输入提取密码"})
		return
	}

	if !h.shareService.VerifySharePassword(code, req.Password) {
		c.JSON(http.StatusForbidden, gin.H{"code": 403, "msg": "密码错误"})
		return
	}

	// 密码正确，返回文件信息
	share, file, err := h.shareService.GetShare(code)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "msg": err.Error()})
		return
	}

	previewType := service.GetPreviewType(file.MimeType)
	previewable := service.IsPreviewable(file.MimeType)

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": gin.H{
			"file":         file,
			"share":        share,
			"previewable":  previewable,
			"preview_type": previewType,
		},
	})
}

// DownloadSharedFile 下载分享的文件（公开接口）
// GET /api/share/:code/download
func (h *ShareHandler) DownloadSharedFile(c *gin.Context) {
	code := c.Param("code")

	share, file, err := h.shareService.GetShare(code)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "msg": err.Error()})
		return
	}

	// 如果有密码保护，需要验证
	if share.Password != "" {
		pwd := c.Query("password")
		if !h.shareService.VerifySharePassword(code, pwd) {
			c.JSON(http.StatusForbidden, gin.H{"code": 403, "msg": "需要提取密码"})
			return
		}
	}

	if file.IsDir {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "暂不支持下载文件夹"})
		return
	}

	// 更新下载次数
	h.shareService.IncrementDownloadCount(share.ID)

	// 尝试本地路径
	filePath := h.fileService.GetFilePath(file)
	if filePath != "" && fileExists(filePath) {
		c.Header("Content-Disposition", "attachment; filename=\""+file.Name+"\"")
		c.File(filePath)
		return
	}

	// 远程存储
	reader, err := h.fileService.GetFileReader(file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "msg": "读取文件失败"})
		return
	}
	defer reader.Close()

	c.Header("Content-Disposition", "attachment; filename=\""+file.Name+"\"")
	c.Header("Content-Type", file.MimeType)
	c.Header("Content-Length", strconv.FormatInt(file.Size, 10))
	io.Copy(c.Writer, reader)
}

// PreviewSharedFile 预览分享的文件（公开接口）
// GET /api/share/:code/preview
func (h *ShareHandler) PreviewSharedFile(c *gin.Context) {
	code := c.Param("code")

	share, file, err := h.shareService.GetShare(code)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "msg": err.Error()})
		return
	}

	// 密码验证
	if share.Password != "" {
		pwd := c.Query("password")
		if !h.shareService.VerifySharePassword(code, pwd) {
			c.JSON(http.StatusForbidden, gin.H{"code": 403, "msg": "需要提取密码"})
			return
		}
	}

	if !service.IsPreviewable(file.MimeType) {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "该文件类型不支持预览"})
		return
	}

	// 尝试本地路径
	filePath := h.fileService.GetFilePath(file)
	if filePath != "" && fileExists(filePath) {
		c.Header("Content-Type", file.MimeType)
		c.Header("Content-Disposition", "inline; filename=\""+file.Name+"\"")
		c.Header("Cache-Control", "private, max-age=3600")
		c.File(filePath)
		return
	}

	// 远程存储
	reader, err := h.fileService.GetFileReader(file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "msg": "读取文件失败"})
		return
	}
	defer reader.Close()

	c.Header("Content-Type", file.MimeType)
	c.Header("Content-Disposition", "inline; filename=\""+file.Name+"\"")
	io.Copy(c.Writer, reader)
}

// DeleteShare 删除分享
// DELETE /api/share/:id
func (h *ShareHandler) DeleteShare(c *gin.Context) {
	userID := c.GetUint("user_id")
	shareID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "参数错误"})
		return
	}

	if err := h.shareService.DeleteShare(userID, uint(shareID)); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "msg": "已取消分享"})
}

// ListShares 我的分享列表
// GET /api/share/list
func (h *ShareHandler) ListShares(c *gin.Context) {
	userID := c.GetUint("user_id")

	shares, err := h.shareService.ListUserShares(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "msg": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": shares})
}
