package handler

import (
	"net/http"
	"nowen-file/middleware"
	"nowen-file/service"

	"github.com/gin-gonic/gin"
)

// MFAHandler 多因素认证接口
type MFAHandler struct {
	mfaService *service.MFAService
	auth       *middleware.AuthMiddleware
}

// NewMFAHandler 创建 MFA 接口实例
func NewMFAHandler(auth *middleware.AuthMiddleware) *MFAHandler {
	return &MFAHandler{
		mfaService: service.NewMFAService(),
		auth:       auth,
	}
}

// GetMFAService 获取 MFA 服务
func (h *MFAHandler) GetMFAService() *service.MFAService {
	return h.mfaService
}

// GetStatus 获取当前用户的 MFA 状态
// GET /api/mfa/status
func (h *MFAHandler) GetStatus(c *gin.Context) {
	userID := c.GetUint("user_id")
	status := h.mfaService.GetMFAStatus(userID)
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": status})
}

// Setup 设置 MFA（生成密钥和二维码）
// POST /api/mfa/setup
func (h *MFAHandler) Setup(c *gin.Context) {
	userID := c.GetUint("user_id")
	username, _ := c.Get("username")

	result, err := h.mfaService.SetupMFA(userID, username.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": result})
}

// Verify 验证并启用 MFA
// POST /api/mfa/verify
func (h *MFAHandler) Verify(c *gin.Context) {
	userID := c.GetUint("user_id")

	var req struct {
		Code string `json:"code" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "请输入验证码"})
		return
	}

	if err := h.mfaService.VerifyAndEnableMFA(userID, req.Code); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "msg": "MFA 已启用"})
}

// Disable 禁用 MFA
// POST /api/mfa/disable
func (h *MFAHandler) Disable(c *gin.Context) {
	userID := c.GetUint("user_id")

	var req struct {
		Code string `json:"code" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "请输入验证码"})
		return
	}

	if err := h.mfaService.DisableMFA(userID, req.Code); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "msg": "MFA 已禁用"})
}
