package service

import (
	"crypto/sha256"
	"errors"
	"fmt"
	"io"
	"log"
	"nowen-file/model"
	"nowen-file/storage"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ChunkUploadService 分片上传服务
type ChunkUploadService struct {
	storage   storage.Storage
	chunkDir  string // 分片临时存储目录
	uploadDir string
	thumbDir  string
}

// NewChunkUploadService 创建分片上传服务
func NewChunkUploadService(store storage.Storage, uploadDir string, thumbDir string) *ChunkUploadService {
	chunkDir := filepath.Join(uploadDir, ".chunks")
	os.MkdirAll(chunkDir, 0755)
	return &ChunkUploadService{
		storage:   store,
		chunkDir:  chunkDir,
		uploadDir: uploadDir,
		thumbDir:  thumbDir,
	}
}

// InitUpload 初始化分片上传会话
func (s *ChunkUploadService) InitUpload(userID uint, parentID uint, fileName string, fileSize int64, chunkSize int64, mimeType string, hash string) (*model.ChunkUpload, error) {
	if fileName == "" || fileSize <= 0 || chunkSize <= 0 {
		return nil, errors.New("参数错误")
	}

	// 如果提供了哈希，先尝试秒传
	if hash != "" {
		var existing model.FileItem
		if err := model.DB.Where("hash = ? AND is_trash = ?", hash, false).First(&existing).Error; err == nil {
			// 可以秒传，返回特殊标记
			return &model.ChunkUpload{
				UploadID: "instant:" + hash,
				Status:   "done",
				Hash:     hash,
			}, nil
		}
	}

	// 计算总分片数
	totalChunks := int(fileSize / chunkSize)
	if fileSize%chunkSize > 0 {
		totalChunks++
	}

	uploadID := uuid.New().String()

	upload := &model.ChunkUpload{
		UploadID:    uploadID,
		UserID:      userID,
		ParentID:    parentID,
		FileName:    fileName,
		FileSize:    fileSize,
		ChunkSize:   chunkSize,
		TotalChunks: totalChunks,
		MimeType:    mimeType,
		Hash:        hash,
		Status:      "uploading",
	}

	if err := model.DB.Create(upload).Error; err != nil {
		return nil, errors.New("创建上传会话失败")
	}

	// 创建分片临时目录
	os.MkdirAll(filepath.Join(s.chunkDir, uploadID), 0755)

	return upload, nil
}

// UploadChunk 上传单个分片
func (s *ChunkUploadService) UploadChunk(uploadID string, chunkIndex int, data io.Reader) error {
	var upload model.ChunkUpload
	if err := model.DB.Where("upload_id = ?", uploadID).First(&upload).Error; err != nil {
		return errors.New("上传会话不存在")
	}

	if upload.Status != "uploading" {
		return errors.New("上传会话状态异常")
	}

	if chunkIndex < 0 || chunkIndex >= upload.TotalChunks {
		return fmt.Errorf("分片索引超出范围: %d (总分片: %d)", chunkIndex, upload.TotalChunks)
	}

	// 保存分片到临时目录
	chunkPath := filepath.Join(s.chunkDir, uploadID, fmt.Sprintf("%d", chunkIndex))
	dst, err := os.Create(chunkPath)
	if err != nil {
		return errors.New("保存分片失败")
	}
	defer dst.Close()

	if _, err := io.Copy(dst, data); err != nil {
		os.Remove(chunkPath)
		return errors.New("写入分片数据失败")
	}

	// 更新已上传分片列表
	uploaded := s.getUploadedChunks(upload.UploadedChunks)
	uploaded[chunkIndex] = true

	chunkList := make([]string, 0, len(uploaded))
	for idx := range uploaded {
		chunkList = append(chunkList, strconv.Itoa(idx))
	}
	sort.Strings(chunkList)

	model.DB.Model(&upload).Update("uploaded_chunks", strings.Join(chunkList, ","))

	return nil
}

// GetUploadStatus 获取上传进度
func (s *ChunkUploadService) GetUploadStatus(uploadID string) (*model.ChunkUpload, []int, error) {
	var upload model.ChunkUpload
	if err := model.DB.Where("upload_id = ?", uploadID).First(&upload).Error; err != nil {
		return nil, nil, errors.New("上传会话不存在")
	}

	uploaded := s.getUploadedChunks(upload.UploadedChunks)
	missingChunks := make([]int, 0)
	for i := 0; i < upload.TotalChunks; i++ {
		if !uploaded[i] {
			missingChunks = append(missingChunks, i)
		}
	}

	return &upload, missingChunks, nil
}

// MergeChunks 合并分片并创建文件记录
func (s *ChunkUploadService) MergeChunks(uploadID string) (*model.FileItem, error) {
	var upload model.ChunkUpload
	if err := model.DB.Where("upload_id = ?", uploadID).First(&upload).Error; err != nil {
		return nil, errors.New("上传会话不存在")
	}

	// 检查所有分片是否已上传
	uploaded := s.getUploadedChunks(upload.UploadedChunks)
	for i := 0; i < upload.TotalChunks; i++ {
		if !uploaded[i] {
			return nil, fmt.Errorf("分片 %d 尚未上传", i)
		}
	}

	// 更新状态为合并中
	model.DB.Model(&upload).Update("status", "merging")

	// 合并分片到临时文件
	tmpFile, err := os.CreateTemp(s.chunkDir, "merge-*")
	if err != nil {
		model.DB.Model(&upload).Update("status", "failed")
		return nil, errors.New("创建临时文件失败")
	}
	tmpPath := tmpFile.Name()
	defer os.Remove(tmpPath)

	// 边合并边计算哈希
	hasher := sha256.New()
	writer := io.MultiWriter(tmpFile, hasher)

	for i := 0; i < upload.TotalChunks; i++ {
		chunkPath := filepath.Join(s.chunkDir, uploadID, fmt.Sprintf("%d", i))
		chunk, err := os.Open(chunkPath)
		if err != nil {
			tmpFile.Close()
			model.DB.Model(&upload).Update("status", "failed")
			return nil, fmt.Errorf("读取分片 %d 失败", i)
		}
		_, err = io.Copy(writer, chunk)
		chunk.Close()
		if err != nil {
			tmpFile.Close()
			model.DB.Model(&upload).Update("status", "failed")
			return nil, fmt.Errorf("合并分片 %d 失败", i)
		}
	}
	tmpFile.Close()

	fileHash := fmt.Sprintf("%x", hasher.Sum(nil))

	// 检查是否可以去重（全局）
	var existingFile model.FileItem
	instantUpload := false
	var relPath string

	if err := model.DB.Where("hash = ? AND is_trash = ?", fileHash, false).
		First(&existingFile).Error; err == nil {
		relPath = existingFile.StorePath
		instantUpload = true
	} else {
		// 上传合并后的文件到存储后端
		fileUUID := uuid.New().String()
		ext := filepath.Ext(upload.FileName)
		dateDir := time.Now().Format("2006/01/02")
		relPath = filepath.Join(fmt.Sprintf("%d", upload.UserID), dateDir, fileUUID+ext)

		merged, err := os.Open(tmpPath)
		if err != nil {
			model.DB.Model(&upload).Update("status", "failed")
			return nil, errors.New("读取合并文件失败")
		}
		defer merged.Close()

		if err := s.storage.Put(relPath, merged, upload.FileSize); err != nil {
			model.DB.Model(&upload).Update("status", "failed")
			return nil, errors.New("保存文件失败: " + err.Error())
		}
	}

	// 处理同名文件
	uniqueName := getUniqueFileNameGlobal(upload.UserID, upload.ParentID, upload.FileName)

	// 创建文件记录
	newUUID := uuid.New().String()
	mimeType := upload.MimeType
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}

	fileItem := &model.FileItem{
		UUID:      newUUID,
		UserID:    upload.UserID,
		ParentID:  upload.ParentID,
		Name:      uniqueName,
		IsDir:     false,
		Size:      upload.FileSize,
		MimeType:  mimeType,
		StorePath: relPath,
		Hash:      fileHash,
	}

	if err := model.DB.Create(fileItem).Error; err != nil {
		if !instantUpload {
			s.storage.Delete(relPath)
		}
		model.DB.Model(&upload).Update("status", "failed")
		return nil, errors.New("保存文件记录失败")
	}

	// 更新存储使用量
	if !instantUpload {
		model.DB.Model(&model.User{}).Where("id = ?", upload.UserID).
			Update("storage_used", gorm.Expr("storage_used + ?", upload.FileSize))
	}

	// 异步生成缩略图
	if isImageMime(mimeType) {
		fileSvc := NewFileServiceWithStorage(s.storage, s.thumbDir, s.uploadDir)
		go fileSvc.generateThumbnail(fileItem)
	}

	// 更新上传状态
	model.DB.Model(&upload).Update("status", "done")

	// 清理分片
	go s.cleanupChunks(uploadID)

	return fileItem, nil
}

