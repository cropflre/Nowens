package storage

import (
	"io"
	"os"
	"path/filepath"
)

// LocalStorage 本地磁盘存储
type LocalStorage struct {
	baseDir string // 存储根目录
}

// NewLocalStorage 创建本地存储实例
func NewLocalStorage(baseDir string) *LocalStorage {
	os.MkdirAll(baseDir, 0755)
	return &LocalStorage{baseDir: baseDir}
}

func (s *LocalStorage) Put(key string, reader io.Reader, size int64) error {
	fullPath := filepath.Join(s.baseDir, key)

	// 确保目录存在
	if err := os.MkdirAll(filepath.Dir(fullPath), 0755); err != nil {
		return err
	}

	f, err := os.Create(fullPath)
	if err != nil {
		return err
	}
	defer f.Close()

	_, err = io.Copy(f, reader)
	return err
}

func (s *LocalStorage) Get(key string) (io.ReadCloser, error) {
	fullPath := filepath.Join(s.baseDir, key)
	return os.Open(fullPath)
}

func (s *LocalStorage) Delete(key string) error {
	fullPath := filepath.Join(s.baseDir, key)
	return os.Remove(fullPath)
}

func (s *LocalStorage) Exists(key string) bool {
	fullPath := filepath.Join(s.baseDir, key)
	_, err := os.Stat(fullPath)
	return err == nil
}

func (s *LocalStorage) GetURL(key string) string {
	// 本地存储不生成外部 URL，由应用层通过 API 提供访问
	return ""
}

func (s *LocalStorage) Type() string {
	return "local"
}

// GetPresignedURL 本地存储不支持预签名 URL，返回空字符串
func (s *LocalStorage) GetPresignedURL(key string, operation string, expiry int) (string, error) {
	return "", nil
}

// GetFullPath 获取文件的完整磁盘路径（仅本地存储可用）
func (s *LocalStorage) GetFullPath(key string) string {
	return filepath.Join(s.baseDir, key)
}
