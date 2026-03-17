package service

import (
	"errors"
	"fmt"
	"io"
	"mime"
	"nowen-file/model"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"gorm.io/gorm"
)

// MountService 挂载点/数据源管理服务
type MountService struct {
	scanMutex sync.Map // 每个挂载点的扫描锁，防止并发扫描
}

// NewMountService 创建挂载点服务
func NewMountService() *MountService {
	return &MountService{}
}

// ==================== 挂载点 CRUD ====================

// CreateMount 创建挂载点
func (s *MountService) CreateMount(userID uint, name, mountType, basePath string, extra map[string]string) (*model.MountPoint, error) {
	// 参数校验
	if name == "" {
		return nil, errors.New("名称不能为空")
	}
	if mountType == "" {
		return nil, errors.New("类型不能为空")
	}
	validTypes := map[string]bool{"local": true, "smb": true, "nfs": true, "agent": true}
	if !validTypes[mountType] {
		return nil, errors.New("不支持的挂载类型，可选: local/smb/nfs/agent")
	}
	if basePath == "" {
		return nil, errors.New("路径不能为空")
	}

	// 本地类型：验证路径是否存在
	if mountType == "local" {
		info, err := os.Stat(basePath)
		if err != nil {
			return nil, fmt.Errorf("路径不存在或无法访问: %v", err)
		}
		if !info.IsDir() {
			return nil, errors.New("路径必须是一个目录")
		}
	}

	// 检查同名挂载点
	var count int64
	model.DB.Model(&model.MountPoint{}).Where("user_id = ? AND name = ?", userID, name).Count(&count)
	if count > 0 {
		return nil, errors.New("同名数据源已存在")
	}

	mount := &model.MountPoint{
		UserID:   userID,
		Name:     name,
		Type:     mountType,
		BasePath: basePath,
		Status:   "offline",
	}

	// 根据类型填充额外信息
	if mountType == "agent" {
		mount.AgentID = extra["agent_id"]
		mount.AgentAddr = extra["agent_addr"]
	}
	if mountType == "smb" {
		mount.SmbUser = extra["smb_user"]
		mount.SmbPass = extra["smb_pass"]
	}

	if err := model.DB.Create(mount).Error; err != nil {
		return nil, errors.New("创建数据源失败")
	}

	return mount, nil
}

// ListMounts 获取用户的所有挂载点
func (s *MountService) ListMounts(userID uint) ([]model.MountPoint, error) {
	var mounts []model.MountPoint
	if err := model.DB.Where("user_id = ?", userID).Order("created_at DESC").Find(&mounts).Error; err != nil {
		return nil, errors.New("查询数据源列表失败")
	}
	return mounts, nil
}

// GetMount 获取单个挂载点
func (s *MountService) GetMount(userID uint, mountID uint) (*model.MountPoint, error) {
	var mount model.MountPoint
	if err := model.DB.Where("id = ? AND user_id = ?", mountID, userID).First(&mount).Error; err != nil {
		return nil, errors.New("数据源不存在")
	}
	return &mount, nil
}

// UpdateMount 更新挂载点
func (s *MountService) UpdateMount(userID uint, mountID uint, updates map[string]interface{}) error {
	result := model.DB.Model(&model.MountPoint{}).Where("id = ? AND user_id = ?", mountID, userID).Updates(updates)
	if result.RowsAffected == 0 {
		return errors.New("数据源不存在")
	}
	return result.Error
}

// DeleteMount 删除挂载点（同时删除所有索引文件）
func (s *MountService) DeleteMount(userID uint, mountID uint) error {
	var mount model.MountPoint
	if err := model.DB.Where("id = ? AND user_id = ?", mountID, userID).First(&mount).Error; err != nil {
		return errors.New("数据源不存在")
	}

	// 删除该挂载点的所有索引文件
	model.DB.Where("mount_id = ?", mountID).Delete(&model.IndexedFile{})

	// 删除挂载点
	return model.DB.Delete(&mount).Error
}

// ==================== 目录扫描（本地/SMB/NFS） ====================

