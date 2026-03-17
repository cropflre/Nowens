package handler

import (
	"net/http"
	"nowen-file/middleware"
	"nowen-file/service"

	"github.com/gin-gonic/gin"
)

// UserHandler 用户接口
type UserHandler struct {
	userService *service.UserService
	auth        *middleware.AuthMiddleware
}

// NewUserHandler 创建用户接口实例
func NewUserHandler(auth *middleware.AuthMiddleware) *UserHandler {
	return &UserHandler{
		userService: service.NewUserService(),
		auth:        auth,
	}
}

// RegisterRequest 注册请求体
type RegisterRequest struct {
	Username string `json:"username" binding:"required,min=3,max=32"`
	Password string `json:"password" binding:"required,min=6,max=64"`
	Nickname string `json:"nickname"`
}

// LoginRequest 登录请求体
type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// Register 用户注册
// POST /api/auth/register
func (h *UserHandler) Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code": 400,
			"msg":  "参数错误：用户名3-32位，密码6-64位",
		})
		return
	}

	user, err := h.userService.Register(req.Username, req.Password, req.Nickname)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code": 400,
			"msg":  err.Error(),
		})
		return
	}

	// 注册成功自动生成 Token
	token, _ := h.auth.GenerateToken(user.ID, user.Username, user.Role)

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"msg":  "注册成功",
		"data": gin.H{
			"user":  user,
			"token": token,
		},
	})
}

// Login 用户登录
// POST /api/auth/login
func (h *UserHandler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code": 400,
			"msg":  "参数错误",
		})
		return
	}

	user, err := h.userService.Login(req.Username, req.Password)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"code": 401,
			"msg":  err.Error(),
		})
		return
	}

	token, err := h.auth.GenerateToken(user.ID, user.Username, user.Role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code": 500,
			"msg":  "生成Token失败",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"msg":  "登录成功",
		"data": gin.H{
			"user":  user,
			"token": token,
		},
	})
}

// GetProfile 获取当前用户信息
// GET /api/user/profile
func (h *UserHandler) GetProfile(c *gin.Context) {
	userID := c.GetUint("user_id")
	user, err := h.userService.GetUserByID(userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"code": 404,
			"msg":  err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": user,
	})
}

// UpdateProfile 更新用户资料
// PUT /api/user/profile
func (h *UserHandler) UpdateProfile(c *gin.Context) {
	userID := c.GetUint("user_id")

	var req struct {
		Nickname string `json:"nickname"`
		Avatar   string `json:"avatar"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code": 400,
			"msg":  "参数错误",
		})
		return
	}

	if err := h.userService.UpdateProfile(userID, req.Nickname, req.Avatar); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code": 500,
			"msg":  "更新失败",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"msg":  "更新成功",
	})
}
