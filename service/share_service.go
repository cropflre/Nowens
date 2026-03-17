package service

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"nowen-file/model"
	"time"

	"gorm.io/gorm"
)

// ShareService 分享服务
type ShareService struct{}

// NewShareService 创建分享服务实例
func NewShareService() *ShareService {
	return &ShareService{}
}

// CreateShare 创建分享链接
func (s *ShareService) CreateShare(userID uint, fileID uint, password string, expireDays int) (*model.ShareLink, error) {
	// 检查文件是否存在且属于该用户
	var file model.FileItem
	if err := model.DB.Where("id = ? AND user_id = ?", fileID, userID).First(&file).Error; err != nil {
		return nil, errors.New("文件不存在")
	}

	// 生成分享码
	code, err := generateShareCode()
	if err != nil {
		return nil, errors.New("生成分享码失败")
	}

	share := &model.ShareLink{
		Code:   code,
		FileID: fileID,
		UserID: userID,
	}

	// 设置密码
	if password != "" {
		share.Password = password
	}

	// 设置过期时间
	if expireDays > 0 {
		expire := time.Now().AddDate(0, 0, expireDays)
		share.ExpireAt = &expire
	}

	if err := model.DB.Create(share).Error; err != nil {
		return nil, errors.New("创建分享链接失败")
	}

	return share, nil
}

// GetShare 获取分享信息
func (s *ShareService) GetShare(code string) (*model.ShareLink, *model.FileItem, error) {
	var share model.ShareLink
	if err := model.DB.Where("code = ?", code).First(&share).Error; err != nil {
		return nil, nil, errors.New("分享链接不存在")
	}

	// 检查是否过期
	if share.ExpireAt != nil && share.ExpireAt.Before(time.Now()) {
		return nil, nil, errors.New("分享链接已过期")
	}

	// 获取文件信息
	var file model.FileItem
	if err := model.DB.First(&file, share.FileID).Error; err != nil {
		return nil, nil, errors.New("分享的文件不存在")
	}

	// 更新查看次数
	model.DB.Model(&share).Update("view_count", share.ViewCount+1)

	return &share, &file, nil
}

// VerifySharePassword 验证分享密码
func (s *ShareService) VerifySharePassword(code, password string) bool {
	var share model.ShareLink
	if err := model.DB.Where("code = ?", code).First(&share).Error; err != nil {
		return false
	}
	return share.Password == "" || share.Password == password
}

// DeleteShare 删除分享链接
func (s *ShareService) DeleteShare(userID uint, shareID uint) error {
	result := model.DB.Where("id = ? AND user_id = ?", shareID, userID).Delete(&model.ShareLink{})
	if result.RowsAffected == 0 {
		return errors.New("分享链接不存在")
	}
	return result.Error
}

// ListUserShares 获取用户的分享列表
func (s *ShareService) ListUserShares(userID uint) ([]model.ShareLink, error) {
	var shares []model.ShareLink
	if err := model.DB.Where("user_id = ?", userID).Order("created_at DESC").Find(&shares).Error; err != nil {
		return nil, errors.New("查询分享列表失败")
	}
	return shares, nil
}

// IncrementDownloadCount 增加下载次数
func (s *ShareService) IncrementDownloadCount(shareID uint) {
	model.DB.Model(&model.ShareLink{}).Where("id = ?", shareID).
		Update("download_count", gorm.Expr("download_count + 1"))
}

// generateShareCode 生成随机分享码
func generateShareCode() (string, error) {
	bytes := make([]byte, 4)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}
