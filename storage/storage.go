package storage

import (
	"io"
)

// Storage 存储后端接口 —— 所有存储方式必须实现此接口
type Storage interface {
	// Put 存储文件
	// key: 存储路径（相对路径），reader: 文件内容，size: 文件大小
	Put(key string, reader io.Reader, size int64) error

	// Get 读取文件，返回 ReadCloser（调用方需关闭）
	Get(key string) (io.ReadCloser, error)

	// Delete 删除文件
	Delete(key string) error

	// Exists 检查文件是否存在
	Exists(key string) bool

	// GetURL 获取文件的访问 URL（对于本地存储返回空字符串，由应用层处理）
	GetURL(key string) string

	// Type 返回存储类型名称
	Type() string

	// GetPresignedURL 获取预签名的下载/上传 URL（仅 S3 类存储有效，本地存储返回空字符串和 nil）
	// operation: "GET" 下载, "PUT" 上传
	// expiry: URL 有效期
	GetPresignedURL(key string, operation string, expiry int) (string, error)
}
