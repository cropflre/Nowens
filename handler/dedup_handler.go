package handler

import (
	"net/http"
	"nowen-file/service"
	"nowen-file/storage"
	"strconv"

	"github.com/gin-gonic/gin"
)

// DedupHandler 文件去重接口
type DedupHandler struct {
	dedupService *service.DedupService
}

// NewDedupHandler 创建去重接口实例
func NewDedupHandler(store storage.Storage) *DedupHandler {
	return &DedupHandler{
		dedupService: service.NewDedupService(store),
	}
}

// GetDuplicates 获取重复文件列表
// GET /api/dedup?page=1&page_size=20
func (h *DedupHandler) GetDuplicates(c *gin.Context) {
	userID := c.GetUint("user_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	stats, err := h.dedupService.GetDuplicateFiles(userID, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "msg": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": stats})
}

// CleanDuplicates 清理指定的重复文件
// POST /api/dedup/clean
func (h *DedupHandler) CleanDuplicates(c *gin.Context) {
	userID := c.GetUint("user_id")

	var req struct {
		Hashes []string `json:"hashes"` // 要清理的哈希列表（空则清理全部）
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "参数错误"})
		return
	}

	var deleted int
	var freed int64
	var err error

	if len(req.Hashes) == 0 {
		// 一键清理全部
		deleted, freed, err = h.dedupService.CleanAllDuplicates(userID)
	} else {
		deleted, freed, err = h.dedupService.CleanDuplicates(userID, req.Hashes)
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "msg": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"msg":  "清理完成",
		"data": gin.H{
			"deleted_count": deleted,
			"freed_size":    freed,
		},
	})
}
