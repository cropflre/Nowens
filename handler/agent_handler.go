package handler

import (
	"net/http"
	"nowen-file/model"
	"nowen-file/service"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// AgentHandler 远程 Agent 接口
type AgentHandler struct {
	agentService *service.AgentService
}

// NewAgentHandler 创建 Agent 接口
func NewAgentHandler() *AgentHandler {
	return &AgentHandler{
		agentService: service.NewAgentService(),
	}
}

// RegisterAgent 注册 Agent
// POST /api/agents/register
func (h *AgentHandler) RegisterAgent(c *gin.Context) {
	userID := GetUserID(c)

	var req struct {
		AgentID   string `json:"agent_id" binding:"required"`
		AgentAddr string `json:"agent_addr" binding:"required"`
		Name      string `json:"name"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "请提供 Agent ID 和地址")
		return
	}

	mount, err := h.agentService.RegisterAgent(userID, req.AgentID, req.AgentAddr, req.Name)
	if err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}

	Success(c, mount)
}

// PingAgent 检测 Agent 状态
// POST /api/agents/ping
func (h *AgentHandler) PingAgent(c *gin.Context) {
	var req struct {
		AgentAddr string `json:"agent_addr" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "请提供 Agent 地址")
		return
	}

	status, err := h.agentService.PingAgent(req.AgentAddr)
	if err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}

	Success(c, status)
}

// ListAgentFiles 浏览 Agent 文件
// GET /api/agents/:mount_id/files?path=/
func (h *AgentHandler) ListAgentFiles(c *gin.Context) {
	mountID := parseUintParam(c, "mount_id")
	path := c.DefaultQuery("path", "/")

	var mount struct {
		AgentAddr string
	}
	if err := model_db().Where("id = ? AND type = ?", mountID, "agent").
		Select("agent_addr").First(&mount).Error; err != nil {
		Error(c, http.StatusNotFound, "Agent 数据源不存在")
		return
	}

	files, err := h.agentService.ListAgentFiles(mount.AgentAddr, path)
	if err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	Success(c, files)
}

// DownloadAgentFile 从 Agent 下载文件
// GET /api/agents/:mount_id/download?path=/xxx
func (h *AgentHandler) DownloadAgentFile(c *gin.Context) {
	mountID := parseUintParam(c, "mount_id")
	path := c.Query("path")
	if path == "" {
		Error(c, http.StatusBadRequest, "请提供文件路径")
		return
	}

	var mount struct {
		AgentAddr string
	}
	if err := model_db().Where("id = ? AND type = ?", mountID, "agent").
		Select("agent_addr").First(&mount).Error; err != nil {
		Error(c, http.StatusNotFound, "Agent 数据源不存在")
		return
	}

	body, contentType, contentLength, err := h.agentService.DownloadAgentFile(mount.AgentAddr, path)
	if err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	defer body.Close()

	c.DataFromReader(http.StatusOK, contentLength, contentType, body, nil)
}

// SyncAgentFiles 同步 Agent 文件索引
// POST /api/agents/:mount_id/sync
func (h *AgentHandler) SyncAgentFiles(c *gin.Context) {
	userID := GetUserID(c)
	mountID := parseUintParam(c, "mount_id")

	go func() {
		h.agentService.SyncAgentFiles(userID, mountID)
	}()

	SuccessMsg(c, "开始同步 Agent 文件索引")
}

// model_db 获取数据库实例的辅助函数
func model_db() *gorm.DB {
	return model.DB.Model(&model.MountPoint{})
}
