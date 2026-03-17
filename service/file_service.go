package service

import (
	"crypto/sha256"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"nowen-file/model"
	"nowen-file/storage"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// FileService 文件服务
type FileService struct {
	storage   storage.Storage // 存储后端
	thumbDir  string          // 缩略图目录
	uploadDir string          // 上传目录（向下兼容）
}

// NewFileService 创建文件服务实例（兼容旧接口）
func NewFileService(uploadDir string) *FileService {
	return &FileService{
		storage:   storage.NewLocalStorage(uploadDir),
		thumbDir:  "./data/thumbs",
		uploadDir: uploadDir,
	}
}

// NewFileServiceWithStorage 创建带存储后端的文件服务实例
func NewFileServiceWithStorage(store storage.Storage, thumbDir string, uploadDir string) *FileService {
	os.MkdirAll(thumbDir, 0755)
	return &FileService{
		storage:   store,
		thumbDir:  thumbDir,
		uploadDir: uploadDir,
	}
}

// GetStorage 获取存储后端
func (s *FileService) GetStorage() storage.Storage {
	return s.storage
}

// ==================== 文件夹操作 ====================

// CreateFolder 创建文件夹
func (s *FileService) CreateFolder(userID uint, parentID uint, name string) (*model.FileItem, error) {
	// 验证文件夹名
	if name == "" || strings.ContainsAny(name, `/\:*?"<>|`) {
		return nil, errors.New("文件夹名称无效")
	}

	// 检查父目录是否存在且属于该用户
	if parentID != 0 {
		var parent model.FileItem
		if err := model.DB.Where("id = ? AND user_id = ? AND is_dir = ?", parentID, userID, true).
			First(&parent).Error; err != nil {
			return nil, errors.New("父文件夹不存在")
		}
	}

	// 检查同目录下是否有同名文件夹
	var count int64
	model.DB.Model(&model.FileItem{}).Where(
		"user_id = ? AND parent_id = ? AND name = ? AND is_dir = ? AND is_trash = ?",
		userID, parentID, name, true, false,
	).Count(&count)
	if count > 0 {
		return nil, errors.New("同名文件夹已存在")
	}

	folder := &model.FileItem{
		UUID:     uuid.New().String(),
		UserID:   userID,
		ParentID: parentID,
		Name:     name,
		IsDir:    true,
	}

	if err := model.DB.Create(folder).Error; err != nil {
		return nil, errors.New("创建文件夹失败")
	}

	return folder, nil
}

// ==================== 文件上传 ====================

// UploadFile 上传文件
func (s *FileService) UploadFile(userID uint, parentID uint, header *multipart.FileHeader) (*model.FileItem, error) {
	// 检查父目录
	if parentID != 0 {
		var parent model.FileItem
		if err := model.DB.Where("id = ? AND user_id = ? AND is_dir = ?", parentID, userID, true).
			First(&parent).Error; err != nil {
			return nil, errors.New("目标文件夹不存在")
		}
	}

	// 打开上传文件
	src, err := header.Open()
	if err != nil {
		return nil, errors.New("读取上传文件失败")
	}
	defer src.Close()

	// 计算文件哈希
	hasher := sha256.New()
	if _, err := io.Copy(hasher, src); err != nil {
		return nil, errors.New("计算文件哈希失败")
	}
	fileHash := fmt.Sprintf("%x", hasher.Sum(nil))

	// 重置文件指针
	src.Seek(0, 0)

	// ===== 秒传/去重：检查是否存在相同哈希的文件 =====
	var existingFile model.FileItem
	instantUpload := false
	var relPath string

	if err := model.DB.Where("hash = ? AND user_id = ? AND is_trash = ?", fileHash, userID, false).
		First(&existingFile).Error; err == nil {
		// 找到相同哈希的文件，复用存储路径（秒传）
		relPath = existingFile.StorePath
		instantUpload = true
	} else {
		// 没找到，正常上传
		fileUUID := uuid.New().String()
		ext := filepath.Ext(header.Filename)
		dateDir := time.Now().Format("2006/01/02")
		relPath = filepath.Join(fmt.Sprintf("%d", userID), dateDir, fileUUID+ext)

		if err := s.storage.Put(relPath, src, header.Size); err != nil {
			return nil, errors.New("保存文件失败: " + err.Error())
		}
	}

	// 检测 MIME 类型
	mimeType := header.Header.Get("Content-Type")
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}

	// 处理同名文件（自动重命名）
	fileName := s.getUniqueFileName(userID, parentID, header.Filename)

	// 创建文件记录
	newUUID := uuid.New().String()
	fileItem := &model.FileItem{
		UUID:      newUUID,
		UserID:    userID,
		ParentID:  parentID,
		Name:      fileName,
		IsDir:     false,
		Size:      header.Size,
		MimeType:  mimeType,
		StorePath: relPath,
		Hash:      fileHash,
	}

	if err := model.DB.Create(fileItem).Error; err != nil {
		if !instantUpload {
			s.storage.Delete(relPath)
		}
		return nil, errors.New("保存文件记录失败")
	}

	// 秒传不计入存储使用量（因为复用了同一份物理文件）
	if !instantUpload {
		model.DB.Model(&model.User{}).Where("id = ?", userID).
			Update("storage_used", gorm.Expr("storage_used + ?", header.Size))
	}

	// 异步生成缩略图（图片类型）
	if isImageMime(mimeType) {
		go s.generateThumbnail(fileItem)
	}

	return fileItem, nil
}

