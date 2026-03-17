package handler

import (
	"net/http"
	"nowen-file/service"
	"nowen-file/storage"
	"strconv"

	"github.com/gin-gonic/gin"
)

// VersionHandler 文件版本接口
type VersionHandler struct {
	versionService *service.VersionService
}

// NewVersionHandler 创建文件版本接口实例
func NewVersionHandler(store storage.Storage) *VersionHandler {
	return &VersionHandler{
		versionService: service.NewVersionService(store),
	}
}

// ListVersions 获取文件版本列表
// GET /api/files/versions/:file_id
func (h *VersionHandler) ListVersions(c *gin.Context) {
	userID := c.GetUint("user_id")
	fileID, err := strconv.ParseUint(c.Param("file_id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "参数错误"})
		return
	}

	versions, err := h.versionService.ListVersions(uint(fileID), userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": gin.H{
			"versions":      versions,
			"version_count": len(versions),
		},
	})
}

// RestoreVersion 回滚到指定版本
// POST /api/files/versions/restore
func (h *VersionHandler) RestoreVersion(c *gin.Context) {
	userID := c.GetUint("user_id")

	var req struct {
		FileID    uint `json:"file_id" binding:"required"`
		VersionID uint `json:"version_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "参数错误"})
		return
	}

	if err := h.versionService.RestoreVersion(req.FileID, req.VersionID, userID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "msg": "已回滚到该版本"})
}

// DeleteVersion 删除指定版本
// DELETE /api/files/versions/:file_id/:version_id
func (h *VersionHandler) DeleteVersion(c *gin.Context) {
	userID := c.GetUint("user_id")
	fileID, _ := strconv.ParseUint(c.Param("file_id"), 10, 64)
	versionID, _ := strconv.ParseUint(c.Param("version_id"), 10, 64)

	if err := h.versionService.DeleteVersion(uint(fileID), uint(versionID), userID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "msg": "版本已删除"})
}
