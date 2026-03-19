package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/time/rate"
)

// ipLimiter 记录每个 IP 的限速器
type ipLimiter struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

// RateLimiter IP 级别速率限制器
type RateLimiter struct {
	mu       sync.RWMutex
	limiters map[string]*ipLimiter
	rate     rate.Limit // 每秒允许的请求数
	burst    int        // 突发允许的最大请求数
}

// NewRateLimiter 创建速率限制器
// r: 每秒允许的请求数, b: 突发上限
func NewRateLimiter(r rate.Limit, b int) *RateLimiter {
	rl := &RateLimiter{
		limiters: make(map[string]*ipLimiter),
		rate:     r,
		burst:    b,
	}

	// 启动定时清理过期的 IP 记录（每 5 分钟清理一次）
	go rl.cleanup()
	return rl
}

// getLimiter 获取指定 IP 的限速器（不存在则创建）
func (rl *RateLimiter) getLimiter(ip string) *rate.Limiter {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	if l, exists := rl.limiters[ip]; exists {
		l.lastSeen = time.Now()
		return l.limiter
	}

	limiter := rate.NewLimiter(rl.rate, rl.burst)
	rl.limiters[ip] = &ipLimiter{
		limiter:  limiter,
		lastSeen: time.Now(),
	}
	return limiter
}

// cleanup 定期清理过期的 IP 限速器记录
func (rl *RateLimiter) cleanup() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		rl.mu.Lock()
		for ip, l := range rl.limiters {
			// 超过 10 分钟未活跃的 IP 记录删除
			if time.Since(l.lastSeen) > 10*time.Minute {
				delete(rl.limiters, ip)
			}
		}
		rl.mu.Unlock()
	}
}

// Middleware 返回 Gin 中间件函数
func (rl *RateLimiter) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()
		limiter := rl.getLimiter(ip)

		if !limiter.Allow() {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"code": 429,
				"msg":  "请求过于频繁，请稍后再试",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// LoginRateLimiter 登录专用限速器（更严格：每分钟 5 次）
func LoginRateLimiter() gin.HandlerFunc {
	rl := NewRateLimiter(rate.Every(12*time.Second), 5) // 每 12 秒允许 1 次，突发上限 5 次
	return rl.Middleware()
}

// APIRateLimiter 通用 API 限速器（每秒 10 次，突发 20 次）
func APIRateLimiter() gin.HandlerFunc {
	rl := NewRateLimiter(10, 20)
	return rl.Middleware()
}

// UploadRateLimiter 上传限速器（每秒 2 次，突发 5 次）
func UploadRateLimiter() gin.HandlerFunc {
	rl := NewRateLimiter(2, 5)
	return rl.Middleware()
}
