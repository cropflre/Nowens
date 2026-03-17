package router

import (
	"nowen-file/config"
	"nowen-file/handler"
	"nowen-file/middleware"
	"nowen-file/storage"

	"github.com/gin-gonic/gin"
)

// Setup 初始化路由
func Setup(cfg *config.Config, auth *middleware.AuthMiddleware, store storage.Storage) *gin.Engine {
	r := gin.Default()

	// 全局中间件
	r.Use(middleware.Cors())

	// 设置文件上传大小限制
	r.MaxMultipartMemory = cfg.MaxUpload

	// 创建 Handler 实例
	userHandler := handler.NewUserHandler(auth)
	fileHandler := handler.NewFileHandlerWithStorage(store, cfg.ThumbDir, cfg.UploadDir)
	shareHandler := handler.NewShareHandlerWithFileService(fileHandler.GetFileService())
	versionHandler := handler.NewVersionHandler(store)
	adminHandler := handler.NewAdminHandler()
	webdavHandler := handler.NewWebDAVHandler(fileHandler.GetFileService())

	// ==================== WebDAV 接口 ====================
	// 支持所有 WebDAV 方法
	davMethods := []string{"GET", "HEAD", "PUT", "DELETE", "OPTIONS", "PROPFIND", "PROPPATCH", "MKCOL", "COPY", "MOVE", "LOCK", "UNLOCK"}
	for _, method := range davMethods {
		r.Handle(method, "/dav/*path", webdavHandler.HandleWebDAV)
	}

	// ==================== 公开接口 ====================
	api := r.Group("/api")
	{
		// 认证接口
		authGroup := api.Group("/auth")
		{
			authGroup.POST("/register", userHandler.Register)
			authGroup.POST("/login", userHandler.Login)
		}

		// 分享公开接口（不需要登录）
		publicShare := api.Group("/share")
		{
			publicShare.GET("/:code", shareHandler.GetShare)
			publicShare.POST("/:code/verify", shareHandler.VerifySharePassword)
			publicShare.GET("/:code/download", shareHandler.DownloadSharedFile)
			publicShare.GET("/:code/preview", shareHandler.PreviewSharedFile)
		}
	}

	// ==================== 需要登录的接口 ====================
	authorized := api.Group("")
	authorized.Use(auth.Auth())
	{
		// 用户接口
		userGroup := authorized.Group("/user")
		{
			userGroup.GET("/profile", userHandler.GetProfile)
			userGroup.PUT("/profile", userHandler.UpdateProfile)
		}

		// 文件管理接口
		fileGroup := authorized.Group("/files")
		{
			fileGroup.GET("/list", fileHandler.ListFiles)                 // 文件列表
			fileGroup.POST("/folder", fileHandler.CreateFolder)           // 创建文件夹
			fileGroup.POST("/upload", fileHandler.Upload)                 // 上传文件
			fileGroup.GET("/download/:uuid", fileHandler.Download)        // 下载文件
			fileGroup.GET("/preview/:uuid", fileHandler.Preview)          // 预览文件内容
			fileGroup.GET("/preview-info/:uuid", fileHandler.PreviewInfo) // 预览元信息
			fileGroup.GET("/thumb/:uuid", fileHandler.Thumbnail)          // 缩略图
			fileGroup.PUT("/rename", fileHandler.Rename)                  // 重命名
			fileGroup.PUT("/move", fileHandler.Move)                      // 移动
			fileGroup.POST("/trash", fileHandler.Trash)                   // 移入回收站
			fileGroup.POST("/restore", fileHandler.Restore)               // 从回收站恢复
			fileGroup.GET("/trash", fileHandler.ListTrash)                // 回收站列表
			fileGroup.DELETE("/:id", fileHandler.Delete)                  // 永久删除
			fileGroup.GET("/search", fileHandler.Search)                  // 搜索
			fileGroup.GET("/type/:type", fileHandler.SearchByType)        // 按类型搜索
			fileGroup.GET("/storage", fileHandler.StorageStats)           // 存储统计

			// 批量操作
			fileGroup.POST("/batch/trash", fileHandler.BatchTrash)   // 批量移入回收站
			fileGroup.POST("/batch/move", fileHandler.BatchMove)     // 批量移动
			fileGroup.POST("/batch/delete", fileHandler.BatchDelete) // 批量永久删除

			// 文件版本
			fileGroup.GET("/versions/:file_id", versionHandler.ListVersions)                 // 版本列表
			fileGroup.POST("/versions/restore", versionHandler.RestoreVersion)               // 回滚版本
			fileGroup.DELETE("/versions/:file_id/:version_id", versionHandler.DeleteVersion) // 删除版本
		}

		// 分享管理接口（需要登录）
		shareGroup := authorized.Group("/share")
		{
			shareGroup.POST("", shareHandler.CreateShare)       // 创建分享
			shareGroup.GET("/list", shareHandler.ListShares)    // 我的分享列表
			shareGroup.DELETE("/:id", shareHandler.DeleteShare) // 删除分享
		}
	}

	// ==================== 管理员接口 ====================
	adminGroup := api.Group("/admin")
	adminGroup.Use(auth.Auth(), middleware.AdminOnly())
	{
		adminGroup.GET("/dashboard", adminHandler.Dashboard)                     // 系统概览
		adminGroup.GET("/users", adminHandler.ListUsers)                         // 用户列表
		adminGroup.PUT("/users/:id", adminHandler.UpdateUser)                    // 更新用户
		adminGroup.DELETE("/users/:id", adminHandler.DeleteUser)                 // 删除用户
		adminGroup.POST("/users/:id/reset-password", adminHandler.ResetPassword) // 重置密码
		adminGroup.GET("/logs", adminHandler.ListAuditLogs)                      // 审计日志
		adminGroup.GET("/files", adminHandler.SystemFiles)                       // 系统文件统计
	}

	return r
}
