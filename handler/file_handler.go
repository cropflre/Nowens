package handler

import (
	"fmt"
	"io"
	"net/http"
	"nowen-file/service"
	"nowen-file/storage"
	"os"
	"strconv"

	"github.com/gin-gonic/gin"
)

// FileHandler 文件接口
type FileHandler struct {
	fileService *service.FileService
}

// NewFileHandler 创建文件接口实例（兼容旧接口）
func NewFileHandler(uploadDir string) *FileHandler {
	return &FileHandler{
		fileService: service.NewFileService(uploadDir),
	}
}

// NewFileHandlerWithStorage 创建带存储后端的文件接口实例
func NewFileHandlerWithStorage(store storage.Storage, thumbDir string, uploadDir string) *FileHandler {
	return &FileHandler{
		fileService: service.NewFileServiceWithStorage(store, thumbDir, uploadDir),
	}
}

// GetFileService 获取文件服务（供其他 handler 使用）
func (h *FileHandler) GetFileService() *service.FileService {
	return h.fileService
}

// CreateFolder 创建文件夹
// POST /api/files/folder
func (h *FileHandler) CreateFolder(c *gin.Context) {
	userID := c.GetUint("user_id")

	var req struct {
		ParentID uint   `json:"parent_id"`
		Name     string `json:"name" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "文件夹名称不能为空"})
		return
	}

	folder, err := h.fileService.CreateFolder(userID, req.ParentID, req.Name)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "msg": "创建成功", "data": folder})
}

// Upload 上传文件
// POST /api/files/upload
func (h *FileHandler) Upload(c *gin.Context) {
	userID := c.GetUint("user_id")
	parentIDStr := c.PostForm("parent_id")
	parentID := uint(0)
	if parentIDStr != "" {
		if id, err := strconv.ParseUint(parentIDStr, 10, 64); err == nil {
			parentID = uint(id)
		}
	}

	// 获取上传文件
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "请选择要上传的文件"})
		return
	}

	fileItem, err := h.fileService.UploadFile(userID, parentID, file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "msg": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "msg": "上传成功", "data": fileItem})
}

// ListFiles 获取文件列表
// GET /api/files/list?parent_id=0&sort=updated_at&order=desc
func (h *FileHandler) ListFiles(c *gin.Context) {
	userID := c.GetUint("user_id")
	parentID := uint(0)
	if id, err := strconv.ParseUint(c.Query("parent_id"), 10, 64); err == nil {
		parentID = uint(id)
	}
	sortBy := c.DefaultQuery("sort", "updated_at")
	order := c.DefaultQuery("order", "desc")

	files, err := h.fileService.ListFiles(userID, parentID, sortBy, order)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "msg": err.Error()})
		return
	}

	// 获取面包屑
	breadcrumb, _ := h.fileService.GetBreadcrumb(userID, parentID)

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": gin.H{
			"files":      files,
			"breadcrumb": breadcrumb,
		},
	})
}

// Download 下载文件
// GET /api/files/download/:uuid
func (h *FileHandler) Download(c *gin.Context) {
	fileUUID := c.Param("uuid")
	userID := c.GetUint("user_id")

	file, err := h.fileService.GetFileByUUID(fileUUID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "msg": "文件不存在"})
		return
	}

	// 验证文件所有权
	if file.UserID != userID {
		c.JSON(http.StatusForbidden, gin.H{"code": 403, "msg": "无权访问该文件"})
		return
	}

	if file.IsDir {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "不能下载文件夹"})
		return
	}

	// 尝试使用本地路径（高性能）或 Reader（兼容 S3）
	filePath := h.fileService.GetFilePath(file)
	if filePath != "" && fileExists(filePath) {
		c.Header("Content-Disposition", "attachment; filename=\""+file.Name+"\"")
		c.File(filePath)
		return
	}

	// S3 等远程存储：使用 Reader 流式传输
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

// Preview 预览文件（图片/文本/PDF/视频/音频等）
// GET /api/files/preview/:uuid
func (h *FileHandler) Preview(c *gin.Context) {
	fileUUID := c.Param("uuid")
	userID := c.GetUint("user_id")

	file, err := h.fileService.GetFileByUUID(fileUUID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "msg": "文件不存在"})
		return
	}

	if file.UserID != userID {
		c.JSON(http.StatusForbidden, gin.H{"code": 403, "msg": "无权访问该文件"})
		return
	}

	// 设置缓存头（预览内容可以缓存）
	c.Header("Cache-Control", "private, max-age=3600")

	// 尝试本地路径
	filePath := h.fileService.GetFilePath(file)
	if filePath != "" && fileExists(filePath) {
		c.Header("Content-Type", file.MimeType)
		c.Header("Content-Disposition", "inline; filename=\""+file.Name+"\"")
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

// PreviewInfo 获取文件预览信息（不传输文件内容）
// GET /api/files/preview-info/:uuid
func (h *FileHandler) PreviewInfo(c *gin.Context) {
	fileUUID := c.Param("uuid")
	userID := c.GetUint("user_id")

	file, err := h.fileService.GetFileByUUID(fileUUID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "msg": "文件不存在"})
		return
	}

	if file.UserID != userID {
		c.JSON(http.StatusForbidden, gin.H{"code": 403, "msg": "无权访问该文件"})
		return
	}

	previewType := service.GetPreviewType(file.MimeType)
	previewable := service.IsPreviewable(file.MimeType)

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": gin.H{
			"file":          file,
			"previewable":   previewable,
			"preview_type":  previewType,
			"has_thumbnail": h.fileService.HasThumbnail(file.UUID),
		},
	})
}

// Thumbnail 获取文件缩略图
// GET /api/files/thumb/:uuid
func (h *FileHandler) Thumbnail(c *gin.Context) {
	fileUUID := c.Param("uuid")

	if !h.fileService.HasThumbnail(fileUUID) {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "msg": "缩略图不存在"})
		return
	}

	thumbPath := h.fileService.GetThumbnailPath(fileUUID)
	c.Header("Cache-Control", "public, max-age=86400") // 缓存 1 天
	c.Header("Content-Type", "image/jpeg")
	c.File(thumbPath)
}

// Rename 重命名文件/文件夹
// PUT /api/files/rename
func (h *FileHandler) Rename(c *gin.Context) {
	userID := c.GetUint("user_id")

	var req struct {
		FileID  uint   `json:"file_id" binding:"required"`
		NewName string `json:"new_name" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "参数错误"})
		return
	}

	if err := h.fileService.RenameFile(userID, req.FileID, req.NewName); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "msg": "重命名成功"})
}

