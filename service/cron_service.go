package service

import (
	"fmt"
	"log"
	"nowen-file/model"
	"strings"
	"sync"
	"time"
)

// CronScheduler 定时同步调度器
type CronScheduler struct {
	mountService        *MountService
	notificationService *NotificationService
	stopChan            chan struct{}
	wg                  sync.WaitGroup
	running             bool
	mu                  sync.Mutex

	// 回收站清理和分片清理所需服务
	fileService        *FileService
	chunkUploadService *ChunkUploadService
}

// NewCronScheduler 创建调度器
func NewCronScheduler() *CronScheduler {
	return &CronScheduler{
		mountService:        NewMountService(),
		notificationService: NewNotificationService(),
		stopChan:            make(chan struct{}),
	}
}

// SetFileService 设置文件服务（用于回收站自动清理）
func (c *CronScheduler) SetFileService(fs *FileService) {
	c.fileService = fs
}

// SetChunkUploadService 设置分片上传服务（用于清理过期分片）
func (c *CronScheduler) SetChunkUploadService(cs *ChunkUploadService) {
	c.chunkUploadService = cs
}

// Start 启动调度器（后台协程，每分钟检查一次是否有任务需要执行）
func (c *CronScheduler) Start() {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.running {
		return
	}
	c.running = true

	c.wg.Add(1)
	go func() {
		defer c.wg.Done()
		ticker := time.NewTicker(1 * time.Minute)
		defer ticker.Stop()

		// 回收站清理定时器（每 6 小时执行一次）
		trashTicker := time.NewTicker(6 * time.Hour)
		defer trashTicker.Stop()

		log.Println("⏰ 定时同步调度器已启动")
		log.Println("🗑️ 回收站自动清理已启用（30 天过期，每 6 小时检查）")

		// 启动时立即执行一次清理
		go c.runCleanupTasks()

		for {
			select {
			case <-ticker.C:
				c.checkAndRun()
			case <-trashTicker.C:
				go c.runCleanupTasks()
			case <-c.stopChan:
				log.Println("⏰ 定时同步调度器已停止")
				return
			}
		}
	}()
}

// Stop 停止调度器
func (c *CronScheduler) Stop() {
	c.mu.Lock()
	defer c.mu.Unlock()

	if !c.running {
		return
	}
	close(c.stopChan)
	c.wg.Wait()
	c.running = false
}

// checkAndRun 检查并执行到期的任务
func (c *CronScheduler) checkAndRun() {
	var schedules []model.SyncSchedule
	now := time.Now()

	// 查找已启用且下次执行时间 <= 现在的任务
	model.DB.Where("enabled = ? AND next_run IS NOT NULL AND next_run <= ?", true, now).
		Find(&schedules)

	for _, sched := range schedules {
		go c.executeSync(sched)
	}
}

// executeSync 执行同步任务
func (c *CronScheduler) executeSync(sched model.SyncSchedule) {
	log.Printf("⏰ 开始执行定时同步: mount_id=%d, user_id=%d", sched.MountID, sched.UserID)

	now := time.Now()
	// 更新上次执行时间
	model.DB.Model(&sched).Update("last_run", now)

	// 执行扫描
	err := c.mountService.ScanMount(sched.UserID, sched.MountID)
	if err != nil {
		log.Printf("⏰ 定时同步失败: mount_id=%d, err=%v", sched.MountID, err)
		c.notificationService.CreateNotification(
			sched.UserID, NotifyScanComplete,
			"定时同步失败",
			fmt.Sprintf("数据源定时同步失败: %v", err),
			sched.MountID,
		)
	} else {
		log.Printf("⏰ 定时同步完成: mount_id=%d", sched.MountID)
		c.notificationService.CreateNotification(
			sched.UserID, NotifyScanComplete,
			"定时同步完成",
			"数据源定时同步已完成，文件索引已更新",
			sched.MountID,
		)
	}

	// 计算下次执行时间
	nextRun := CalcNextRun(sched.CronExpr, now)
	if nextRun != nil {
		model.DB.Model(&sched).Update("next_run", nextRun)
	}
}

// ==================== Cron 表达式解析（简化版） ====================

// 支持格式: "分 时 日 月 周" (5 段)
// 支持: * / 数字 / */N

