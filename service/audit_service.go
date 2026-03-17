package service

import (
	"nowen-file/model"
	"time"
)

// AuditService 审计日志服务
type AuditService struct{}

// NewAuditService 创建审计日志服务
func NewAuditService() *AuditService {
	return &AuditService{}
}

// 操作类型常量
const (
	ActionLogin          = "login"
	ActionRegister       = "register"
	ActionUpload         = "upload"
	ActionDownload       = "download"
	ActionDelete         = "delete"
	ActionTrash          = "trash"
	ActionRestore        = "restore"
	ActionRename         = "rename"
	ActionMove           = "move"
	ActionCreateFolder   = "create_folder"
	ActionShare          = "share"
	ActionDeleteShare    = "delete_share"
	ActionVersionRestore = "version_restore"
	ActionBatchDelete    = "batch_delete"
	ActionBatchMove      = "batch_move"
	ActionBatchTrash     = "batch_trash"
	ActionAdminUpdate    = "admin_update"
)

// Log 记录审计日志
func (s *AuditService) Log(userID uint, username, action, resource, detail, ip string) {
	log := &model.AuditLog{
		UserID:    userID,
		Username:  username,
		Action:    action,
		Resource:  resource,
		Detail:    detail,
		IP:        ip,
		CreatedAt: time.Now(),
	}
	model.DB.Create(log)
}

// ListLogs 查询审计日志（分页）
func (s *AuditService) ListLogs(page, pageSize int, userID uint, action string) ([]model.AuditLog, int64, error) {
	var logs []model.AuditLog
	var total int64

	query := model.DB.Model(&model.AuditLog{})

	if userID > 0 {
		query = query.Where("user_id = ?", userID)
	}
	if action != "" {
		query = query.Where("action = ?", action)
	}

	query.Count(&total)

	offset := (page - 1) * pageSize
	if err := query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&logs).Error; err != nil {
		return nil, 0, err
	}

	return logs, total, nil
}

// GetUserLogs 获取指定用户的操作日志
func (s *AuditService) GetUserLogs(userID uint, limit int) ([]model.AuditLog, error) {
	var logs []model.AuditLog
	if err := model.DB.Where("user_id = ?", userID).
		Order("created_at DESC").Limit(limit).Find(&logs).Error; err != nil {
		return nil, err
	}
	return logs, nil
}
