package config

import (
	"os"
	"strconv"
)

// Config 应用配置
type Config struct {
	Port      int    // 服务端口
	DBPath    string // SQLite 数据库路径
	UploadDir string // 文件上传目录
	JWTSecret string // JWT 签名密钥
	MaxUpload int64  // 最大上传大小（字节）
	ThumbDir  string // 缩略图目录

	// 存储后端配置
	StorageType string // 存储类型: local / s3

	// S3/MinIO 配置（当 StorageType = "s3" 时生效）
	S3Endpoint  string
	S3Bucket    string
	S3AccessKey string
	S3SecretKey string
	S3UseSSL    bool
	S3Region    string
}

// Load 加载配置，优先读取环境变量，否则使用默认值
func Load() *Config {
	return &Config{
		Port:      getEnvInt("NOWEN_PORT", 8080),
		DBPath:    getEnv("NOWEN_DB_PATH", "./data/nowen.db"),
		UploadDir: getEnv("NOWEN_UPLOAD_DIR", "./data/uploads"),
		JWTSecret: getEnv("NOWEN_JWT_SECRET", "nowen-file-secret-key-change-me"),
		MaxUpload: int64(getEnvInt("NOWEN_MAX_UPLOAD", 1024*1024*1024)), // 默认 1GB
		ThumbDir:  getEnv("NOWEN_THUMB_DIR", "./data/thumbs"),

		StorageType: getEnv("NOWEN_STORAGE_TYPE", "local"),

		S3Endpoint:  getEnv("NOWEN_S3_ENDPOINT", ""),
		S3Bucket:    getEnv("NOWEN_S3_BUCKET", "nowen-file"),
		S3AccessKey: getEnv("NOWEN_S3_ACCESS_KEY", ""),
		S3SecretKey: getEnv("NOWEN_S3_SECRET_KEY", ""),
		S3UseSSL:    getEnvBool("NOWEN_S3_USE_SSL", false),
		S3Region:    getEnv("NOWEN_S3_REGION", "us-east-1"),
	}
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}

func getEnvInt(key string, defaultVal int) int {
	if val := os.Getenv(key); val != "" {
		if intVal, err := strconv.Atoi(val); err == nil {
			return intVal
		}
	}
	return defaultVal
}

func getEnvBool(key string, defaultVal bool) bool {
	if val := os.Getenv(key); val != "" {
		if boolVal, err := strconv.ParseBool(val); err == nil {
			return boolVal
		}
	}
	return defaultVal
}