// ScanMount 扫描挂载点目录，建立索引
func (s *MountService) ScanMount(userID uint, mountID uint) error {
	// 获取挂载点
	mount, err := s.GetMount(userID, mountID)
	if err != nil {
		return err
	}

	// 防止并发扫描同一挂载点
	if _, loaded := s.scanMutex.LoadOrStore(mountID, true); loaded {
		return errors.New("该数据源正在扫描中，请稍后再试")
	}
	defer s.scanMutex.Delete(mountID)

	// 更新状态为 syncing
	model.DB.Model(mount).Updates(map[string]interface{}{
		"status":   "syncing",
		"sync_msg": "开始扫描...",
	})

	// 根据类型选择扫描策略
	switch mount.Type {
	case "local", "smb", "nfs":
		// 本地和挂载的 SMB/NFS 直接走文件系统扫描
		err = s.scanLocalDirectory(mount)
	case "agent":
		// Agent 类型后续实现
		err = errors.New("Agent 类型暂需等待 Agent 连接后自动同步")
	default:
		err = fmt.Errorf("不支持的扫描类型: %s", mount.Type)
	}

	// 更新扫描结果
	if err != nil {
		model.DB.Model(mount).Updates(map[string]interface{}{
			"status":   "error",
			"sync_msg": err.Error(),
		})
		return err
	}

	// 统计文件数和大小
	var fileCount, dirCount, totalSize int64
	model.DB.Model(&model.IndexedFile{}).Where("mount_id = ? AND is_dir = ?", mount.ID, false).Count(&fileCount)
	model.DB.Model(&model.IndexedFile{}).Where("mount_id = ? AND is_dir = ?", mount.ID, true).Count(&dirCount)
	model.DB.Model(&model.IndexedFile{}).Where("mount_id = ? AND is_dir = ?", mount.ID, false).
		Select("COALESCE(SUM(size), 0)").Scan(&totalSize)

	model.DB.Model(mount).Updates(map[string]interface{}{
		"status":     "online",
		"file_count": fileCount,
		"dir_count":  dirCount,
		"total_size": totalSize,
		"last_sync":  time.Now(),
		"sync_msg":   fmt.Sprintf("扫描完成: %d 个文件, %d 个目录", fileCount, dirCount),
	})

	return nil
}

// scanLocalDirectory 扫描本地目录（也适用于已挂载的 SMB/NFS 路径）
func (s *MountService) scanLocalDirectory(mount *model.MountPoint) error {
	basePath := mount.BasePath

	// 验证路径
	info, err := os.Stat(basePath)
	if err != nil {
		return fmt.Errorf("无法访问路径 %s: %v", basePath, err)
	}
	if !info.IsDir() {
		return fmt.Errorf("路径 %s 不是目录", basePath)
	}

	// 批量操作：先收集，再批量写入
	var batch []model.IndexedFile
	batchSize := 500
	scannedCount := 0

	err = filepath.Walk(basePath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			// 跳过无权限的目录
			return nil
		}

		// 跳过隐藏文件（以 . 开头）
		name := info.Name()
		if strings.HasPrefix(name, ".") && path != basePath {
			if info.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}

		// 跳过根目录本身
		if path == basePath {
			return nil
		}

		// 计算相对路径
		relPath, _ := filepath.Rel(basePath, path)
		relPath = filepath.ToSlash(relPath) // 统一使用正斜杠

		// 计算父目录路径
		parentPath := filepath.ToSlash(filepath.Dir(relPath))
		if parentPath == "." {
			parentPath = ""
		}

		// 检测 MIME 类型
		mimeType := ""
		if !info.IsDir() {
			ext := filepath.Ext(name)
			mimeType = mime.TypeByExtension(ext)
			if mimeType == "" {
				mimeType = "application/octet-stream"
			}
		}

		indexed := model.IndexedFile{
			MountID:    mount.ID,
			UserID:     mount.UserID,
			RemotePath: relPath,
			ParentPath: parentPath,
			Name:       name,
			IsDir:      info.IsDir(),
			Size:       info.Size(),
			MimeType:   mimeType,
			ModTime:    info.ModTime(),
		}

		batch = append(batch, indexed)
		scannedCount++

		// 批量写入
		if len(batch) >= batchSize {
			s.batchUpsertIndexedFiles(mount.ID, batch)
			batch = batch[:0]

			// 更新扫描进度
			model.DB.Model(mount).Update("sync_msg", fmt.Sprintf("扫描中... 已处理 %d 个文件", scannedCount))
		}

		return nil
	})

	// 写入剩余的
	if len(batch) > 0 {
		s.batchUpsertIndexedFiles(mount.ID, batch)
	}

	if err != nil {
		return fmt.Errorf("扫描目录失败: %v", err)
	}

	// 清理已不存在的文件（增量同步）
	s.cleanupStaleFiles(mount)

	return nil
}

// batchUpsertIndexedFiles 批量插入/更新索引文件
func (s *MountService) batchUpsertIndexedFiles(mountID uint, files []model.IndexedFile) {
	for _, f := range files {
		var existing model.IndexedFile
		result := model.DB.Where("mount_id = ? AND remote_path = ?", mountID, f.RemotePath).First(&existing)

		if result.Error == gorm.ErrRecordNotFound {
			// 新文件：插入
			model.DB.Create(&f)
		} else if result.Error == nil {
			// 已存在：更新（如果修改时间变了）
			if !existing.ModTime.Equal(f.ModTime) || existing.Size != f.Size {
				model.DB.Model(&existing).Updates(map[string]interface{}{
					"size":      f.Size,
					"mod_time":  f.ModTime,
					"mime_type": f.MimeType,
					"name":      f.Name,
				})
			}
		}
	}
}