// CalcNextRun 根据 cron 表达式计算下次执行时间
func CalcNextRun(cronExpr string, from time.Time) *time.Time {
	parts := strings.Fields(cronExpr)
	if len(parts) != 5 {
		return nil
	}

	// 简化实现：支持常见场景
	minutePart := parts[0]
	hourPart := parts[1]

	// 计算分钟
	minute := -1
	interval := 0

	if minutePart == "*" {
		minute = 0
		interval = 1 // 每分钟（但我们以小时为粒度来算）
	} else if strings.HasPrefix(minutePart, "*/") {
		fmt.Sscanf(minutePart, "*/%d", &interval)
		if interval <= 0 {
			interval = 60
		}
	} else {
		fmt.Sscanf(minutePart, "%d", &minute)
	}

	// 计算小时间隔
	hourInterval := 0
	hour := -1
	if hourPart == "*" {
		// 每小时
		hourInterval = 1
	} else if strings.HasPrefix(hourPart, "*/") {
		fmt.Sscanf(hourPart, "*/%d", &hourInterval)
	} else {
		fmt.Sscanf(hourPart, "%d", &hour)
	}

	next := from.Add(1 * time.Minute)
	next = time.Date(next.Year(), next.Month(), next.Day(), next.Hour(), next.Minute(), 0, 0, next.Location())

	// 简化策略：往后搜索最多 48 小时
	for i := 0; i < 2880; i++ {
		candidate := next.Add(time.Duration(i) * time.Minute)

		minuteMatch := false
		if interval > 0 && minutePart != "*" {
			minuteMatch = candidate.Minute()%interval == 0
		} else if minute >= 0 {
			minuteMatch = candidate.Minute() == minute
		} else {
			minuteMatch = true
		}

		hourMatch := false
		if hourInterval > 0 {
			hourMatch = candidate.Hour()%hourInterval == 0
		} else if hour >= 0 {
			hourMatch = candidate.Hour() == hour
		} else {
			hourMatch = true
		}

		if minuteMatch && hourMatch {
			return &candidate
		}
	}

	// 默认 1 小时后
	fallback := from.Add(1 * time.Hour)
	return &fallback
}

// ==================== 调度管理 CRUD ====================

// CreateSchedule 创建定时同步任务
func (c *CronScheduler) CreateSchedule(userID uint, mountID uint, cronExpr string) (*model.SyncSchedule, error) {
	// 验证挂载点
	var mount model.MountPoint
	if err := model.DB.Where("id = ? AND user_id = ?", mountID, userID).First(&mount).Error; err != nil {
		return nil, fmt.Errorf("数据源不存在")
	}

	// 检查是否已有调度
	var count int64
	model.DB.Model(&model.SyncSchedule{}).Where("mount_id = ?", mountID).Count(&count)
	if count > 0 {
		return nil, fmt.Errorf("该数据源已有定时任务，请先删除旧任务")
	}

	// 验证 cron 表达式
	parts := strings.Fields(cronExpr)
	if len(parts) != 5 {
		return nil, fmt.Errorf("无效的 Cron 表达式，需要 5 段（分 时 日 月 周）")
	}

	nextRun := CalcNextRun(cronExpr, time.Now())

	sched := &model.SyncSchedule{
		MountID:  mountID,
		UserID:   userID,
		CronExpr: cronExpr,
		Enabled:  true,
		NextRun:  nextRun,
	}

	if err := model.DB.Create(sched).Error; err != nil {
		return nil, fmt.Errorf("创建定时任务失败")
	}

	return sched, nil
}

// UpdateSchedule 更新定时任务
func (c *CronScheduler) UpdateSchedule(userID uint, schedID uint, cronExpr string, enabled bool) error {
	var sched model.SyncSchedule
	if err := model.DB.Where("id = ? AND user_id = ?", schedID, userID).First(&sched).Error; err != nil {
		return fmt.Errorf("任务不存在")
	}

	updates := map[string]interface{}{
		"enabled": enabled,
	}

	if cronExpr != "" {
		parts := strings.Fields(cronExpr)
		if len(parts) != 5 {
			return fmt.Errorf("无效的 Cron 表达式")
		}
		updates["cron_expr"] = cronExpr
		nextRun := CalcNextRun(cronExpr, time.Now())
		updates["next_run"] = nextRun
	}

	return model.DB.Model(&sched).Updates(updates).Error
}

// DeleteSchedule 删除定时任务
func (c *CronScheduler) DeleteSchedule(userID uint, schedID uint) error {
	result := model.DB.Where("id = ? AND user_id = ?", schedID, userID).Delete(&model.SyncSchedule{})
	if result.RowsAffected == 0 {
		return fmt.Errorf("任务不存在")
	}
	return result.Error
}

// ListSchedules 获取用户的定时任务列表
func (c *CronScheduler) ListSchedules(userID uint) ([]model.SyncSchedule, error) {
	var schedules []model.SyncSchedule
	if err := model.DB.Where("user_id = ?", userID).Order("created_at DESC").Find(&schedules).Error; err != nil {
		return nil, fmt.Errorf("查询定时任务失败")
	}
	return schedules, nil
}

// GetScheduleByMount 根据挂载点获取定时任务
func (c *CronScheduler) GetScheduleByMount(mountID uint) (*model.SyncSchedule, error) {
	var sched model.SyncSchedule
	if err := model.DB.Where("mount_id = ?", mountID).First(&sched).Error; err != nil {
		return nil, fmt.Errorf("未找到定时任务")
	}
	return &sched, nil
}

// runCleanupTasks 执行清理任务（回收站 + 过期分片上传）
func (c *CronScheduler) runCleanupTasks() {
	// 清理超过 30 天的回收站文件
	if c.fileService != nil {
		deleted := c.fileService.CleanExpiredTrash(30)
		if deleted > 0 {
			log.Printf("🗑️ 回收站自动清理完成，删除 %d 个过期文件", deleted)
		}
	}

	// 清理超过 24 小时的未完成分片上传
	if c.chunkUploadService != nil {
		c.chunkUploadService.CleanExpiredUploads()
	}
}
