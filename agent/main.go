// Nowen-File 远程 Agent
// 部署在远程机器上的轻量级文件管理代理
// 提供文件浏览、下载接口，供主服务远程调用
//
// 使用方式:
//   go build -o nowen-agent ./agent/
//   ./nowen-agent --port=9090 --root=/path/to/share --id=my-agent-001

package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

var (
	port    int
	rootDir string
	agentID string
	startAt time.Time
)

// FileInfo 文件信息
type FileInfo struct {
	Name    string `json:"name"`
	Path    string `json:"path"`
	IsDir   bool   `json:"is_dir"`
	Size    int64  `json:"size"`
	ModTime string `json:"mod_time"`
}

// StatusInfo Agent 状态信息
type StatusInfo struct {
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

func main() {
	flag.IntVar(&port, "port", 9090, "监听端口")
	flag.StringVar(&rootDir, "root", ".", "共享根目录")
	flag.StringVar(&agentID, "id", "", "Agent 唯一标识")
	flag.Parse()

	if agentID == "" {
		hostname, _ := os.Hostname()
		agentID = fmt.Sprintf("agent-%s", hostname)
	}

	// 确保根目录存在
	absRoot, err := filepath.Abs(rootDir)
	if err != nil {
		log.Fatalf("无效的根目录: %v", err)
	}
	rootDir = absRoot

	if _, err := os.Stat(rootDir); os.IsNotExist(err) {
		log.Fatalf("根目录不存在: %s", rootDir)
	}

	startAt = time.Now()

	// 注册路由
	mux := http.NewServeMux()
	mux.HandleFunc("/api/status", handleStatus)
	mux.HandleFunc("/api/files", handleListFiles)
	mux.HandleFunc("/api/download", handleDownload)

	addr := fmt.Sprintf(":%d", port)
	log.Printf("🤖 Nowen-File Agent 启动成功")
	log.Printf("   ID: %s", agentID)
	log.Printf("   根目录: %s", rootDir)
	log.Printf("   监听地址: http://0.0.0.0%s", addr)

	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("启动失败: %v", err)
	}
}

// handleStatus 返回 Agent 状态
func handleStatus(w http.ResponseWriter, r *http.Request) {
	hostname, _ := os.Hostname()

	// 简单统计文件数量
	var fileCount int64
	filepath.Walk(rootDir, func(path string, info os.FileInfo, err error) error {
		if err == nil && !info.IsDir() {
			fileCount++
		}
		return nil
	})

	status := StatusInfo{
		AgentID:   agentID,
		Version:   "1.0.0",
		Hostname:  hostname,
		OS:        runtime.GOOS,
		Arch:      runtime.GOARCH,
		Uptime:    int64(time.Since(startAt).Seconds()),
		FileCount: fileCount,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(status)
}

// handleListFiles 列出目录下的文件
func handleListFiles(w http.ResponseWriter, r *http.Request) {
	reqPath := r.URL.Query().Get("path")
	if reqPath == "" {
		reqPath = "/"
	}

	// 安全检查：防止路径穿越
	fullPath := filepath.Join(rootDir, filepath.Clean(reqPath))
	if !strings.HasPrefix(fullPath, rootDir) {
		http.Error(w, "非法路径", http.StatusForbidden)
		return
	}

	entries, err := os.ReadDir(fullPath)
	if err != nil {
		http.Error(w, fmt.Sprintf("读取目录失败: %v", err), http.StatusInternalServerError)
		return
	}

	var files []FileInfo
	for _, entry := range entries {
		// 跳过隐藏文件
		if strings.HasPrefix(entry.Name(), ".") {
			continue
		}

		info, err := entry.Info()
		if err != nil {
			continue
		}

		relPath := filepath.Join(reqPath, entry.Name())
		// 统一使用正斜杠
		relPath = strings.ReplaceAll(relPath, "\\", "/")

		files = append(files, FileInfo{
			Name:    entry.Name(),
			Path:    relPath,
			IsDir:   entry.IsDir(),
			Size:    info.Size(),
			ModTime: info.ModTime().Format(time.RFC3339),
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(files)
}

// handleDownload 下载文件
func handleDownload(w http.ResponseWriter, r *http.Request) {
	reqPath := r.URL.Query().Get("path")
	if reqPath == "" {
		http.Error(w, "请提供文件路径", http.StatusBadRequest)
		return
	}

	// 安全检查
	fullPath := filepath.Join(rootDir, filepath.Clean(reqPath))
	if !strings.HasPrefix(fullPath, rootDir) {
		http.Error(w, "非法路径", http.StatusForbidden)
		return
	}

	info, err := os.Stat(fullPath)
	if err != nil {
		http.Error(w, "文件不存在", http.StatusNotFound)
		return
	}

	if info.IsDir() {
		http.Error(w, "不能下载目录", http.StatusBadRequest)
		return
	}

	file, err := os.Open(fullPath)
	if err != nil {
		http.Error(w, "打开文件失败", http.StatusInternalServerError)
		return
	}
	defer file.Close()

	// 设置 Content-Type
	ext := filepath.Ext(fullPath)
	contentType := mime.TypeByExtension(ext)
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filepath.Base(fullPath)))
	w.Header().Set("Content-Length", fmt.Sprintf("%d", info.Size()))

	io.Copy(w, file)
}
