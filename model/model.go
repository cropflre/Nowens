package model

import (
	"nowen-file/config"
	"os"
	"path/filepath"
	"time"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

var DB *gorm.DB

// InitDB 初始化数据库连接并自动迁移
func InitDB(cfg *config.Config) error {
	// 确保数据库目录存在
	dir := filepath.Dir(cfg.DBPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	var err error
	DB, err = gorm.Open(sqlite.Open(cfg.DBPath), &gorm.Config{})
	if err != nil {
		return err
	}

	// 自动迁移
	if err := DB.AutoMigrate(&User{}, &FileItem{}, &ShareLink{}, &FileVersion{}, &AuditLog{}, &MountPoint{}, &IndexedFile{}); err != nil {
		return err
	}

	return nil
}

// ==================== 用户模型 ====================

// User 用户
type User struct {
	ID           uint      `gorm:"primarykey" json:"id"`
	Username     string    `gorm:"uniqueIndex;size:64;not null" json:"username"`
	Password     string    `gorm:"size:256;not null" json:"-"` // 密码不返回给前端
	Nickname     string    `gorm:"size:128" json:"nickname"`
	Avatar       string    `gorm:"size:512" json:"avatar"`
	Role         string    `gorm:"size:32;default:user" json:"role"`         // admin / user
	StorageLimit int64     `gorm:"default:10737418240" json:"storage_limit"` // 存储限额，默认10GB
	StorageUsed  int64     `gorm:"default:0" json:"storage_used"`            // 已使用存储
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// ==================== 文件/文件夹模型 ====================

// FileItem 文件或文件夹
type FileItem struct {
	ID        uint       `gorm:"primarykey" json:"id"`
	UUID      string     `gorm:"uniqueIndex;size:36;not null" json:"uuid"` // 唯一标识，用于URL
	UserID    uint       `gorm:"index;not null" json:"user_id"`            // 所属用户
	ParentID  uint       `gorm:"index;default:0" json:"parent_id"`         // 父文件夹ID，0 为根目录
	Name      string     `gorm:"size:512;not null" json:"name"`            // 文件/文件夹名
	IsDir     bool       `gorm:"default:false" json:"is_dir"`              // 是否为文件夹
	Size      int64      `gorm:"default:0" json:"size"`                    // 文件大小（字节）
	MimeType  string     `gorm:"size:256" json:"mime_type"`                // MIME 类型
	StorePath string     `gorm:"size:1024" json:"-"`                       // 磁盘存储路径（不返回前端）
	Hash      string     `gorm:"size:64;index" json:"hash"`                // 文件哈希（用于秒传/去重）
	IsTrash   bool       `gorm:"default:false;index" json:"is_trash"`      // 是否在回收站
	TrashedAt *time.Time `json:"trashed_at,omitempty"`                     // 删除时间
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
}

// ==================== 分享链接模型 ====================

// ShareLink 文件分享链接
type ShareLink struct {
	ID            uint       `gorm:"primarykey" json:"id"`
	Code          string     `gorm:"uniqueIndex;size:16;not null" json:"code"` // 分享码
	FileID        uint       `gorm:"index;not null" json:"file_id"`            // 分享的文件ID
	UserID        uint       `gorm:"index;not null" json:"user_id"`            // 创建者
	Password      string     `gorm:"size:32" json:"-"`                         // 提取密码（可选）
	ExpireAt      *time.Time `json:"expire_at,omitempty"`                      // 过期时间（可选）
	ViewCount     int        `gorm:"default:0" json:"view_count"`              // 查看次数
	DownloadCount int        `gorm:"default:0" json:"download_count"`          // 下载次数
	CreatedAt     time.Time  `json:"created_at"`
}

// ==================== 文件版本模型 ====================

// FileVersion 文件历史版本
type FileVersion struct {
	ID        uint      `gorm:"primarykey" json:"id"`
	FileID    uint      `gorm:"index;not null" json:"file_id"` // 关联的文件ID
	UserID    uint      `gorm:"index;not null" json:"user_id"` // 上传者
	Version   int       `gorm:"not null" json:"version"`       // 版本号（从1开始递增）
	Size      int64     `gorm:"default:0" json:"size"`         // 文件大小
	StorePath string    `gorm:"size:1024" json:"-"`            // 存储路径
	Hash      string    `gorm:"size:64" json:"hash"`           // 文件哈希
	Comment   string    `gorm:"size:512" json:"comment"`       // 版本备注
	CreatedAt time.Time `json:"created_at"`
}

// ==================== 操作审计日志模型 ====================

// AuditLog 操作审计日志
type AuditLog struct {
	ID        uint      `gorm:"primarykey" json:"id"`
	UserID    uint      `gorm:"index;not null" json:"user_id"`        // 操作者
	Username  string    `gorm:"size:64" json:"username"`              // 操作者用户名
	Action    string    `gorm:"size:64;not null;index" json:"action"` // 操作类型
	Resource  string    `gorm:"size:64" json:"resource"`              // 资源类型 file/folder/share/user
	Detail    string    `gorm:"size:1024" json:"detail"`              // 操作详情
	IP        string    `gorm:"size:64" json:"ip"`                    // 操作IP
	CreatedAt time.Time `gorm:"index" json:"created_at"`
}

// ==================== 挂载点/数据源模型 ====================

// MountPoint 挂载点（映射的外部文件系统）
type MountPoint struct {
	ID        uint      `gorm:"primarykey" json:"id"`
	UserID    uint      `gorm:"index;not null" json:"user_id"`           // 所属用户
	Name      string    `gorm:"size:256;not null" json:"name"`           // 显示名称: "我的NAS", "办公电脑D盘"
	Type      string    `gorm:"size:32;not null" json:"type"`            // 类型: local / smb / nfs / agent
	BasePath  string    `gorm:"size:1024;not null" json:"base_path"`     // 挂载/扫描根路径
	AgentID   string    `gorm:"size:64;index" json:"agent_id,omitempty"` // Agent 唯一标识（agent类型时使用）
	AgentAddr string    `gorm:"size:256" json:"agent_addr,omitempty"`    // Agent 地址 host:port
	SmbUser   string    `gorm:"size:128" json:"smb_user,omitempty"`      // SMB 用户名（smb类型时使用）
	SmbPass   string    `gorm:"size:256" json:"-"`                       // SMB 密码（不返回前端）
	Status    string    `gorm:"size:32;default:offline" json:"status"`   // online / offline / syncing / error
	FileCount int64     `gorm:"default:0" json:"file_count"`             // 索引文件总数
	DirCount  int64     `gorm:"default:0" json:"dir_count"`              // 索引目录总数
	TotalSize int64     `gorm:"default:0" json:"total_size"`             // 总大小（字节）
	LastSync  time.Time `json:"last_sync"`                               // 最后同步时间
	SyncMsg   string    `gorm:"size:512" json:"sync_msg,omitempty"`      // 同步状态消息
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// ==================== 索引文件模型 ====================

// IndexedFile 索引文件（映射的外部文件，只存元数据不存实际内容）
type IndexedFile struct {
	ID         uint      `gorm:"primarykey" json:"id"`
	MountID    uint      `gorm:"index;not null" json:"mount_id"`              // 所属挂载点
	UserID     uint      `gorm:"index;not null" json:"user_id"`               // 所属用户
	RemotePath string    `gorm:"size:2048;not null;index" json:"remote_path"` // 远程完整路径
	ParentPath string    `gorm:"size:2048;index" json:"parent_path"`          // 父目录路径（用于层级浏览）
	Name       string    `gorm:"size:512;not null;index" json:"name"`         // 文件/目录名
	IsDir      bool      `gorm:"default:false;index" json:"is_dir"`           // 是否为目录
	Size       int64     `gorm:"default:0" json:"size"`                       // 文件大小（字节）
	MimeType   string    `gorm:"size:256" json:"mime_type"`                   // MIME 类型
	Hash       string    `gorm:"size:64;index" json:"hash,omitempty"`         // 文件哈希（可选，用于去重）
	ModTime    time.Time `json:"mod_time"`                                    // 文件修改时间
	CreatedAt  time.Time `json:"created_at"`                                  // 首次索引时间
	UpdatedAt  time.Time `json:"updated_at"`                                  // 最近更新时间
}
