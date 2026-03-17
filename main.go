package main

import (
	"fmt"
	"log"
	"nowen-file/config"
	"nowen-file/middleware"
	"nowen-file/model"
	"nowen-file/router"
	"nowen-file/service"
	"nowen-file/storage"
	"os"
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

	// 初始化定时同步调度器
	scheduler := service.NewCronScheduler()
	scheduler.Start()
	defer scheduler.Stop()

	// 初始化路由
	auth := middleware.NewAuthMiddleware(cfg.JWTSecret)
	r := router.Setup(cfg, auth, store, scheduler)

	// 启动服务器
	addr := fmt.Sprintf(":%d", cfg.Port)
	log.Printf("🚀 Nowen-File 文件管理系统启动成功，监听端口: %d", cfg.Port)
	log.Printf("🌐 访问地址: http://localhost:%d", cfg.Port)
	if err := r.Run(addr); err != nil {
		log.Fatalf("服务器启动失败: %v", err)
	}
}