// cleanupStaleFiles 清理已不存在的索引文件
func (s *MountService) cleanupStaleFiles(mount *model.MountPoint) {
	if mount.Type != "local" && mount.Type != "smb" && mount.Type != "nfs" {
		return
	}

	// 查出所有索引文件，检查是否仍存在
	var files []model.IndexedFile
	model.DB.Where("mount_id = ?", mount.ID).Find(&files)

	var staleIDs []uint
	for _, f := range files {
		fullPath := filepath.Join(mount.BasePath, filepath.FromSlash(f.RemotePath))
		if _, err := os.Stat(fullPath); os.IsNotExist(err) {
			staleIDs = append(staleIDs, f.ID)
		}
	}

	if len(staleIDs) > 0 {
		model.DB.Where("id IN ?", staleIDs).Delete(&model.IndexedFile{})
	}
}

// ==================== 索引文件浏览 ====================

// ListIndexedFiles 浏览索引文件（按目录层级）
func (s *MountService) ListIndexedFiles(userID uint, mountID uint, parentPath string, sortBy string, order string) ([]model.IndexedFile, error) {
	// 验证挂载点所有权
	var mount model.MountPoint
	if err := model.DB.Where("id = ? AND user_id = ?", mountID, userID).First(&mount).Error; err != nil {
		return nil, errors.New("数据源不存在")
	}

	var files []model.IndexedFile
	query := model.DB.Where("mount_id = ? AND parent_path = ?", mountID, parentPath)

	// 排序
	orderClause := "is_dir DESC"
	switch sortBy {
	case "name":
		orderClause += ", name"
	case "size":
		orderClause += ", size"
	case "mod_time":
		orderClause += ", mod_time"
	default:
		orderClause += ", name"
	}
	if order == "desc" {
		orderClause += " DESC"
	} else {
		orderClause += " ASC"
	}

	if err := query.Order(orderClause).Find(&files).Error; err != nil {
		return nil, errors.New("查询文件列表失败")
	}

	return files, nil
}

// SearchIndexedFiles 搜索索引文件
func (s *MountService) SearchIndexedFiles(userID uint, keyword string, mountID uint) ([]model.IndexedFile, error) {
	var files []model.IndexedFile
	query := model.DB.Where("user_id = ? AND name LIKE ?", userID, "%"+keyword+"%")

	if mountID > 0 {
		query = query.Where("mount_id = ?", mountID)
	}

	if err := query.Order("is_dir DESC, name ASC").Limit(100).Find(&files).Error; err != nil {
		return nil, errors.New("搜索失败")
	}
	return files, nil
}

// GetIndexedFileBreadcrumb 获取索引文件的面包屑导航
func (s *MountService) GetIndexedFileBreadcrumb(mountID uint, currentPath string) []map[string]string {
	if currentPath == "" || currentPath == "/" {
		return nil
	}

	var breadcrumb []map[string]string
	parts := strings.Split(currentPath, "/")

	accumulated := ""
	for _, part := range parts {
		if part == "" {
			continue
		}
		if accumulated == "" {
			accumulated = part
		} else {
			accumulated = accumulated + "/" + part
		}
		breadcrumb = append(breadcrumb, map[string]string{
			"name": part,
			"path": accumulated,
		})
	}

	return breadcrumb
}

// ==================== 索引文件内容操作 ====================

// GetIndexedFileReader 获取索引文件的内容 Reader（仅本地/SMB/NFS 有效）
func (s *MountService) GetIndexedFileReader(userID uint, fileID uint) (io.ReadCloser, *model.IndexedFile, *model.MountPoint, error) {
	var file model.IndexedFile
	if err := model.DB.Where("id = ? AND user_id = ?", fileID, userID).First(&file).Error; err != nil {
		return nil, nil, nil, errors.New("文件不存在")
	}

	var mount model.MountPoint
	if err := model.DB.First(&mount, file.MountID).Error; err != nil {
		return nil, nil, nil, errors.New("数据源不存在")
	}

	if file.IsDir {
		return nil, nil, nil, errors.New("不能读取目录")
	}

	// 构造完整路径
	fullPath := filepath.Join(mount.BasePath, filepath.FromSlash(file.RemotePath))

	f, err := os.Open(fullPath)
	if err != nil {
		return nil, nil, nil, fmt.Errorf("无法打开文件: %v", err)
	}

	return f, &file, &mount, nil
}

// GetIndexedFileFullPath 获取索引文件的完整磁盘路径
func (s *MountService) GetIndexedFileFullPath(file *model.IndexedFile, mount *model.MountPoint) string {
	return filepath.Join(mount.BasePath, filepath.FromSlash(file.RemotePath))
}

// GetMountStats 获取挂载点统计（按类型分组）
func (s *MountService) GetMountStats(mountID uint) (map[string]interface{}, error) {
	type TypeStat struct {
		MimeType string `json:"mime_type"`
		Total    int64  `json:"total"`
		Count    int64  `json:"count"`
	}

	var stats []TypeStat
	model.DB.Model(&model.IndexedFile{}).
		Select("mime_type, SUM(size) as total, COUNT(*) as count").
		Where("mount_id = ? AND is_dir = ?", mountID, false).
		Group("mime_type").
		Order("total DESC").
		Limit(20).
		Find(&stats)

	return map[string]interface{}{"type_stats": stats}, nil
}
