package handler

import (
	"net/http"
	"nowen-file/service"
	"strconv"

	"github.com/gin-gonic/gin"
)

// SyncScheduleHandler 定时同步调度接口
type SyncScheduleHandler struct {
	scheduler *service.CronScheduler
}

// NewSyncScheduleHandler 创建调度接口
func NewSyncScheduleHandler(scheduler *service.CronScheduler) *SyncScheduleHandler {
	return &SyncScheduleHandler{
		scheduler: scheduler,
	}
}

// CreateSchedule 创建定时同步任务
// POST /api/sync-schedules
func (h *SyncScheduleHandler) CreateSchedule(c *gin.Context) {
	userID := GetUserID(c)

	var req struct {
		MountID  uint   `json:"mount_id" binding:"required"`
		CronExpr string `json:"cron_expr" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "参数错误")
		return
	}

	sched, err := h.scheduler.CreateSchedule(userID, req.MountID, req.CronExpr)
	if err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}

	Success(c, sched)
}

// UpdateSchedule 更新定时任务
// PUT /api/sync-schedules/:id
func (h *SyncScheduleHandler) UpdateSchedule(c *gin.Context) {
	userID := GetUserID(c)
	schedID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		Error(c, http.StatusBadRequest, "参数错误")
		return
	}

	var req struct {
		CronExpr string `json:"cron_expr"`
		Enabled  *bool  `json:"enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "参数错误")
		return
	}

	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}

	if err := h.scheduler.UpdateSchedule(userID, uint(schedID), req.CronExpr, enabled); err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}

	SuccessMsg(c, "更新成功")
}

// DeleteSchedule 删除定时任务
// DELETE /api/sync-schedules/:id
func (h *SyncScheduleHandler) DeleteSchedule(c *gin.Context) {
	userID := GetUserID(c)
	schedID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		Error(c, http.StatusBadRequest, "参数错误")
		return
	}

	if err := h.scheduler.DeleteSchedule(userID, uint(schedID)); err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}

	SuccessMsg(c, "删除成功")
}

// ListSchedules 获取定时任务列表
// GET /api/sync-schedules
func (h *SyncScheduleHandler) ListSchedules(c *gin.Context) {
	userID := GetUserID(c)

	schedules, err := h.scheduler.ListSchedules(userID)
	if err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	Success(c, schedules)
}

// GetScheduleByMount 获取指定数据源的定时任务
// GET /api/sync-schedules/mount/:mount_id
func (h *SyncScheduleHandler) GetScheduleByMount(c *gin.Context) {
	mountID, err := strconv.ParseUint(c.Param("mount_id"), 10, 64)
	if err != nil {
		Error(c, http.StatusBadRequest, "参数错误")
		return
	}

	sched, err := h.scheduler.GetScheduleByMount(uint(mountID))
	if err != nil {
		// 没有配置定时任务也不算错
		Success(c, nil)
		return
	}

	Success(c, sched)
}
