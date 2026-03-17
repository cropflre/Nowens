package handler

import (
	"net/http"
	"nowen-file/service"

	"github.com/gin-gonic/gin"
)

// DashboardHandler 仪表盘接口
type DashboardHandler struct {
	fileService *service.FileService
}

// NewDashboardHandler 创建仪表盘接口
func NewDashboardHandler(fs *service.FileService) *DashboardHandler {
	return &DashboardHandler{
		fileService: fs,
	}
}

// GetDashboard 获取个人仪表盘数据
// GET /api/dashboard
func (h *DashboardHandler) GetDashboard(c *gin.Context) {
	userID := GetUserID(c)

	stats, err := h.fileService.GetDashboardStats(userID)
	if err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	Success(c, stats)
}