// cleanupChunks 清理分片临时文件
func (s *ChunkUploadService) cleanupChunks(uploadID string) {
	chunkDir := filepath.Join(s.chunkDir, uploadID)
	os.RemoveAll(chunkDir)
}

// CleanExpiredUploads 清理超过 24 小时的未完成上传
func (s *ChunkUploadService) CleanExpiredUploads() {
	expireTime := time.Now().Add(-24 * time.Hour)
	var uploads []model.ChunkUpload
	model.DB.Where("status = ? AND created_at < ?", "uploading", expireTime).Find(&uploads)

	for _, upload := range uploads {
		s.cleanupChunks(upload.UploadID)
		model.DB.Delete(&upload)
		log.Printf("[分片上传] 清理过期上传会话: %s (%s)", upload.UploadID, upload.FileName)
	}
}

// getUploadedChunks 解析已上传分片列表
func (s *ChunkUploadService) getUploadedChunks(str string) map[int]bool {
	result := make(map[int]bool)
	if str == "" {
		return result
	}
	for _, part := range strings.Split(str, ",") {
		if idx, err := strconv.Atoi(strings.TrimSpace(part)); err == nil {
			result[idx] = true
		}
	}
	return result
}

// getUniqueFileNameGlobal 全局获取不重名文件名
func getUniqueFileNameGlobal(userID uint, parentID uint, originalName string) string {
	name := originalName
	ext := filepath.Ext(name)
	baseName := strings.TrimSuffix(name, ext)

	for i := 1; ; i++ {
		var count int64
		model.DB.Model(&model.FileItem{}).Where(
			"user_id = ? AND parent_id = ? AND name = ? AND is_trash = ?",
			userID, parentID, name, false,
		).Count(&count)
		if count == 0 {
			return name
		}
		name = fmt.Sprintf("%s(%d)%s", baseName, i, ext)
	}
}
