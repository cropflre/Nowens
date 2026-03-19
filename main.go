package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"nowen-file/config"
	"nowen-file/middleware"
	"nowen-file/model"
	"nowen-file/router"
	"nowen-file/service"
	"nowen-file/storage"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"
)

func main() {
	// 加载配置
	cfg := config.Load()

	// 初始化数据库
	if err := model.InitDB(cfg); err != nil {
		log.Fatalf("数据库初始化失败: %v", err)
	}

	// 确保必要的目录存在
	os.MkdirAll(cfg.UploadDir, 0755)
	os.MkdirAll(cfg.ThumbDir, 0755)

	// 初始化存储后端
	var store storage.Storage
	switch cfg.StorageType {
	case "s3":
		s3Store, err := storage.NewS3Storage(storage.S3Config{
			Endpoint:  cfg.S3Endpoint,
			Bucket:    cfg.S3Bucket,
			AccessKey: cfg.S3AccessKey,
			SecretKey: cfg.S3SecretKey,
			UseSSL:    cfg.S3UseSSL,
			Region:    cfg.S3Region,
		})
		if err != nil {
			log.Fatalf("S3 存储初始化失败: %v", err)
		}
		store = s3Store
		log.Printf("📦 使用 S3 存储后端: %s/%s", cfg.S3Endpoint, cfg.S3Bucket)
	default:
		store = storage.NewLocalStorage(cfg.UploadDir)
		log.Printf("📁 使用本地存储后端: %s", cfg.UploadDir)
	}

	// 初始化全文搜索引擎
	indexPath := filepath.Join(filepath.Dir(cfg.DBPath), "search_index")
	searchService := service.NewFullTextSearchService(indexPath, store)
	defer searchService.Close()

	// 初始化定时同步调度器
	scheduler := service.NewCronScheduler()
	fileService := service.NewFileServiceWithStorage(store, cfg.ThumbDir, cfg.UploadDir)
	fileService.SetSearchService(searchService)
	chunkService := service.NewChunkUploadService(store, cfg.UploadDir, cfg.ThumbDir)
	scheduler.SetFileService(fileService)
	scheduler.SetChunkUploadService(chunkService)
	scheduler.Start()

	// 初始化路由
	auth := middleware.NewAuthMiddleware(cfg.JWTSecret)
	r := router.Setup(cfg, auth, store, scheduler, searchService)

	// ==================== Graceful Shutdown ====================
	addr := fmt.Sprintf(":%d", cfg.Port)
	srv := &http.Server{
		Addr:           addr,
		Handler:        r,
		ReadTimeout:    60 * time.Second,
		WriteTimeout:   60 * time.Second,
		MaxHeaderBytes: 1 << 20,
	}

	// 启动 HTTP 服务器（非阻塞）
	go func() {
		log.Printf("🚀 Nowen-File 文件管理系统启动成功，监听端口: %d", cfg.Port)
		log.Printf("🌐 访问地址: http://localhost:%d", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("服务器启动失败: %v", err)
		}
	}()

	// 监听系统信号（SIGINT / SIGTERM）
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("⏹️  收到关闭信号，正在优雅关闭服务器...")

	// 给正在处理的请求最多 10 秒的时间完成
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// 停止定时任务
	scheduler.Stop()

	// 关闭 HTTP 服务器
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("服务器关闭异常: %v", err)
	}

	log.Println("✅ 服务器已安全关闭")
}
