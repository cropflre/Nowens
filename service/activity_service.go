package service

import (
	"nowen-file/model"
)

// ActivityService 活动流服务
type ActivityService struct{}

// NewActivityService 创建活动流服务
func NewActivityService() *ActivityService {
	return &ActivityService{}
}

// RecordActivity 记录一条活动
func (s *ActivityService) RecordActivity(userID uint, username, action, targetType string, targetID uint, targetName, detail string) {
	activity := &model.Activity{
		UserID:     userID,
		Username:   username,
		Action:     action,
		TargetType: targetType,
		TargetID:   targetID,
		TargetName: targetName,
		Detail:     detail,
	}
	model.DB.Create(activity)
}

// ListActivities 查询用户活动流（分页）
func (s *ActivityService) ListActivities(userID uint, page, pageSize int) ([]model.Activity, int64, error) {
	var total int64
	model.DB.Model(&model.Activity{}).Where("user_id = ?", userID).Count(&total)

	var activities []model.Activity
	offset := (page - 1) * pageSize
	err := model.DB.Where("user_id = ?", userID).
		Order("created_at DESC").
		Offset(offset).Limit(pageSize).
		Find(&activities).Error

	return activities, total, err
}

// ListAllActivities 查询所有活动（管理员用，分页）
func (s *ActivityService) ListAllActivities(page, pageSize int) ([]model.Activity, int64, error) {
	var total int64
	model.DB.Model(&model.Activity{}).Count(&total)

	var activities []model.Activity
	offset := (page - 1) * pageSize
	err := model.DB.Order("created_at DESC").
		Offset(offset).Limit(pageSize).
		Find(&activities).Error

	return activities, total, err
}