// Move 移动文件/文件夹
// PUT /api/files/move
func (h *FileHandler) Move(c *gin.Context) {
	userID := c.GetUint("user_id")

	var req struct {
		FileID   uint `json:"file_id" binding:"required"`
		TargetID uint `json:"target_id"` // 0 表示根目录
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "参数错误"})
		return
	}

	if err := h.fileService.MoveFile(userID, req.FileID, req.TargetID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "msg": "移动成功"})
}

// Trash 移入回收站
// POST /api/files/trash
func (h *FileHandler) Trash(c *gin.Context) {
	userID := c.GetUint("user_id")

	var req struct {
		FileID uint `json:"file_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "参数错误"})
		return
	}

	if err := h.fileService.TrashFile(userID, req.FileID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "msg": "已移入回收站"})
}

// Restore 从回收站恢复
// POST /api/files/restore
func (h *FileHandler) Restore(c *gin.Context) {
	userID := c.GetUint("user_id")

	var req struct {
		FileID uint `json:"file_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "参数错误"})
		return
	}

	if err := h.fileService.RestoreFile(userID, req.FileID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "msg": "恢复成功"})
}

// ListTrash 回收站列表
// GET /api/files/trash
func (h *FileHandler) ListTrash(c *gin.Context) {
	userID := c.GetUint("user_id")

	files, err := h.fileService.ListTrash(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "msg": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": files})
}

// Delete 永久删除
// DELETE /api/files/:id
func (h *FileHandler) Delete(c *gin.Context) {
	userID := c.GetUint("user_id")
	fileID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "参数错误"})
		return
	}

	if err := h.fileService.DeletePermanently(userID, uint(fileID)); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "msg": "已永久删除"})
}

// Search 搜索文件
// GET /api/files/search?keyword=xxx
func (h *FileHandler) Search(c *gin.Context) {
	userID := c.GetUint("user_id")
	keyword := c.Query("keyword")
	if keyword == "" {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "请输入搜索关键词"})
		return
	}

	files, err := h.fileService.SearchFiles(userID, keyword)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "msg": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": files})
}

// SearchByType 按类型搜索文件
// GET /api/files/type/:type (image/video/audio/document)
func (h *FileHandler) SearchByType(c *gin.Context) {
	userID := c.GetUint("user_id")
	fileType := c.Param("type")

	files, err := h.fileService.SearchFilesByType(userID, fileType)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": files})
}

// StorageStats 存储统计
// GET /api/files/storage
func (h *FileHandler) StorageStats(c *gin.Context) {
	userID := c.GetUint("user_id")

	stats, err := h.fileService.GetStorageStats(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "msg": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": stats})
}

// ==================== 批量操作 ====================

// BatchTrash 批量移入回收站
// POST /api/files/batch/trash
func (h *FileHandler) BatchTrash(c *gin.Context) {
	userID := c.GetUint("user_id")

	var req struct {
		FileIDs []uint `json:"file_ids" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "参数错误"})
		return
	}

	count, err := h.fileService.BatchTrash(userID, req.FileIDs)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "msg": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "msg": fmt.Sprintf("已将 %d 个文件移入回收站", count)})
}

// BatchMove 批量移动文件
// POST /api/files/batch/move
func (h *FileHandler) BatchMove(c *gin.Context) {
	userID := c.GetUint("user_id")

	var req struct {
		FileIDs  []uint `json:"file_ids" binding:"required"`
		TargetID uint   `json:"target_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "参数错误"})
		return
	}

	count, err := h.fileService.BatchMove(userID, req.FileIDs, req.TargetID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "msg": fmt.Sprintf("已移动 %d 个文件", count)})
}

// BatchDelete 批量永久删除
// POST /api/files/batch/delete
func (h *FileHandler) BatchDelete(c *gin.Context) {
	userID := c.GetUint("user_id")

	var req struct {
		FileIDs []uint `json:"file_ids" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "参数错误"})
		return
	}

	count, err := h.fileService.BatchDeletePermanently(userID, req.FileIDs)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "msg": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "msg": fmt.Sprintf("已永久删除 %d 个文件", count)})
}

// fileExists 检查文件是否存在
func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}
