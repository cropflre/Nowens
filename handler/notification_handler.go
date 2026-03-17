package handler

import (
	"net/http"
	"nowen-file/service"
	"strconv"

	"github.com/gin-gonic/gin"
)

// NotificationHandler 通知接口
type NotificationHandler struct {
	notificationService *service.NotificationService
}

// NewNotificationHandler 创建通知接口
func NewNotificationHandler() *NotificationHandler {
	return &NotificationHandler{
		notificationService: service.NewNotificationService(),
	}
}

// GetNotificationService 获取通知服务（供其他handler使用）
func (h *NotificationHandler) GetNotificationService() *service.NotificationService {
	return h.notificationService
}

// ListNotifications 获取通知列表
// GET /api/notifications?page=1&page_size=20&unread=false
func (h *NotificationHandler) ListNotifications(c *gin.Context) {
	userID := GetUserID(c)

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	onlyUnread := c.Query("unread") == "true"

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 50 {
		pageSize = 20
	}

	notifications, total, err := h.notificationService.ListNotifications(userID, page, pageSize, onlyUnread)
	if err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	Success(c, gin.H{
		"list":  notifications,
		"total": total,
		"page":  page,
	})
}

// GetUnreadCount 获取未读通知数量
// GET /api/notifications/unread-count
func (h *NotificationHandler) GetUnreadCount(c *gin.Context) {
	userID := GetUserID(c)
	count := h.notificationService.GetUnreadCount(userID)
	Success(c, gin.H{"count": count})
}

// MarkAsRead 标记通知为已读
// PUT /api/notifications/:id/read
func (h *NotificationHandler) MarkAsRead(c *gin.Context) {
	userID := GetUserID(c)
	notificationID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		Error(c, http.StatusBadRequest, "参数错误")
		return
	}

	if err := h.notificationService.MarkAsRead(userID, uint(notificationID)); err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}

	SuccessMsg(c, "已标记为已读")
}

// MarkAllAsRead 标记所有通知为已读
// PUT /api/notifications/read-all
func (h *NotificationHandler) MarkAllAsRead(c *gin.Context) {
	userID := GetUserID(c)

	if err := h.notificationService.MarkAllAsRead(userID); err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	SuccessMsg(c, "已全部标记为已读")
}

// DeleteNotification 删除通知
// DELETE /api/notifications/:id
func (h *NotificationHandler) DeleteNotification(c *gin.Context) {
	userID := GetUserID(c)
	notificationID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		Error(c, http.StatusBadRequest, "参数错误")
		return
	}

	if err := h.notificationService.DeleteNotification(userID, uint(notificationID)); err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}

	SuccessMsg(c, "删除成功")
}

// ClearAll 清空所有通知
// DELETE /api/notifications/clear
func (h *NotificationHandler) ClearAll(c *gin.Context) {
	userID := GetUserID(c)

	if err := h.notificationService.ClearAllNotifications(userID); err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	SuccessMsg(c, "已清空所有通知")
}
