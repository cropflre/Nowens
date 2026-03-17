package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"nowen-file/model"
	"time"
)

// AgentService 远程 Agent 服务
type AgentService struct {
	client *http.Client
}

// NewAgentService 创建 Agent 服务
func NewAgentService() *AgentService {
	return &AgentService{
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// AgentFileInfo Agent 返回的文件信息
type AgentFileInfo struct {
	Name    string `json:"name"`
	Path    string `json:"path"`
	IsDir   bool   `json:"is_dir"`
	Size    int64  `json:"size"`
	ModTime string `json:"mod_time"`
}

// AgentStatus Agent 状态信息
type AgentStatus struct {
	AgentID   string `json:"agent_id"`
	Version   string `json:"version"`
	Hostname  string `json:"hostname"`
	OS        string `json:"os"`
	Arch      string `json:"arch"`
	Uptime    int64  `json:"uptime"`
	DiskFree  int64  `json:"disk_free"`
	DiskTotal int64  `json:"disk_total"`
	FileCount int64  `json:"file_count"`
}

// PingAgent 检测 Agent 是否在线
func (s *AgentService) PingAgent(agentAddr string) (*AgentStatus, error) {
	url := fmt.Sprintf("http://%s/api/status", agentAddr)
	resp, err := s.client.Get(url)
	if err != nil {
		return nil, fmt.Errorf("无法连接到 Agent: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Agent 返回错误状态: %d", resp.StatusCode)
	}

	var status AgentStatus
	if err := json.NewDecoder(resp.Body).Decode(&status); err != nil {
		return nil, fmt.Errorf("解析 Agent 状态失败: %v", err)
	}

	return &status, nil
}

// ListAgentFiles 列出 Agent 上指定路径的文件
func (s *AgentService) ListAgentFiles(agentAddr, path string) ([]AgentFileInfo, error) {
	url := fmt.Sprintf("http://%s/api/files?path=%s", agentAddr, path)
	resp, err := s.client.Get(url)
	if err != nil {
		return nil, fmt.Errorf("无法连接到 Agent: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("列出文件失败: %s", string(body))
	}

	var files []AgentFileInfo
	if err := json.NewDecoder(resp.Body).Decode(&files); err != nil {
		return nil, fmt.Errorf("解析文件列表失败: %v", err)
	}

	return files, nil
}

// DownloadAgentFile 从 Agent 下载文件
func (s *AgentService) DownloadAgentFile(agentAddr, path string) (io.ReadCloser, string, int64, error) {
	url := fmt.Sprintf("http://%s/api/download?path=%s", agentAddr, path)
	resp, err := s.client.Get(url)
	if err != nil {
		return nil, "", 0, fmt.Errorf("无法连接到 Agent: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		resp.Body.Close()
		return nil, "", 0, fmt.Errorf("下载失败: 状态码 %d", resp.StatusCode)
	}

	contentType := resp.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	return resp.Body, contentType, resp.ContentLength, nil
}

// RegisterAgent 注册/更新 Agent 数据源
func (s *AgentService) RegisterAgent(userID uint, agentID, agentAddr, name string) (*model.MountPoint, error) {
	if agentID == "" || agentAddr == "" {
		return nil, errors.New("Agent ID 和地址不能为空")
	}

	// 验证 Agent 连通性
	status, err := s.PingAgent(agentAddr)
	if err != nil {
		return nil, fmt.Errorf("Agent 不可达: %v", err)
	}

	if name == "" {
		name = fmt.Sprintf("Agent-%s (%s)", status.Hostname, status.OS)
	}

	// 查找是否已注册
	var existing model.MountPoint
	if model.DB.Where("user_id = ? AND agent_id = ?", userID, agentID).First(&existing).Error == nil {
		// 已存在，更新
		model.DB.Model(&existing).Updates(map[string]interface{}{
			"name":       name,
			"agent_addr": agentAddr,
			"status":     "online",
			"sync_msg":   fmt.Sprintf("Agent v%s, %s/%s", status.Version, status.OS, status.Arch),
		})
		return &existing, nil
	}

	// 新建
	mount := &model.MountPoint{
		UserID:    userID,
		Name:      name,
		Type:      "agent",
		BasePath:  "/",
		AgentID:   agentID,
		AgentAddr: agentAddr,
		Status:    "online",
		SyncMsg:   fmt.Sprintf("Agent v%s, %s/%s", status.Version, status.OS, status.Arch),
	}

	if err := model.DB.Create(mount).Error; err != nil {
		return nil, fmt.Errorf("注册 Agent 失败: %v", err)
	}

	return mount, nil
}

// SyncAgentFiles 扫描 Agent 文件并同步索引
func (s *AgentService) SyncAgentFiles(userID, mountID uint) error {
	var mount model.MountPoint
	if err := model.DB.Where("id = ? AND user_id = ? AND type = ?", mountID, userID, "agent").
		First(&mount).Error; err != nil {
		return errors.New("Agent 数据源不存在")
	}

	// 更新状态
	model.DB.Model(&mount).Updates(map[string]interface{}{
		"status":   "syncing",
		"sync_msg": "正在同步...",
	})

	// 递归扫描 Agent 文件
	var totalFiles, totalDirs int64
	var totalSize int64

	// 清除旧索引
	model.DB.Where("mount_id = ?", mountID).Delete(&model.IndexedFile{})

	err := s.scanAgentDir(mount.AgentAddr, mount.BasePath, mountID, userID, &totalFiles, &totalDirs, &totalSize)
	if err != nil {
		model.DB.Model(&mount).Updates(map[string]interface{}{
			"status":   "error",
			"sync_msg": fmt.Sprintf("同步失败: %v", err),
		})
		return err
	}

	model.DB.Model(&mount).Updates(map[string]interface{}{
		"status":     "online",
		"file_count": totalFiles,
		"dir_count":  totalDirs,
		"total_size": totalSize,
		"last_sync":  time.Now(),
		"sync_msg":   fmt.Sprintf("同步完成: %d 个文件, %d 个目录", totalFiles, totalDirs),
	})

	return nil
}

// scanAgentDir 递归扫描 Agent 目录
func (s *AgentService) scanAgentDir(agentAddr, path string, mountID, userID uint, files, dirs, size *int64) error {
	items, err := s.ListAgentFiles(agentAddr, path)
	if err != nil {
		return err
	}

	for _, item := range items {
		indexed := &model.IndexedFile{
			MountID:    mountID,
			UserID:     userID,
			RemotePath: item.Path,
			ParentPath: path,
			Name:       item.Name,
			IsDir:      item.IsDir,
			Size:       item.Size,
		}

		if !item.IsDir {
			*files++
			*size += item.Size
		} else {
			*dirs++
		}

		model.DB.Create(indexed)

		// 递归扫描子目录（限制深度 10 层）
		if item.IsDir {
			// 简单的深度控制
			depth := 0
			for _, ch := range item.Path {
				if ch == '/' || ch == '\\' {
					depth++
				}
			}
			if depth < 10 {
				s.scanAgentDir(agentAddr, item.Path, mountID, userID, files, dirs, size)
			}
		}
	}

	return nil
}
