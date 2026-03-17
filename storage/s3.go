package storage

import (
	"context"
	"io"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

// S3Storage S3/MinIO 对象存储
type S3Storage struct {
	client   *minio.Client
	bucket   string
	endpoint string
	useSSL   bool
}

// S3Config S3 存储配置
type S3Config struct {
	Endpoint  string // 如 "play.min.io" 或 "s3.amazonaws.com"
	Bucket    string // 存储桶名称
	AccessKey string
	SecretKey string
	UseSSL    bool
	Region    string
}

// NewS3Storage 创建 S3/MinIO 存储实例
func NewS3Storage(cfg S3Config) (*S3Storage, error) {
	client, err := minio.New(cfg.Endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(cfg.AccessKey, cfg.SecretKey, ""),
		Secure: cfg.UseSSL,
		Region: cfg.Region,
	})
	if err != nil {
		return nil, err
	}

	// 确保存储桶存在
	ctx := context.Background()
	exists, err := client.BucketExists(ctx, cfg.Bucket)
	if err != nil {
		return nil, err
	}
	if !exists {
		err = client.MakeBucket(ctx, cfg.Bucket, minio.MakeBucketOptions{Region: cfg.Region})
		if err != nil {
			return nil, err
		}
	}

	return &S3Storage{
		client:   client,
		bucket:   cfg.Bucket,
		endpoint: cfg.Endpoint,
		useSSL:   cfg.UseSSL,
	}, nil
}

func (s *S3Storage) Put(key string, reader io.Reader, size int64) error {
	ctx := context.Background()
	_, err := s.client.PutObject(ctx, s.bucket, key, reader, size, minio.PutObjectOptions{})
	return err
}

func (s *S3Storage) Get(key string) (io.ReadCloser, error) {
	ctx := context.Background()
	obj, err := s.client.GetObject(ctx, s.bucket, key, minio.GetObjectOptions{})
	if err != nil {
		return nil, err
	}
	return obj, nil
}

func (s *S3Storage) Delete(key string) error {
	ctx := context.Background()
	return s.client.RemoveObject(ctx, s.bucket, key, minio.RemoveObjectOptions{})
}

func (s *S3Storage) Exists(key string) bool {
	ctx := context.Background()
	_, err := s.client.StatObject(ctx, s.bucket, key, minio.StatObjectOptions{})
	return err == nil
}

func (s *S3Storage) GetURL(key string) string {
	protocol := "http"
	if s.useSSL {
		protocol = "https"
	}
	return protocol + "://" + s.endpoint + "/" + s.bucket + "/" + key
}

func (s *S3Storage) Type() string {
	return "s3"
}
