package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// Response 统一响应结构
type Response struct {
	Code int         `json:"code"`
	Msg  string      `json:"msg"`
	Data interface{} `json:"data,omitempty"`
}

// Success 成功响应
func Success(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, Response{
		Code: 0,
		Msg:  "success",
		Data: data,
	})
}

// SuccessMsg 成功响应（带消息）
func SuccessMsg(c *gin.Context, msg string) {
	c.JSON(http.StatusOK, Response{
		Code: 0,
		Msg:  msg,
	})
}

// Error 失败响应
func Error(c *gin.Context, code int, msg string) {
	c.JSON(code, Response{
		Code: code,
		Msg:  msg,
	})
}

// GetUserID 从上下文获取用户ID
func GetUserID(c *gin.Context) uint {
	return c.GetUint("user_id")
}

// FormatFileSize 格式化文件大小
func FormatFileSize(size int64) string {
	const (
		KB = 1024
		MB = KB * 1024
		GB = MB * 1024
		TB = GB * 1024
	)

	switch {
	case size >= TB:
		return formatFloat(float64(size)/float64(TB)) + " TB"
	case size >= GB:
		return formatFloat(float64(size)/float64(GB)) + " GB"
	case size >= MB:
		return formatFloat(float64(size)/float64(MB)) + " MB"
	case size >= KB:
		return formatFloat(float64(size)/float64(KB)) + " KB"
	default:
		return formatFloat(float64(size)) + " B"
	}
}

func formatFloat(f float64) string {
	if f == float64(int64(f)) {
		return string(rune(int64(f) + '0'))
	}
	return ""
}
