package handler

import (
	"net/http"
	"nowen-file/service"
	"nowen-file/storage"
	"strconv"

	"github.com/gin-gonic/gin"
)

// ChunkUploadHandler 分片上传接口
type ChunkUploadHandler struct {
	chunkService *service.ChunkUploadService
}

// NewChunkUploadHandler 创建分片上传接口实例
func NewChunkUploadHandler(store storage.Storage, uploadDir string, thumbDir string) *ChunkUploadHandler {
	return &ChunkUploadHandler{
		chunkService: service.NewChunkUploadService(store, uploadDir, thumbDir),
	}
}

// GetChunkService 获取分片上传服务
func (h *ChunkUploadHandler) GetChunkService() *service.ChunkUploadService {
	return h.chunkService
}

// InitUpload 初始化分片上传
// POST /api/files/chunk/init
func (h *ChunkUploadHandler) InitUpload(c *gin.Context) {
	userID := c.GetUint("user_id")

	var req struct {
		ParentID  uint   `json:"parent_id"`
		FileName  string `json:"file_name" binding:"required"`
		FileSize  int64  `json:"file_size" binding:"required"`
		ChunkSize int64  `json:"chunk_size" binding:"required"`
		MimeType  string `json:"mime_type"`
		Hash      string `json:"hash"` // 可选，用于秒传
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "参数错误"})
		return
	}

	upload, err := h.chunkService.InitUpload(userID, req.ParentID, req.FileName, req.FileSize, req.ChunkSize, req.MimeType, req.Hash)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": err.Error()})
		return
	}

	// 秒传场景
	if upload.Status == "done" {
		c.JSON(http.StatusOK, gin.H{"code": 0, "msg": "秒传成功", "data": gin.H{
			"upload_id": upload.UploadID,
			"instant":   true,
		}})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": gin.H{
		"upload_id":    upload.UploadID,
		"total_chunks": upload.TotalChunks,
		"chunk_size":   upload.ChunkSize,
		"instant":      false,
	}})
}

// UploadChunk 上传单个分片
// POST /api/files/chunk/upload
func (h *ChunkUploadHandler) UploadChunk(c *gin.Context) {
	uploadID := c.PostForm("upload_id")
	chunkIndexStr := c.PostForm("chunk_index")

	if uploadID == "" || chunkIndexStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "参数错误"})
		return
	}

	chunkIndex, err := strconv.Atoi(chunkIndexStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "分片索引无效"})
		return
	}

	file, err := c.FormFile("chunk")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "请提供分片数据"})
		return
	}

	src, err := file.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "msg": "读取分片数据失败"})
		return
	}
	defer src.Close()

	if err := h.chunkService.UploadChunk(uploadID, chunkIndex, src); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "msg": "分片上传成功"})
}

// MergeChunks 合并分片
// POST /api/files/chunk/merge
func (h *ChunkUploadHandler) MergeChunks(c *gin.Context) {
	var req struct {
		UploadID string `json:"upload_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "参数错误"})
		return
	}

	fileItem, err := h.chunkService.MergeChunks(req.UploadID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "msg": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "msg": "上传完成", "data": fileItem})
}

// GetUploadStatus 查询上传进度
// GET /api/files/chunk/status?upload_id=xxx
func (h *ChunkUploadHandler) GetUploadStatus(c *gin.Context) {
	uploadID := c.Query("upload_id")
	if uploadID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "缺少 upload_id"})
		return
	}

	upload, missingChunks, err := h.chunkService.GetUploadStatus(uploadID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "msg": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": gin.H{
		"upload":         upload,
		"missing_chunks": missingChunks,
		"progress":       float64(upload.TotalChunks-len(missingChunks)) / float64(upload.TotalChunks) * 100,
	}})
}
