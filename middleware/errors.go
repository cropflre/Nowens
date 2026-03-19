package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// ==================== 统一错误码体系 ====================

// 错误码定义（前端可根据 code 统一处理）
const (
	CodeSuccess       = 0     // 成功
	CodeBadRequest    = 400   // 参数错误
	CodeUnauthorized  = 401   // 未认证/Token 过期
	CodeForbidden     = 403   // 无权限
	CodeNotFound      = 404   // 资源不存在
	CodeConflict      = 409   // 资源冲突（如重名）
	CodeTooMany       = 429   // 请求频率过高
	CodeInternal      = 500   // 服务器内部错误
	CodeStorageFull   = 10001 // 存储空间已满
	CodeFileTooBig    = 10002 // 文件过大
	CodeUnsupported   = 10003 // 不支持的文件类型
	CodeEncryptFailed = 10004 // 加密/解密失败
)

// ApiError 统一 API 错误结构
type ApiError struct {
	Code    int    `json:"code"`
	Message string `json:"msg"`
}

// Error 实现 error 接口
func (e *ApiError) Error() string {
	return e.Message
}

// NewApiError 创建 API 错误
func NewApiError(code int, msg string) *ApiError {
	return &ApiError{Code: code, Message: msg}
}

// ==================== Recovery 中间件（防 panic 白屏） ====================

// Recovery 全局 panic 恢复中间件，返回统一的 500 错误 JSON
func Recovery() gin.HandlerFunc {
	return gin.CustomRecovery(func(c *gin.Context, recovered interface{}) {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code": CodeInternal,
			"msg":  "服务器内部错误，请稍后重试",
		})
		c.Abort()
	})
}