// CheckInstantUpload 检查文件是否可以秒传（根据哈希判断）
func (s *FileService) CheckInstantUpload(userID uint, parentID uint, hash string, fileName string, size int64, mimeType string) (*model.FileItem, bool) {
	var existingFile model.FileItem
	if err := model.DB.Where("hash = ? AND user_id = ? AND is_trash = ?", hash, userID, false).
		First(&existingFile).Error; err != nil {
		return nil, false
	}

	// 找到相同文件，直接创建引用记录
	newUUID := uuid.New().String()
	uniqueName := s.getUniqueFileName(userID, parentID, fileName)

	fileItem := &model.FileItem{
		UUID:      newUUID,
		UserID:    userID,
		ParentID:  parentID,
		Name:      uniqueName,
		IsDir:     false,
		Size:      size,
		MimeType:  mimeType,
		StorePath: existingFile.StorePath,
		Hash:      hash,
	}

	if err := model.DB.Create(fileItem).Error; err != nil {
		return nil, false
	}

	return fileItem, true
}

// getUniqueFileName 获取不重名的文件名
func (s *FileService) getUniqueFileName(userID uint, parentID uint, originalName string) string {
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

// ==================== 文件列表 ====================

// ListFiles 获取文件列表
func (s *FileService) ListFiles(userID uint, parentID uint, sortBy string, order string) ([]model.FileItem, error) {
	var files []model.FileItem

	query := model.DB.Where("user_id = ? AND parent_id = ? AND is_trash = ?", userID, parentID, false)

	// 排序：默认文件夹在前，然后按更新时间降序
	orderClause := "is_dir DESC"
	switch sortBy {
	case "name":
		orderClause += ", name"
	case "size":
		orderClause += ", size"
	case "created_at":
		orderClause += ", created_at"
	default:
		orderClause += ", updated_at"
	}

	if order == "asc" {
		orderClause += " ASC"
	} else {
		orderClause += " DESC"
	}

	if err := query.Order(orderClause).Find(&files).Error; err != nil {
		return nil, errors.New("查询文件列表失败")
	}

	return files, nil
}

// ==================== 文件操作 ====================

// GetFileByUUID 根据 UUID 获取文件
func (s *FileService) GetFileByUUID(uuid string) (*model.FileItem, error) {
	var file model.FileItem
	if err := model.DB.Where("uuid = ?", uuid).First(&file).Error; err != nil {
		return nil, errors.New("文件不存在")
	}
	return &file, nil
}

// GetFilePath 获取文件的磁盘路径（仅本地存储有效）
func (s *FileService) GetFilePath(file *model.FileItem) string {
	if local, ok := s.storage.(*storage.LocalStorage); ok {
		return local.GetFullPath(file.StorePath)
	}
	return filepath.Join(s.uploadDir, file.StorePath)
}

// GetFileReader 获取文件内容的 Reader（支持所有存储后端）
func (s *FileService) GetFileReader(file *model.FileItem) (io.ReadCloser, error) {
	return s.storage.Get(file.StorePath)
}

// RenameFile 重命名文件或文件夹
func (s *FileService) RenameFile(userID uint, fileID uint, newName string) error {
	if newName == "" || strings.ContainsAny(newName, `/\:*?"<>|`) {
		return errors.New("名称无效")
	}

	var file model.FileItem
	if err := model.DB.Where("id = ? AND user_id = ?", fileID, userID).First(&file).Error; err != nil {
		return errors.New("文件不存在")
	}

	// 检查同目录下是否有同名文件
	var count int64
	model.DB.Model(&model.FileItem{}).Where(
		"user_id = ? AND parent_id = ? AND name = ? AND id != ? AND is_dir = ? AND is_trash = ?",
		userID, file.ParentID, newName, fileID, file.IsDir, false,
	).Count(&count)
	if count > 0 {
		return errors.New("同名文件已存在")
	}

	return model.DB.Model(&file).Update("name", newName).Error
}

// MoveFile 移动文件或文件夹
func (s *FileService) MoveFile(userID uint, fileID uint, targetParentID uint) error {
	var file model.FileItem
	if err := model.DB.Where("id = ? AND user_id = ?", fileID, userID).First(&file).Error; err != nil {
		return errors.New("文件不存在")
	}

	// 不能移动到自身或子目录
	if file.IsDir && fileID == targetParentID {
		return errors.New("不能移动到自身目录")
	}

	// 验证目标目录
	if targetParentID != 0 {
		var target model.FileItem
		if err := model.DB.Where("id = ? AND user_id = ? AND is_dir = ?", targetParentID, userID, true).
			First(&target).Error; err != nil {
			return errors.New("目标文件夹不存在")
		}
	}

	return model.DB.Model(&file).Update("parent_id", targetParentID).Error
}

// ==================== 回收站 ====================

// TrashFile 将文件移入回收站
func (s *FileService) TrashFile(userID uint, fileID uint) error {
	now := time.Now()
	result := model.DB.Model(&model.FileItem{}).
		Where("id = ? AND user_id = ? AND is_trash = ?", fileID, userID, false).
		Updates(map[string]interface{}{
			"is_trash":   true,
			"trashed_at": now,
		})

	if result.RowsAffected == 0 {
		return errors.New("文件不存在")
	}
	return result.Error
}

// RestoreFile 从回收站恢复文件
func (s *FileService) RestoreFile(userID uint, fileID uint) error {
	result := model.DB.Model(&model.FileItem{}).
		Where("id = ? AND user_id = ? AND is_trash = ?", fileID, userID, true).
		Updates(map[string]interface{}{
			"is_trash":   false,
			"trashed_at": nil,
		})

	if result.RowsAffected == 0 {
		return errors.New("文件不存在")
	}
	return result.Error
}

// ListTrash 获取回收站列表
func (s *FileService) ListTrash(userID uint) ([]model.FileItem, error) {
	var files []model.FileItem
	if err := model.DB.Where("user_id = ? AND is_trash = ?", userID, true).
		Order("trashed_at DESC").Find(&files).Error; err != nil {
		return nil, errors.New("查询回收站失败")
	}
	return files, nil
}

// DeletePermanently 永久删除文件
func (s *FileService) DeletePermanently(userID uint, fileID uint) error {
	var file model.FileItem
	if err := model.DB.Where("id = ? AND user_id = ?", fileID, userID).First(&file).Error; err != nil {
		return errors.New("文件不存在")
	}

	// 如果是文件，删除存储文件并更新存储使用量
	if !file.IsDir {
		s.storage.Delete(file.StorePath)
		// 删除缩略图（如果有）
		s.deleteThumbnail(&file)

		model.DB.Model(&model.User{}).Where("id = ?", userID).
			Update("storage_used", gorm.Expr("storage_used - ?", file.Size))
	} else {
		// 如果是文件夹，递归删除子文件
		s.deleteChildrenPermanently(userID, fileID)
	}

	return model.DB.Delete(&file).Error
}

// deleteChildrenPermanently 递归永久删除子文件
func (s *FileService) deleteChildrenPermanently(userID uint, parentID uint) {
	var children []model.FileItem
	model.DB.Where("user_id = ? AND parent_id = ?", userID, parentID).Find(&children)

	for _, child := range children {
		if child.IsDir {
			s.deleteChildrenPermanently(userID, child.ID)
		} else {
			s.storage.Delete(child.StorePath)
			s.deleteThumbnail(&child)

			model.DB.Model(&model.User{}).Where("id = ?", userID).
				Update("storage_used", gorm.Expr("storage_used - ?", child.Size))
		}
		model.DB.Delete(&child)
	}
}

// ==================== 面包屑导航 ====================

// GetBreadcrumb 获取面包屑路径
func (s *FileService) GetBreadcrumb(userID uint, fileID uint) ([]model.FileItem, error) {
	var breadcrumb []model.FileItem
	currentID := fileID

	for currentID != 0 {
		var file model.FileItem
		if err := model.DB.Where("id = ? AND user_id = ?", currentID, userID).First(&file).Error; err != nil {
			break
		}
		breadcrumb = append([]model.FileItem{file}, breadcrumb...)
		currentID = file.ParentID
	}

	return breadcrumb, nil
}

// ==================== 搜索增强 ====================

// SearchFiles 搜索文件（支持类型过滤）
func (s *FileService) SearchFiles(userID uint, keyword string) ([]model.FileItem, error) {
	var files []model.FileItem
	if err := model.DB.Where("user_id = ? AND name LIKE ? AND is_trash = ?", userID, "%"+keyword+"%", false).
		Order("is_dir DESC, updated_at DESC").
		Limit(50).
		Find(&files).Error; err != nil {
		return nil, errors.New("搜索失败")
	}
	return files, nil
}

// SearchFilesByType 按类型搜索文件
func (s *FileService) SearchFilesByType(userID uint, fileType string) ([]model.FileItem, error) {
	var files []model.FileItem

	query := model.DB.Where("user_id = ? AND is_dir = ? AND is_trash = ?", userID, false, false)

	switch fileType {
	case "image":
		query = query.Where("mime_type LIKE ?", "image/%")
	case "video":
		query = query.Where("mime_type LIKE ?", "video/%")
	case "audio":
		query = query.Where("mime_type LIKE ?", "audio/%")
	case "document":
		query = query.Where("mime_type IN ?", []string{
			"application/pdf",
			"application/msword",
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			"application/vnd.ms-excel",
			"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			"application/vnd.ms-powerpoint",
			"application/vnd.openxmlformats-officedocument.presentationml.presentation",
			"text/plain",
			"text/markdown",
		})
	default:
		return nil, errors.New("不支持的文件类型")
	}

	if err := query.Order("updated_at DESC").Limit(100).Find(&files).Error; err != nil {
		return nil, errors.New("搜索失败")
	}
	return files, nil
}

// ==================== 存储统计 ====================

// GetStorageStats 获取用户存储统计
func (s *FileService) GetStorageStats(userID uint) (map[string]interface{}, error) {
	var user model.User
	if err := model.DB.First(&user, userID).Error; err != nil {
		return nil, errors.New("用户不存在")
	}

	// 按类型统计
	type TypeStat struct {
		MimeType string
		Total    int64
		Count    int64
	}

	var stats []TypeStat
	model.DB.Model(&model.FileItem{}).
		Select("mime_type, SUM(size) as total, COUNT(*) as count").
		Where("user_id = ? AND is_dir = ? AND is_trash = ?", userID, false, false).
		Group("mime_type").
		Find(&stats)

	return map[string]interface{}{
		"storage_limit": user.StorageLimit,
		"storage_used":  user.StorageUsed,
		"type_stats":    stats,
	}, nil
}

// ==================== 缩略图 ====================

// generateThumbnail 生成图片缩略图
func (s *FileService) generateThumbnail(file *model.FileItem) {
	// 获取文件内容
	reader, err := s.storage.Get(file.StorePath)
	if err != nil {
		return
	}
	defer reader.Close()

	// 缩略图存储路径
	thumbPath := s.getThumbPath(file.UUID)
	os.MkdirAll(filepath.Dir(thumbPath), 0755)

	// 读取原始图片数据，创建缩略图（简化版：直接拷贝小图片，大图片截取前部分）
	// 这里使用简单的文件复制策略；生产环境可使用 imaging 库进行真正的缩放
	dst, err := os.Create(thumbPath)
	if err != nil {
		return
	}
	defer dst.Close()

	// 限制缩略图大小为前 512KB（简化方案）
	io.CopyN(dst, reader, 512*1024)
}

// GetThumbnailPath 获取缩略图路径
func (s *FileService) GetThumbnailPath(fileUUID string) string {
	return s.getThumbPath(fileUUID)
}

// HasThumbnail 检查是否有缩略图
func (s *FileService) HasThumbnail(fileUUID string) bool {
	thumbPath := s.getThumbPath(fileUUID)
	_, err := os.Stat(thumbPath)
	return err == nil
}

func (s *FileService) getThumbPath(fileUUID string) string {
	return filepath.Join(s.thumbDir, fileUUID[:2], fileUUID+".jpg")
}

func (s *FileService) deleteThumbnail(file *model.FileItem) {
	thumbPath := s.getThumbPath(file.UUID)
	os.Remove(thumbPath)
}

// ==================== 辅助函数 ====================

// isImageMime 判断 MIME 类型是否为图片
func isImageMime(mimeType string) bool {
	return strings.HasPrefix(mimeType, "image/")
}

// IsPreviewable 判断文件是否可预览
func IsPreviewable(mimeType string) bool {
	if mimeType == "" {
		return false
	}
	return strings.HasPrefix(mimeType, "image/") ||
		strings.HasPrefix(mimeType, "text/") ||
		strings.HasPrefix(mimeType, "video/") ||
		strings.HasPrefix(mimeType, "audio/") ||
		mimeType == "application/pdf" ||
		mimeType == "application/json"
}

// GetPreviewType 获取预览类型
func GetPreviewType(mimeType string) string {
	switch {
	case strings.HasPrefix(mimeType, "image/"):
		return "image"
	case strings.HasPrefix(mimeType, "video/"):
		return "video"
	case strings.HasPrefix(mimeType, "audio/"):
		return "audio"
	case mimeType == "application/pdf":
		return "pdf"
	case strings.HasPrefix(mimeType, "text/"), mimeType == "application/json":
		return "text"
	default:
		return "unknown"
	}
}

// ==================== 批量操作 ====================

// BatchTrash 批量移入回收站
func (s *FileService) BatchTrash(userID uint, fileIDs []uint) (int, error) {
	now := time.Now()
	result := model.DB.Model(&model.FileItem{}).
		Where("user_id = ? AND id IN ? AND is_trash = ?", userID, fileIDs, false).
		Updates(map[string]interface{}{
			"is_trash":   true,
			"trashed_at": now,
		})
	return int(result.RowsAffected), result.Error
}

// BatchMove 批量移动文件
func (s *FileService) BatchMove(userID uint, fileIDs []uint, targetParentID uint) (int, error) {
	// 验证目标目录
	if targetParentID != 0 {
		var target model.FileItem
		if err := model.DB.Where("id = ? AND user_id = ? AND is_dir = ?", targetParentID, userID, true).
			First(&target).Error; err != nil {
			return 0, errors.New("目标文件夹不存在")
		}
	}

	// 不能将文件夹移入自身
	for _, id := range fileIDs {
		if id == targetParentID {
			return 0, errors.New("不能将文件夹移入自身")
		}
	}

	result := model.DB.Model(&model.FileItem{}).
		Where("user_id = ? AND id IN ?", userID, fileIDs).
		Update("parent_id", targetParentID)
	return int(result.RowsAffected), result.Error
}

// BatchDeletePermanently 批量永久删除
func (s *FileService) BatchDeletePermanently(userID uint, fileIDs []uint) (int, error) {
	deleted := 0
	for _, id := range fileIDs {
		if err := s.DeletePermanently(userID, id); err == nil {
			deleted++
		}
	}
	return deleted, nil
}

// GetFileByID 根据 ID 获取文件
func (s *FileService) GetFileByID(userID uint, fileID uint) (*model.FileItem, error) {
	var file model.FileItem
	if err := model.DB.Where("id = ? AND user_id = ?", fileID, userID).First(&file).Error; err != nil {
		return nil, errors.New("文件不存在")
	}
	return &file, nil
}

// ==================== 在线编辑 ====================

// SaveTextContent 保存文本文件内容（自动创建版本历史）
func (s *FileService) SaveTextContent(userID uint, file *model.FileItem, content []byte) (*model.FileItem, error) {
	// 先保存当前版本为历史版本
	var maxVersion int
	model.DB.Model(&model.FileVersion{}).Where("file_id = ?", file.ID).
		Select("COALESCE(MAX(version), 0)").Scan(&maxVersion)

	version := &model.FileVersion{
		FileID:    file.ID,
		UserID:    userID,
		Version:   maxVersion + 1,
		Size:      file.Size,
		StorePath: file.StorePath,
		Hash:      file.Hash,
		Comment:   "在线编辑前自动保存",
	}
	model.DB.Create(version)

	// 计算新哈希
	hasher := sha256.New()
	hasher.Write(content)
	newHash := fmt.Sprintf("%x", hasher.Sum(nil))

	// 生成新的存储路径
	newUUID := uuid.New().String()
	ext := filepath.Ext(file.Name)
	dateDir := time.Now().Format("2006/01/02")
	newRelPath := filepath.Join(fmt.Sprintf("%d", userID), dateDir, newUUID+ext)

	// 使用 strings.NewReader 包装内容
	reader := strings.NewReader(string(content))
	if err := s.storage.Put(newRelPath, reader, int64(len(content))); err != nil {
		return nil, errors.New("保存文件失败: " + err.Error())
	}

	// 更新文件记录
	oldSize := file.Size
	newSize := int64(len(content))

	model.DB.Model(file).Updates(map[string]interface{}{
		"store_path": newRelPath,
		"hash":       newHash,
		"size":       newSize,
	})

	// 更新用户存储使用量差值
	diff := newSize - oldSize
	if diff != 0 {
		model.DB.Model(&model.User{}).Where("id = ?", userID).
			Update("storage_used", gorm.Expr("storage_used + ?", diff))
	}

	// 重新查询返回最新文件信息
	var updated model.FileItem
	model.DB.First(&updated, file.ID)
	return &updated, nil
}

// ==================== 个人仪表盘统计 ====================

// GetDashboardStats 获取用户仪表盘数据
func (s *FileService) GetDashboardStats(userID uint) (map[string]interface{}, error) {
	// 基础统计
	var fileCount, folderCount, trashCount, shareCount, favoriteCount int64
	model.DB.Model(&model.FileItem{}).Where("user_id = ? AND is_dir = ? AND is_trash = ?", userID, false, false).Count(&fileCount)
	model.DB.Model(&model.FileItem{}).Where("user_id = ? AND is_dir = ? AND is_trash = ?", userID, true, false).Count(&folderCount)
	model.DB.Model(&model.FileItem{}).Where("user_id = ? AND is_trash = ?", userID, true).Count(&trashCount)
	model.DB.Model(&model.ShareLink{}).Where("user_id = ?", userID).Count(&shareCount)
	model.DB.Model(&model.Favorite{}).Where("user_id = ?", userID).Count(&favoriteCount)

	// 用户信息
	var user model.User
	model.DB.First(&user, userID)

	// 最近文件（最近 10 个更新的文件）
	var recentFiles []model.FileItem
	model.DB.Where("user_id = ? AND is_dir = ? AND is_trash = ?", userID, false, false).
		Order("updated_at DESC").Limit(10).Find(&recentFiles)

	// 按类型统计文件大小分布
	type TypeStat struct {
		Category string `json:"category"`
		Total    int64  `json:"total"`
		Count    int64  `json:"count"`
	}

	var imageTotal, videoTotal, audioTotal, docTotal, otherTotal int64
	var imageCount, videoCount, audioCount, docCount, otherCount int64

	model.DB.Model(&model.FileItem{}).
		Where("user_id = ? AND is_dir = ? AND is_trash = ? AND mime_type LIKE ?", userID, false, false, "image/%").
		Select("COALESCE(SUM(size), 0)").Scan(&imageTotal)
	model.DB.Model(&model.FileItem{}).
		Where("user_id = ? AND is_dir = ? AND is_trash = ? AND mime_type LIKE ?", userID, false, false, "image/%").
		Count(&imageCount)

	model.DB.Model(&model.FileItem{}).
		Where("user_id = ? AND is_dir = ? AND is_trash = ? AND mime_type LIKE ?", userID, false, false, "video/%").
		Select("COALESCE(SUM(size), 0)").Scan(&videoTotal)
	model.DB.Model(&model.FileItem{}).
		Where("user_id = ? AND is_dir = ? AND is_trash = ? AND mime_type LIKE ?", userID, false, false, "video/%").
		Count(&videoCount)

	model.DB.Model(&model.FileItem{}).
		Where("user_id = ? AND is_dir = ? AND is_trash = ? AND mime_type LIKE ?", userID, false, false, "audio/%").
		Select("COALESCE(SUM(size), 0)").Scan(&audioTotal)
	model.DB.Model(&model.FileItem{}).
		Where("user_id = ? AND is_dir = ? AND is_trash = ? AND mime_type LIKE ?", userID, false, false, "audio/%").
		Count(&audioCount)

	model.DB.Model(&model.FileItem{}).
		Where("user_id = ? AND is_dir = ? AND is_trash = ? AND (mime_type LIKE ? OR mime_type IN ?)",
			userID, false, false, "text/%", []string{
				"application/pdf", "application/msword",
				"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			}).
		Select("COALESCE(SUM(size), 0)").Scan(&docTotal)
	model.DB.Model(&model.FileItem{}).
		Where("user_id = ? AND is_dir = ? AND is_trash = ? AND (mime_type LIKE ? OR mime_type IN ?)",
			userID, false, false, "text/%", []string{
				"application/pdf", "application/msword",
				"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			}).
		Count(&docCount)

	otherTotal = user.StorageUsed - imageTotal - videoTotal - audioTotal - docTotal
	otherCount = fileCount - imageCount - videoCount - audioCount - docCount
	if otherTotal < 0 {
		otherTotal = 0
	}
	if otherCount < 0 {
		otherCount = 0
	}

	typeDistribution := []TypeStat{
		{Category: "图片", Total: imageTotal, Count: imageCount},
		{Category: "视频", Total: videoTotal, Count: videoCount},
		{Category: "音频", Total: audioTotal, Count: audioCount},
		{Category: "文档", Total: docTotal, Count: docCount},
		{Category: "其他", Total: otherTotal, Count: otherCount},
	}

	// 最近 7 天上传趋势
	type DayStat struct {
		Date  string `json:"date"`
		Count int64  `json:"count"`
		Size  int64  `json:"size"`
	}
	var uploadTrend []DayStat
	for i := 6; i >= 0; i-- {
		day := time.Now().AddDate(0, 0, -i)
		dayStart := time.Date(day.Year(), day.Month(), day.Day(), 0, 0, 0, 0, day.Location())
		dayEnd := dayStart.AddDate(0, 0, 1)

		var count int64
		var size int64
		model.DB.Model(&model.FileItem{}).
			Where("user_id = ? AND is_dir = ? AND created_at >= ? AND created_at < ?", userID, false, dayStart, dayEnd).
			Count(&count)
		model.DB.Model(&model.FileItem{}).
			Where("user_id = ? AND is_dir = ? AND created_at >= ? AND created_at < ?", userID, false, dayStart, dayEnd).
			Select("COALESCE(SUM(size), 0)").Scan(&size)

		uploadTrend = append(uploadTrend, DayStat{
			Date:  dayStart.Format("01-02"),
			Count: count,
			Size:  size,
		})
	}

	return map[string]interface{}{
		"file_count":        fileCount,
		"folder_count":      folderCount,
		"trash_count":       trashCount,
		"share_count":       shareCount,
		"favorite_count":    favoriteCount,
		"storage_used":      user.StorageUsed,
		"storage_limit":     user.StorageLimit,
		"recent_files":      recentFiles,
		"type_distribution": typeDistribution,
		"upload_trend":      uploadTrend,
	}, nil
}
