package handler

import (
	"net/http"
	"nowen-file/service"
	"strconv"

	"github.com/gin-gonic/gin"
)

// WebhookHandler Webhook 通知接口
type WebhookHandler struct {
	webhookService *service.WebhookService
}

// NewWebhookHandler 创建 Webhook 接口实例
func NewWebhookHandler() *WebhookHandler {
	return &WebhookHandler{
		webhookService: service.NewWebhookService(),
	}
}

// GetWebhookService 获取 Webhook 服务（供其他 handler 使用）
func (h *WebhookHandler) GetWebhookService() *service.WebhookService {
	return h.webhookService
}

// CreateWebhook 创建 Webhook
// POST /api/webhooks
func (h *WebhookHandler) CreateWebhook(c *gin.Context) {
	userID := c.GetUint("user_id")

	var req struct {
		Name     string `json:"name" binding:"required"`
		URL      string `json:"url" binding:"required"`
		Events   string `json:"events" binding:"required"`
		Platform string `json:"platform"`
		Secret   string `json:"secret"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "参数错误：名称、URL 和事件类型不能为空"})
		return
	}

	webhook, err := h.webhookService.CreateWebhook(userID, req.Name, req.URL, req.Events, req.Platform, req.Secret)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "msg": "创建成功", "data": webhook})
}

// ListWebhooks 获取 Webhook 列表
// GET /api/webhooks
func (h *WebhookHandler) ListWebhooks(c *gin.Context) {
	userID := c.GetUint("user_id")

	webhooks, err := h.webhookService.ListWebhooks(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "msg": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": webhooks})
}

// UpdateWebhook 更新 Webhook
// PUT /api/webhooks/:id
func (h *WebhookHandler) UpdateWebhook(c *gin.Context) {
	userID := c.GetUint("user_id")
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "参数错误"})
		return
	}

	var req struct {
		Name     *string `json:"name"`
		URL      *string `json:"url"`
		Events   *string `json:"events"`
		Platform *string `json:"platform"`
		Secret   *string `json:"secret"`
		Enabled  *bool   `json:"enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "参数错误"})
		return
	}

	updates := map[string]interface{}{}
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.URL != nil {
		updates["url"] = *req.URL
	}
	if req.Events != nil {
		updates["events"] = *req.Events
	}
	if req.Platform != nil {
		updates["platform"] = *req.Platform
	}
	if req.Secret != nil {
		updates["secret"] = *req.Secret
	}
	if req.Enabled != nil {
		updates["enabled"] = *req.Enabled
	}

	if err := h.webhookService.UpdateWebhook(userID, uint(id), updates); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "msg": "更新成功"})
}

// DeleteWebhook 删除 Webhook
// DELETE /api/webhooks/:id
func (h *WebhookHandler) DeleteWebhook(c *gin.Context) {
	userID := c.GetUint("user_id")
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "参数错误"})
		return
	}

	if err := h.webhookService.DeleteWebhook(userID, uint(id)); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "msg": "删除成功"})
}

// TestWebhook 测试 Webhook 连通性
// POST /api/webhooks/:id/test
func (h *WebhookHandler) TestWebhook(c *gin.Context) {
	userID := c.GetUint("user_id")
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "参数错误"})
		return
	}

	if err := h.webhookService.TestWebhook(userID, uint(id)); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "msg": "测试消息已发送"})
}
