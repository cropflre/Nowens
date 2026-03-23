package service

import (
	"errors"
	"log"
	"nowen-file/model"
	"nowen-file/storage"
)

// DedupService 文件去重服务
type DedupService struct {
	storage storage.Storage
}

// NewDedupService 创建去重服务实例
func NewDedupService(store storage.Storage) *DedupService {
	return &DedupService{storage: store}
}

// DuplicateGroup 重复文件组
type DuplicateGroup struct {
	Hash       string           `json:"hash"`
	Size       int64            `json:"size"`
	Count      int              `json:"count"`
	Files      []model.FileItem `json:"files"`
	WastedSize int64            `json:"wasted_size"` // 浪费的空间 = (count-1) * size
}

// DedupStats 去重统计
type DedupStats struct {
	TotalDuplicateGroups int              `json:"total_duplicate_groups"` // 重复组数
	TotalDuplicateFiles  int              `json:"total_duplicate_files"`  // 重复文件总数
	TotalWastedSize      int64            `json:"total_wasted_size"`      // 浪费的总空间
	Groups               []DuplicateGroup `json:"groups"`                 // 重复文件组列表
}

// GetDuplicateFiles 查找用户的重复文件
func (s *DedupService) GetDuplicateFiles(userID uint, page, pageSize int) (*DedupStats, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 50 {
		pageSize = 20
	}

	// 查找有重复哈希的文件（同一哈希出现 2 次以上）
	type HashGroup struct {
		Hash  string
		Size  int64
		Count int
	}

	var hashGroups []HashGroup
	err := model.DB.Model(&model.FileItem{}).
		Select("hash, MAX(size) as size, COUNT(*) as count").
		Where("user_id = ? AND is_dir = ? AND is_trash = ? AND hash != ''", userID, false, false).
		Group("hash").
		Having("COUNT(*) > 1").
		Order("size * (COUNT(*) - 1) DESC"). // 按浪费空间降序
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&hashGroups).Error
	if err != nil {
		return nil, errors.New("查询重复文件失败")
	}

	// 统计总数
	var totalGroups int64
	model.DB.Model(&model.FileItem{}).
		Select("hash").
		Where("user_id = ? AND is_dir = ? AND is_trash = ? AND hash != ''", userID, false, false).
		Group("hash").
		Having("COUNT(*) > 1").
		Count(&totalGroups)

	stats := &DedupStats{
		TotalDuplicateGroups: int(totalGroups),
		Groups:               make([]DuplicateGroup, 0),
	}

	// 获取每组重复文件的详细信息
	for _, hg := range hashGroups {
		var files []model.FileItem
		model.DB.Where("user_id = ? AND hash = ? AND is_dir = ? AND is_trash = ?", userID, hg.Hash, false, false).
			Order("created_at ASC").
			Find(&files)

		group := DuplicateGroup{
			Hash:       hg.Hash,
			Size:       hg.Size,
			Count:      len(files),
			Files:      files,
			WastedSize: int64(len(files)-1) * hg.Size,
		}

		stats.Groups = append(stats.Groups, group)
		stats.TotalDuplicateFiles += len(files)
		stats.TotalWastedSize += group.WastedSize
	}

	return stats, nil
}

// CleanDuplicates 清理重复文件（保留每组中最早的文件，删除其余的）
func (s *DedupService) CleanDuplicates(userID uint, hashList []string) (int, int64, error) {
	if len(hashList) == 0 {
		return 0, 0, errors.New("请指定要清理的文件哈希列表")
	}

	totalDeleted := 0
	totalFreed := int64(0)

	for _, hash := range hashList {
		var files []model.FileItem
		model.DB.Where("user_id = ? AND hash = ? AND is_dir = ? AND is_trash = ?", userID, hash, false, false).
			Order("created_at ASC").
			Find(&files)

		if len(files) <= 1 {
			continue
		}

		// 保留第一个（最早的），删除其余的
		for i := 1; i < len(files); i++ {
			file := files[i]
			// 将重复文件移入回收站
			if err := model.DB.Model(&file).Updates(map[string]interface{}{
				"is_trash":   true,
				"trashed_at": model.DB.NowFunc(),
			}).Error; err != nil {
				log.Printf("[去重清理] 移入回收站失败: %s, err: %v", file.Name, err)
				continue
			}
			totalDeleted++
			totalFreed += file.Size
		}
	}

	return totalDeleted, totalFreed, nil
}

// CleanAllDuplicates 一键清理所有重复文件
func (s *DedupService) CleanAllDuplicates(userID uint) (int, int64, error) {
	// 查找所有重复哈希
	var hashes []string
	model.DB.Model(&model.FileItem{}).
		Select("hash").
		Where("user_id = ? AND is_dir = ? AND is_trash = ? AND hash != ''", userID, false, false).
		Group("hash").
		Having("COUNT(*) > 1").
		Pluck("hash", &hashes)

	if len(hashes) == 0 {
		return 0, 0, nil
	}

	return s.CleanDuplicates(userID, hashes)
}
