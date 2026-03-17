package service

import (
	"errors"
	"nowen-file/model"
	"strings"
)

// TagService 标签服务
type TagService struct{}

// NewTagService 创建标签服务
func NewTagService() *TagService {
	return &TagService{}
}

// ==================== 标签管理 ====================

// CreateTag 创建标签
func (s *TagService) CreateTag(userID uint, name string, color string) (*model.Tag, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, errors.New("标签名称不能为空")
	}
	if len(name) > 64 {
		return nil, errors.New("标签名称过长")
	}

	// 检查同名标签
	var count int64
	model.DB.Model(&model.Tag{}).Where("user_id = ? AND name = ?", userID, name).Count(&count)
	if count > 0 {
		return nil, errors.New("标签名称已存在")
	}

	if color == "" {
		color = "#1890ff"
	}

	tag := &model.Tag{
		UserID: userID,
		Name:   name,
		Color:  color,
	}
	if err := model.DB.Create(tag).Error; err != nil {
		return nil, errors.New("创建标签失败")
	}
	return tag, nil
}

// UpdateTag 更新标签
func (s *TagService) UpdateTag(userID uint, tagID uint, name string, color string) error {
	var tag model.Tag
	if err := model.DB.Where("id = ? AND user_id = ?", tagID, userID).First(&tag).Error; err != nil {
		return errors.New("标签不存在")
	}

	updates := map[string]interface{}{}
	if name = strings.TrimSpace(name); name != "" {
		// 检查同名
		var count int64
		model.DB.Model(&model.Tag{}).Where("user_id = ? AND name = ? AND id != ?", userID, name, tagID).Count(&count)
		if count > 0 {
			return errors.New("标签名称已存在")
		}
		updates["name"] = name
	}
	if color != "" {
		updates["color"] = color
	}

	if len(updates) == 0 {
		return nil
	}

	return model.DB.Model(&tag).Updates(updates).Error
}

// DeleteTag 删除标签（同时清除所有文件的关联）
func (s *TagService) DeleteTag(userID uint, tagID uint) error {
	var tag model.Tag
	if err := model.DB.Where("id = ? AND user_id = ?", tagID, userID).First(&tag).Error; err != nil {
		return errors.New("标签不存在")
	}

	// 删除所有文件与该标签的关联
	model.DB.Where("tag_id = ?", tagID).Delete(&model.FileTag{})

	return model.DB.Delete(&tag).Error
}

// ListTags 获取用户的所有标签（含每个标签的文件数量）
func (s *TagService) ListTags(userID uint) ([]map[string]interface{}, error) {
	var tags []model.Tag
	if err := model.DB.Where("user_id = ?", userID).Order("created_at DESC").Find(&tags).Error; err != nil {
		return nil, errors.New("查询标签列表失败")
	}

	var result []map[string]interface{}
	for _, tag := range tags {
		var fileCount int64
		model.DB.Model(&model.FileTag{}).Where("tag_id = ?", tag.ID).Count(&fileCount)

		result = append(result, map[string]interface{}{
			"id":         tag.ID,
			"name":       tag.Name,
			"color":      tag.Color,
			"file_count": fileCount,
			"created_at": tag.CreatedAt,
		})
	}
	return result, nil
}

// ==================== 文件标签关联 ====================

// TagFile 给文件打标签
func (s *TagService) TagFile(userID uint, fileID uint, tagID uint) error {
	// 验证文件和标签归属
	var file model.FileItem
	if err := model.DB.Where("id = ? AND user_id = ?", fileID, userID).First(&file).Error; err != nil {
		return errors.New("文件不存在")
	}

	var tag model.Tag
	if err := model.DB.Where("id = ? AND user_id = ?", tagID, userID).First(&tag).Error; err != nil {
		return errors.New("标签不存在")
	}

	// 检查是否已关联
	var count int64
	model.DB.Model(&model.FileTag{}).Where("file_id = ? AND tag_id = ?", fileID, tagID).Count(&count)
	if count > 0 {
		return nil // 已关联，不报错
	}

	ft := &model.FileTag{
		FileID: fileID,
		TagID:  tagID,
	}
	return model.DB.Create(ft).Error
}

