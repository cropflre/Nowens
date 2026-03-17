package service

import (
	"errors"
	"nowen-file/model"
)

// FavoriteService 收藏夹服务
type FavoriteService struct{}

// NewFavoriteService 创建收藏夹服务
func NewFavoriteService() *FavoriteService {
	return &FavoriteService{}
}

// AddFavorite 添加收藏
func (s *FavoriteService) AddFavorite(userID uint, fileID uint) error {
	// 验证文件存在且属于该用户
	var file model.FileItem
	if err := model.DB.Where("id = ? AND user_id = ? AND is_trash = ?", fileID, userID, false).
		First(&file).Error; err != nil {
		return errors.New("文件不存在")
	}

	// 检查是否已收藏
	var count int64
	model.DB.Model(&model.Favorite{}).Where("user_id = ? AND file_id = ?", userID, fileID).Count(&count)
	if count > 0 {
		return errors.New("已经收藏过了")
	}

	fav := &model.Favorite{
		UserID: userID,
		FileID: fileID,
	}
	return model.DB.Create(fav).Error
}

// RemoveFavorite 取消收藏
func (s *FavoriteService) RemoveFavorite(userID uint, fileID uint) error {
	result := model.DB.Where("user_id = ? AND file_id = ?", userID, fileID).Delete(&model.Favorite{})
	if result.RowsAffected == 0 {
		return errors.New("未收藏该文件")
	}
	return result.Error
}

// ListFavorites 获取收藏列表（关联查询文件详情）
func (s *FavoriteService) ListFavorites(userID uint) ([]map[string]interface{}, error) {
	var favorites []model.Favorite
	if err := model.DB.Where("user_id = ?", userID).Order("created_at DESC").Find(&favorites).Error; err != nil {
		return nil, errors.New("查询收藏列表失败")
	}

	var result []map[string]interface{}
	for _, fav := range favorites {
		var file model.FileItem
		if err := model.DB.First(&file, fav.FileID).Error; err != nil {
			continue // 跳过已删除的文件
		}
		// 跳过在回收站中的文件
		if file.IsTrash {
			continue
		}
		result = append(result, map[string]interface{}{
			"id":         fav.ID,
			"file_id":    fav.FileID,
			"file":       file,
			"created_at": fav.CreatedAt,
		})
	}

	return result, nil
}

// IsFavorited 检查是否已收藏
func (s *FavoriteService) IsFavorited(userID uint, fileID uint) bool {
	var count int64
	model.DB.Model(&model.Favorite{}).Where("user_id = ? AND file_id = ?", userID, fileID).Count(&count)
	return count > 0
}

// BatchCheckFavorited 批量检查收藏状态
func (s *FavoriteService) BatchCheckFavorited(userID uint, fileIDs []uint) map[uint]bool {
	var favorites []model.Favorite
	model.DB.Where("user_id = ? AND file_id IN ?", userID, fileIDs).Find(&favorites)

	result := make(map[uint]bool)
	for _, fav := range favorites {
		result[fav.FileID] = true
	}
	return result
}
