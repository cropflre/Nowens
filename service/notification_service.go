package service

import (
	"errors"
	"nowen-file/model"
)

// NotificationService 通知服务
type NotificationService struct{}

// NewNotificationService 创建通知服务
func NewNotificationService() *NotificationService {
	return &NotificationService{}
}

// 通知类型常量
const (
	NotifyShareViewed    = "share_viewed"    // 分享被查看
	NotifyStorageWarning = "storage_warning" // 存储空间告警
	NotifyScanComplete   = "scan_complete"   // 数据源扫描完成
	NotifySystem         = "system"          // 系统通知
)

// CreateNotification 创建通知
func (s *NotificationService) CreateNotification(userID uint, notifyType, title, content string, relatedID uint) error {
	notification := &model.Notification{
		UserID:    userID,
		Type:      notifyType,
		Title:     title,
		Content:   content,
		RelatedID: relatedID,
	}
	return model.DB.Create(notification).Error
}

// ListNotifications 获取通知列表（分页）
func (s *NotificationService) ListNotifications(userID uint, page, pageSize int, onlyUnread bool) ([]model.Notification, int64, error) {
	var notifications []model.Notification
	var total int64

	query := model.DB.Model(&model.Notification{}).Where("user_id = ?", userID)
	if onlyUnread {
		query = query.Where("is_read = ?", false)
	}

	query.Count(&total)

	offset := (page - 1) * pageSize
	if err := query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&notifications).Error; err != nil {
		return nil, 0, errors.New("查询通知列表失败")
	}

	return notifications, total, nil
}

// GetUnreadCount 获取未读通知数量
func (s *NotificationService) GetUnreadCount(userID uint) int64 {
	var count int64
	model.DB.Model(&model.Notification{}).Where("user_id = ? AND is_read = ?", userID, false).Count(&count)
	return count
}

// MarkAsRead 标记单条通知为已读
func (s *NotificationService) MarkAsRead(userID uint, notificationID uint) error {
	result := model.DB.Model(&model.Notification{}).
		Where("id = ? AND user_id = ?", notificationID, userID).
		Update("is_read", true)
	if result.RowsAffected == 0 {
		return errors.New("通知不存在")
	}
	return result.Error
}

// MarkAllAsRead 标记所有通知为已读
func (s *NotificationService) MarkAllAsRead(userID uint) error {
	return model.DB.Model(&model.Notification{}).
		Where("user_id = ? AND is_read = ?", userID, false).
		Update("is_read", true).Error
}

// DeleteNotification 删除通知
func (s *NotificationService) DeleteNotification(userID uint, notificationID uint) error {
	result := model.DB.Where("id = ? AND user_id = ?", notificationID, userID).Delete(&model.Notification{})
	if result.RowsAffected == 0 {
		return errors.New("通知不存在")
	}
	return result.Error
}

// ClearAllNotifications 清空所有通知
func (s *NotificationService) ClearAllNotifications(userID uint) error {
	return model.DB.Where("user_id = ?", userID).Delete(&model.Notification{}).Error
}
