package router

import (
	"log"
	"net/http"
	"nowen-file/config"
	"nowen-file/handler"
	"nowen-file/middleware"
	"nowen-file/service"
	"nowen-file/storage"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
)

// Setup 初始化路由
func Setup(cfg *config.Config, auth *middleware.AuthMiddleware, store storage.Storage, scheduler *service.CronScheduler) *gin.Engine {
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
	mountHandler := handler.NewMountHandler()
	favoriteHandler := handler.NewFavoriteHandler()
	tagHandler := handler.NewTagHandler()
	notificationHandler := handler.NewNotificationHandler()
	dashboardHandler := handler.NewDashboardHandler(fileHandler.GetFileService())
	syncScheduleHandler := handler.NewSyncScheduleHandler(scheduler)
	encryptionHandler := handler.NewEncryptionHandler(fileHandler.GetFileService())
	workspaceHandler := handler.NewWorkspaceHandler()
	agentHandler := handler.NewAgentHandler()

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
			fileGroup.GET("/list", fileHandler.ListFiles)                     // 文件列表
			fileGroup.POST("/folder", fileHandler.CreateFolder)               // 创建文件夹
			fileGroup.POST("/upload", fileHandler.Upload)                     // 上传文件
			fileGroup.GET("/download/:uuid", fileHandler.Download)            // 下载文件
			fileGroup.GET("/preview/:uuid", fileHandler.Preview)              // 预览文件内容
			fileGroup.GET("/preview-info/:uuid", fileHandler.PreviewInfo)     // 预览元信息
			fileGroup.GET("/thumb/:uuid", fileHandler.Thumbnail)              // 缩略图
			fileGroup.PUT("/rename", fileHandler.Rename)                      // 重命名
			fileGroup.PUT("/move", fileHandler.Move)                          // 移动
			fileGroup.POST("/trash", fileHandler.Trash)                       // 移入回收站
			fileGroup.POST("/restore", fileHandler.Restore)                   // 从回收站恢复
			fileGroup.GET("/trash", fileHandler.ListTrash)                    // 回收站列表
			fileGroup.DELETE("/:id", fileHandler.Delete)                      // 永久删除
			fileGroup.GET("/search", fileHandler.Search)                      // 搜索
			fileGroup.GET("/type/:type", fileHandler.SearchByType)            // 按类型搜索
			fileGroup.GET("/storage", fileHandler.StorageStats)               // 存储统计
			fileGroup.POST("/instant-upload", fileHandler.CheckInstantUpload) // 秒传检查
			fileGroup.GET("/content/:uuid", fileHandler.GetTextContent)       // 获取文本内容
			fileGroup.PUT("/content/:uuid", fileHandler.SaveTextContent)      // 保存文本内容

			// 文件加密
			fileGroup.POST("/encrypt", encryptionHandler.EncryptFile)                // 加密文件
			fileGroup.POST("/decrypt", encryptionHandler.DecryptFile)                // 解密文件
			fileGroup.POST("/decrypt-download", encryptionHandler.DownloadDecrypted) // 临时解密下载

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

		// 收藏夹接口
		favGroup := authorized.Group("/favorites")
		{
			favGroup.POST("", favoriteHandler.AddFavorite)                 // 添加收藏
			favGroup.GET("", favoriteHandler.ListFavorites)                // 收藏列表
			favGroup.DELETE("/:file_id", favoriteHandler.RemoveFavorite)   // 取消收藏
			favGroup.GET("/check/:file_id", favoriteHandler.CheckFavorite) // 检查是否收藏
		}

		// 标签接口
		tagGroup := authorized.Group("/tags")
		{
			tagGroup.POST("", tagHandler.CreateTag)                         // 创建标签
			tagGroup.GET("", tagHandler.ListTags)                           // 标签列表
			tagGroup.PUT("/:id", tagHandler.UpdateTag)                      // 更新标签
			tagGroup.DELETE("/:id", tagHandler.DeleteTag)                   // 删除标签
			tagGroup.GET("/:id/files", tagHandler.GetFilesByTag)            // 按标签获取文件
			tagGroup.POST("/file", tagHandler.TagFile)                      // 给文件打标签
			tagGroup.DELETE("/file/:file_id/:tag_id", tagHandler.UntagFile) // 取消文件标签
			tagGroup.GET("/file/:file_id", tagHandler.GetFileTags)          // 获取文件标签
		}

		// 通知接口
		notifyGroup := authorized.Group("/notifications")
		{
			notifyGroup.GET("", notificationHandler.ListNotifications)           // 通知列表
			notifyGroup.GET("/unread-count", notificationHandler.GetUnreadCount) // 未读数量
			notifyGroup.PUT("/:id/read", notificationHandler.MarkAsRead)         // 标记已读
			notifyGroup.PUT("/read-all", notificationHandler.MarkAllAsRead)      // 全部已读
			notifyGroup.DELETE("/:id", notificationHandler.DeleteNotification)   // 删除通知
			notifyGroup.DELETE("/clear", notificationHandler.ClearAll)           // 清空通知
		}

		// 个人仪表盘
		authorized.GET("/dashboard", dashboardHandler.GetDashboard)

		// 定时同步调度接口
		syncGroup := authorized.Group("/sync-schedules")
		{
			syncGroup.POST("", syncScheduleHandler.CreateSchedule)                    // 创建定时任务
			syncGroup.GET("", syncScheduleHandler.ListSchedules)                      // 任务列表
			syncGroup.PUT("/:id", syncScheduleHandler.UpdateSchedule)                 // 更新任务
			syncGroup.DELETE("/:id", syncScheduleHandler.DeleteSchedule)              // 删除任务
			syncGroup.GET("/mount/:mount_id", syncScheduleHandler.GetScheduleByMount) // 按数据源查询
		}

		// 数据源/挂载点管理接口
		mountGroup := authorized.Group("/mounts")
		{
			mountGroup.POST("", mountHandler.CreateMount)                                // 创建数据源
			mountGroup.GET("", mountHandler.ListMounts)                                  // 数据源列表
			mountGroup.GET("/:id", mountHandler.GetMount)                                // 数据源详情
			mountGroup.PUT("/:id", mountHandler.UpdateMount)                             // 更新数据源
			mountGroup.DELETE("/:id", mountHandler.DeleteMount)                          // 删除数据源
			mountGroup.POST("/:id/scan", mountHandler.ScanMount)                         // 触发扫描
			mountGroup.GET("/:id/stats", mountHandler.GetMountStats)                     // 数据源统计
			mountGroup.GET("/:id/files", mountHandler.ListIndexedFiles)                  // 浏览索引文件
			mountGroup.GET("/search", mountHandler.SearchIndexedFiles)                   // 搜索索引文件
			mountGroup.GET("/files/:file_id/download", mountHandler.DownloadIndexedFile) // 下载索引文件
			mountGroup.GET("/files/:file_id/preview", mountHandler.PreviewIndexedFile)   // 预览索引文件
		}

		// 协作空间接口
		wsGroup := authorized.Group("/workspaces")
		{
			wsGroup.POST("", workspaceHandler.CreateWorkspace)                                                // 创建空间
			wsGroup.GET("", workspaceHandler.ListWorkspaces)                                                  // 空间列表
			wsGroup.GET("/:id", workspaceHandler.GetWorkspace)                                                // 空间详情
			wsGroup.PUT("/:id", workspaceHandler.UpdateWorkspace)                                             // 更新空间
			wsGroup.DELETE("/:id", workspaceHandler.DeleteWorkspace)                                          // 删除空间
			wsGroup.POST("/:id/members", workspaceHandler.AddMember)                                          // 添加成员
			wsGroup.GET("/:id/members", workspaceHandler.ListMembers)                                         // 成员列表
			wsGroup.PUT("/:id/members/:user_id", workspaceHandler.UpdateMemberRole)                           // 更新角色
			wsGroup.DELETE("/:id/members/:user_id", workspaceHandler.RemoveMember)                            // 移除成员
			wsGroup.POST("/folder-permission", workspaceHandler.SetFolderPermission)                          // 设置文件夹权限
			wsGroup.GET("/folder-permission/:folder_id", workspaceHandler.ListFolderPermissions)              // 查看文件夹权限
			wsGroup.DELETE("/folder-permission/:folder_id/:user_id", workspaceHandler.RemoveFolderPermission) // 移除权限
			wsGroup.GET("/search-users", workspaceHandler.SearchUsers)                                        // 搜索用户
		}

		// 远程 Agent 接口
		agentGroup := authorized.Group("/agents")
		{
			agentGroup.POST("/register", agentHandler.RegisterAgent)              // 注册 Agent
			agentGroup.POST("/ping", agentHandler.PingAgent)                      // 检测 Agent
			agentGroup.GET("/:mount_id/files", agentHandler.ListAgentFiles)       // 浏览 Agent 文件
			agentGroup.GET("/:mount_id/download", agentHandler.DownloadAgentFile) // 下载 Agent 文件
			agentGroup.POST("/:mount_id/sync", agentHandler.SyncAgentFiles)       // 同步 Agent 索引
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

	// ==================== 前端静态文件服务 ====================
	// 查找前端构建目录（支持 Docker 和本地开发两种路径）
	webDistDir := ""
	candidates := []string{
		"web/dist",      // 本地开发
		"./web/dist",    // 本地开发
		"/app/web/dist", // Docker 容器内
	}
	for _, dir := range candidates {
		absDir, _ := filepath.Abs(dir)
		if info, err := os.Stat(absDir); err == nil && info.IsDir() {
			webDistDir = absDir
			break
		}
	}

	if webDistDir != "" {
		// 提供静态资源文件
		fileSystem := http.Dir(webDistDir)
		r.Use(func(c *gin.Context) {
			path := c.Request.URL.Path

			// 跳过 API 和 WebDAV 请求
			if strings.HasPrefix(path, "/api/") || strings.HasPrefix(path, "/dav/") {
				c.Next()
				return
			}

			// 尝试提供静态文件
			filePath := filepath.Join(webDistDir, path)
			if _, err := os.Stat(filePath); err == nil {
				http.FileServer(fileSystem).ServeHTTP(c.Writer, c.Request)
				c.Abort()
				return
			}

			c.Next()
		})

		// SPA fallback：所有未匹配的路由返回 index.html
		r.NoRoute(func(c *gin.Context) {
			path := c.Request.URL.Path

			// API 和 WebDAV 请求不走 fallback
			if strings.HasPrefix(path, "/api/") || strings.HasPrefix(path, "/dav/") {
				c.JSON(404, gin.H{"error": "接口不存在"})
				return
			}

			indexPath := filepath.Join(webDistDir, "index.html")
			if _, err := os.Stat(indexPath); err == nil {
				c.File(indexPath)
				return
			}

			c.JSON(404, gin.H{"error": "页面未找到"})
		})

		// 输出日志
		log.Printf("🌍 前端静态文件目录: %s", webDistDir)
	} else {
		log.Printf("⚠️  未找到前端构建目录 (web/dist)，仅提供 API 服务")

		r.NoRoute(func(c *gin.Context) {
			c.JSON(404, gin.H{"error": "接口不存在，前端未部署"})
		})
	}

	return r
}
