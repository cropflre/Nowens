package handler

import (
	"net/http"
	"nowen-file/service"
	"strconv"

	"github.com/gin-gonic/gin"
)

// ActivityHandler 活动流接口
type ActivityHandler struct {
	activityService *service.ActivityService
}

// NewActivityHandler 创建活动流接口实例
func NewActivityHandler() *ActivityHandler {
	return &ActivityHandler{
		activityService: service.NewActivityService(),
	}
}

// ListActivities 获取当前用户的活动流
// GET /api/activities?page=1&page_size=20
func (h *ActivityHandler) ListActivities(c *gin.Context) {
	userID := c.GetUint("user_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 50 {
		pageSize = 20
	}

	activities, total, err := h.activityService.ListActivities(userID, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "msg": "获取活动流失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": gin.H{
			"list":  activities,
			"total": total,
			"page":  page,
		},
	})
}