// UntagFile 取消文件标签
func (s *TagService) UntagFile(userID uint, fileID uint, tagID uint) error {
	// 验证归属
	var file model.FileItem
	if err := model.DB.Where("id = ? AND user_id = ?", fileID, userID).First(&file).Error; err != nil {
		return errors.New("文件不存在")
	}

	result := model.DB.Where("file_id = ? AND tag_id = ?", fileID, tagID).Delete(&model.FileTag{})
	if result.RowsAffected == 0 {
		return errors.New("该文件未添加此标签")
	}
	return result.Error
}

// GetFileTags 获取文件的所有标签
func (s *TagService) GetFileTags(userID uint, fileID uint) ([]model.Tag, error) {
	var fileTags []model.FileTag
	model.DB.Where("file_id = ?", fileID).Find(&fileTags)

	if len(fileTags) == 0 {
		return []model.Tag{}, nil
	}

	tagIDs := make([]uint, len(fileTags))
	for i, ft := range fileTags {
		tagIDs[i] = ft.TagID
	}

	var tags []model.Tag
	if err := model.DB.Where("id IN ? AND user_id = ?", tagIDs, userID).Find(&tags).Error; err != nil {
		return nil, errors.New("查询标签失败")
	}
	return tags, nil
}

// GetFilesByTag 根据标签获取文件列表
func (s *TagService) GetFilesByTag(userID uint, tagID uint) ([]model.FileItem, error) {
	// 验证标签归属
	var tag model.Tag
	if err := model.DB.Where("id = ? AND user_id = ?", tagID, userID).First(&tag).Error; err != nil {
		return nil, errors.New("标签不存在")
	}

	var fileTags []model.FileTag
	model.DB.Where("tag_id = ?", tagID).Find(&fileTags)

	if len(fileTags) == 0 {
		return []model.FileItem{}, nil
	}

	fileIDs := make([]uint, len(fileTags))
	for i, ft := range fileTags {
		fileIDs[i] = ft.FileID
	}

	var files []model.FileItem
	if err := model.DB.Where("id IN ? AND user_id = ? AND is_trash = ?", fileIDs, userID, false).
		Order("is_dir DESC, updated_at DESC").Find(&files).Error; err != nil {
		return nil, errors.New("查询文件列表失败")
	}
	return files, nil
}

// BatchGetFileTags 批量获取文件的标签（用于文件列表显示）
func (s *TagService) BatchGetFileTags(userID uint, fileIDs []uint) map[uint][]model.Tag {
	result := make(map[uint][]model.Tag)

	if len(fileIDs) == 0 {
		return result
	}

	var fileTags []model.FileTag
	model.DB.Where("file_id IN ?", fileIDs).Find(&fileTags)

	if len(fileTags) == 0 {
		return result
	}

	// 收集所有标签ID
	tagIDSet := make(map[uint]bool)
	for _, ft := range fileTags {
		tagIDSet[ft.TagID] = true
	}
	tagIDs := make([]uint, 0, len(tagIDSet))
	for id := range tagIDSet {
		tagIDs = append(tagIDs, id)
	}

	// 查询所有标签
	var tags []model.Tag
	model.DB.Where("id IN ? AND user_id = ?", tagIDs, userID).Find(&tags)

	tagMap := make(map[uint]model.Tag)
	for _, t := range tags {
		tagMap[t.ID] = t
	}

	// 组装结果
	for _, ft := range fileTags {
		if tag, ok := tagMap[ft.TagID]; ok {
			result[ft.FileID] = append(result[ft.FileID], tag)
		}
	}

	return result
}
