package service

import (
	"errors"
	"fmt"
	"nowen-file/model"
	"nowen-file/storage"

	"gorm.io/gorm"
)

// VersionService 文件版本服务
type VersionService struct {
	store storage.Storage
}

// NewVersionService 创建文件版本服务
func NewVersionService(store storage.Storage) *VersionService {
	return &VersionService{store: store}
}

// CreateVersion 为文件创建一个版本快照（在上传覆盖前调用）
func (s *VersionService) CreateVersion(file *model.FileItem, comment string) (*model.FileVersion, error) {
	// 获取当前最大版本号
	var maxVersion int
	model.DB.Model(&model.FileVersion{}).
		Where("file_id = ?", file.ID).
		Select("COALESCE(MAX(version), 0)").
		Scan(&maxVersion)

	version := &model.FileVersion{
		FileID:    file.ID,
		UserID:    file.UserID,
		Version:   maxVersion + 1,
		Size:      file.Size,
		StorePath: file.StorePath,
		Hash:      file.Hash,
		Comment:   comment,
	}

	if err := model.DB.Create(version).Error; err != nil {
		return nil, errors.New("创建版本记录失败")
	}

	return version, nil
}

// ListVersions 获取文件的所有版本
func (s *VersionService) ListVersions(fileID uint, userID uint) ([]model.FileVersion, error) {
	// 验证文件所有权
	var file model.FileItem
	if err := model.DB.Where("id = ? AND user_id = ?", fileID, userID).First(&file).Error; err != nil {
		return nil, errors.New("文件不存在")
	}

	var versions []model.FileVersion
	if err := model.DB.Where("file_id = ?", fileID).
		Order("version DESC").Find(&versions).Error; err != nil {
		return nil, errors.New("查询版本列表失败")
	}

	return versions, nil
}

// RestoreVersion 回滚到指定版本
func (s *VersionService) RestoreVersion(fileID uint, versionID uint, userID uint) error {
	// 验证文件所有权
	var file model.FileItem
	if err := model.DB.Where("id = ? AND user_id = ?", fileID, userID).First(&file).Error; err != nil {
		return errors.New("文件不存在")
	}

	// 获取目标版本
	var version model.FileVersion
	if err := model.DB.Where("id = ? AND file_id = ?", versionID, fileID).First(&version).Error; err != nil {
		return errors.New("版本不存在")
	}

	// 将当前版本保存为新的历史版本
	s.CreateVersion(&file, fmt.Sprintf("回滚前自动保存（回滚到 v%d）", version.Version))

	// 更新文件记录指向目标版本的存储路径
	updates := map[string]interface{}{
		"store_path": version.StorePath,
		"size":       version.Size,
		"hash":       version.Hash,
	}

	if err := model.DB.Model(&file).Updates(updates).Error; err != nil {
		return errors.New("回滚失败")
	}

	// 更新存储使用量差异
	sizeDiff := version.Size - file.Size
	if sizeDiff != 0 {
		model.DB.Model(&model.User{}).Where("id = ?", userID).
			Update("storage_used", gorm.Expr("storage_used + ?", sizeDiff))
	}

	return nil
}

// DeleteVersion 删除指定版本
func (s *VersionService) DeleteVersion(fileID uint, versionID uint, userID uint) error {
	// 验证文件所有权
	var file model.FileItem
	if err := model.DB.Where("id = ? AND user_id = ?", fileID, userID).First(&file).Error; err != nil {
		return errors.New("文件不存在")
	}

	var version model.FileVersion
	if err := model.DB.Where("id = ? AND file_id = ?", versionID, fileID).First(&version).Error; err != nil {
		return errors.New("版本不存在")
	}

	// 删除版本存储文件（如果路径与当前文件不同）
	if version.StorePath != file.StorePath {
		s.store.Delete(version.StorePath)
	}

	return model.DB.Delete(&version).Error
}

// GetVersionCount 获取文件版本数量
func (s *VersionService) GetVersionCount(fileID uint) int64 {
	var count int64
	model.DB.Model(&model.FileVersion{}).Where("file_id = ?", fileID).Count(&count)
	return count
}
