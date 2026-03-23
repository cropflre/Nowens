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
	if err := DB.AutoMigrate(&User{}, &FileItem{}, &ShareLink{}, &FileVersion{}, &AuditLog{}, &MountPoint{}, &IndexedFile{}, &Favorite{}, &Tag{}, &FileTag{}, &Notification{}, &SyncSchedule{}, &Workspace{}, &WorkspaceMember{}, &FolderPermission{}, &ChunkUpload{}, &Comment{}, &Activity{}, &WebhookConfig{}, &UserMFA{}); err != nil {
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
	ID          uint       `gorm:"primarykey" json:"id"`
	UUID        string     `gorm:"uniqueIndex;size:36;not null" json:"uuid"` // 唯一标识，用于URL
	UserID      uint       `gorm:"index;not null" json:"user_id"`            // 所属用户
	ParentID    uint       `gorm:"index;default:0" json:"parent_id"`         // 父文件夹ID，0 为根目录
	Name        string     `gorm:"size:512;not null" json:"name"`            // 文件/文件夹名
	IsDir       bool       `gorm:"default:false" json:"is_dir"`              // 是否为文件夹
	Size        int64      `gorm:"default:0" json:"size"`                    // 文件大小（字节）
	MimeType    string     `gorm:"size:256" json:"mime_type"`                // MIME 类型
	StorePath   string     `gorm:"size:1024" json:"-"`                       // 磁盘存储路径（不返回前端）
	Hash        string     `gorm:"size:64;index" json:"hash"`                // 文件哈希（用于秒传/去重）
	IsTrash     bool       `gorm:"default:false;index" json:"is_trash"`      // 是否在回收站
	IsEncrypted bool       `gorm:"default:false" json:"is_encrypted"`        // 是否加密存储
	IsStarred   bool       `gorm:"default:false;index" json:"is_starred"`    // 是否星标
	IsArchived  bool       `gorm:"default:false;index" json:"is_archived"`   // 是否归档
	TrashedAt   *time.Time `json:"trashed_at,omitempty"`                     // 删除时间
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
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

// ==================== 收藏夹模型 ====================

// Favorite 用户收藏
type Favorite struct {
	ID        uint      `gorm:"primarykey" json:"id"`
	UserID    uint      `gorm:"uniqueIndex:idx_user_file;not null" json:"user_id"` // 所属用户
	FileID    uint      `gorm:"uniqueIndex:idx_user_file;not null" json:"file_id"` // 收藏的文件/文件夹ID
	CreatedAt time.Time `json:"created_at"`
}

// ==================== 标签模型 ====================

// Tag 标签
type Tag struct {
	ID        uint      `gorm:"primarykey" json:"id"`
	UserID    uint      `gorm:"index;not null" json:"user_id"`        // 所属用户
	Name      string    `gorm:"size:64;not null" json:"name"`         // 标签名称
	Color     string    `gorm:"size:16;default:#1890ff" json:"color"` // 标签颜色
	CreatedAt time.Time `json:"created_at"`
}

// FileTag 文件-标签关联（多对多）
type FileTag struct {
	ID     uint `gorm:"primarykey" json:"id"`
	FileID uint `gorm:"uniqueIndex:idx_file_tag;not null" json:"file_id"` // 文件ID
	TagID  uint `gorm:"uniqueIndex:idx_file_tag;not null" json:"tag_id"`  // 标签ID
}

// ==================== 通知模型 ====================

// Notification 用户通知
type Notification struct {
	ID        uint      `gorm:"primarykey" json:"id"`
	UserID    uint      `gorm:"index;not null" json:"user_id"`      // 接收者
	Type      string    `gorm:"size:32;not null;index" json:"type"` // 通知类型: share_viewed / storage_warning / scan_complete / system
	Title     string    `gorm:"size:256;not null" json:"title"`     // 通知标题
	Content   string    `gorm:"size:1024" json:"content"`           // 通知内容
	IsRead    bool      `gorm:"default:false;index" json:"is_read"` // 是否已读
	RelatedID uint      `gorm:"default:0" json:"related_id"`        // 关联资源ID
	CreatedAt time.Time `gorm:"index" json:"created_at"`
}

// ==================== 定时同步调度模型 ====================

// ==================== 协作空间模型 ====================

// Workspace 协作空间（团队文件管理）
type Workspace struct {
	ID          uint      `gorm:"primarykey" json:"id"`
	OwnerID     uint      `gorm:"index;not null" json:"owner_id"` // 创建者/拥有者
	Name        string    `gorm:"size:128;not null" json:"name"`  // 空间名称
	Description string    `gorm:"size:512" json:"description"`    // 空间描述
	Icon        string    `gorm:"size:32;default:📁" json:"icon"`  // 图标 emoji
	RootFolder  uint      `gorm:"default:0" json:"root_folder"`   // 关联的根文件夹ID
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// WorkspaceMember 空间成员
type WorkspaceMember struct {
	ID          uint      `gorm:"primarykey" json:"id"`
	WorkspaceID uint      `gorm:"uniqueIndex:idx_ws_user;not null" json:"workspace_id"` // 空间ID
	UserID      uint      `gorm:"uniqueIndex:idx_ws_user;not null" json:"user_id"`      // 用户ID
	Role        string    `gorm:"size:32;default:viewer" json:"role"`                   // 角色: owner / editor / viewer
	JoinedAt    time.Time `json:"joined_at"`
}

// FolderPermission 文件夹级别权限
type FolderPermission struct {
	ID         uint      `gorm:"primarykey" json:"id"`
	FolderID   uint      `gorm:"uniqueIndex:idx_folder_user;not null" json:"folder_id"` // 文件夹ID
	UserID     uint      `gorm:"uniqueIndex:idx_folder_user;not null" json:"user_id"`   // 被授权用户ID
	GrantedBy  uint      `gorm:"not null" json:"granted_by"`                            // 授权者ID
	Permission string    `gorm:"size:16;default:read" json:"permission"`                // read / write
	CreatedAt  time.Time `json:"created_at"`
}

// ==================== 定时同步调度模型 ====================

// SyncSchedule 数据源定时同步调度
type SyncSchedule struct {
	ID        uint       `gorm:"primarykey" json:"id"`
	MountID   uint       `gorm:"uniqueIndex;not null" json:"mount_id"` // 关联的挂载点
	UserID    uint       `gorm:"index;not null" json:"user_id"`        // 所属用户
	CronExpr  string     `gorm:"size:64;not null" json:"cron_expr"`    // Cron 表达式，如 "0 */6 * * *" 每6小时
	Enabled   bool       `gorm:"default:true" json:"enabled"`          // 是否启用
	LastRun   *time.Time `json:"last_run,omitempty"`                   // 上次执行时间
	NextRun   *time.Time `json:"next_run,omitempty"`                   // 下次执行时间
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
}

// ==================== 文件评论模型 ====================

// Comment 文件评论/备注
type Comment struct {
	ID        uint      `gorm:"primarykey" json:"id"`
	FileID    uint      `gorm:"index;not null" json:"file_id"`     // 关联文件
	UserID    uint      `gorm:"index;not null" json:"user_id"`     // 评论者
	Username  string    `gorm:"size:64" json:"username"`           // 评论者用户名
	Content   string    `gorm:"size:2048;not null" json:"content"` // 评论内容
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// ==================== 操作活动流模型 ====================

// Activity 用户操作活动记录（更丰富的展示信息）
type Activity struct {
	ID         uint      `gorm:"primarykey" json:"id"`
	UserID     uint      `gorm:"index;not null" json:"user_id"`        // 操作者
	Username   string    `gorm:"size:64" json:"username"`              // 操作者用户名
	Action     string    `gorm:"size:32;not null;index" json:"action"` // 操作类型: upload/download/delete/share/rename/move/comment/encrypt 等
	TargetType string    `gorm:"size:32" json:"target_type"`           // 目标类型: file/folder/share/comment
	TargetID   uint      `gorm:"index" json:"target_id"`               // 目标 ID
	TargetName string    `gorm:"size:512" json:"target_name"`          // 目标名称（文件名等）
	Detail     string    `gorm:"size:1024" json:"detail,omitempty"`    // 额外详情
	CreatedAt  time.Time `gorm:"index" json:"created_at"`
}

// ==================== Webhook 通知配置模型 ====================

// WebhookConfig Webhook 通知配置
type WebhookConfig struct {
	ID        uint      `gorm:"primarykey" json:"id"`
	UserID    uint      `gorm:"index;not null" json:"user_id"`          // 所属用户
	Name      string    `gorm:"size:128;not null" json:"name"`          // 名称
	URL       string    `gorm:"size:1024;not null" json:"url"`          // Webhook URL
	Secret    string    `gorm:"size:256" json:"-"`                      // 签名密钥（可选）
	Events    string    `gorm:"size:512;not null" json:"events"`        // 监听事件，逗号分隔：upload,download,delete,share,trash,restore
	Platform  string    `gorm:"size:32;default:custom" json:"platform"` // 平台类型: custom / wechat_work / dingtalk / slack / feishu
	Enabled   bool      `gorm:"default:true" json:"enabled"`            // 是否启用
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// ==================== 多因素认证模型 ====================

// UserMFA 用户 MFA 配置
type UserMFA struct {
	ID        uint      `gorm:"primarykey" json:"id"`
	UserID    uint      `gorm:"uniqueIndex;not null" json:"user_id"` // 关联用户
	Secret    string    `gorm:"size:128;not null" json:"-"`          // TOTP 密钥（不返回前端）
	Enabled   bool      `gorm:"default:false" json:"enabled"`        // 是否已启用
	Verified  bool      `gorm:"default:false" json:"verified"`       // 是否已验证（首次绑定时验证）
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// ==================== 分片上传模型 ====================

// ChunkUpload 分片上传会话
type ChunkUpload struct {
	ID             uint      `gorm:"primarykey" json:"id"`
	UploadID       string    `gorm:"uniqueIndex;size:64;not null" json:"upload_id"` // 上传会话唯一标识
	UserID         uint      `gorm:"index;not null" json:"user_id"`                 // 上传者
	ParentID       uint      `gorm:"default:0" json:"parent_id"`                    // 目标文件夹
	FileName       string    `gorm:"size:512;not null" json:"file_name"`            // 文件名
	FileSize       int64     `gorm:"not null" json:"file_size"`                     // 文件总大小
	ChunkSize      int64     `gorm:"not null" json:"chunk_size"`                    // 每片大小
	TotalChunks    int       `gorm:"not null" json:"total_chunks"`                  // 总分片数
	UploadedChunks string    `gorm:"size:4096" json:"uploaded_chunks"`              // 已上传分片（逗号分隔）
	MimeType       string    `gorm:"size:256" json:"mime_type"`                     // MIME 类型
	Hash           string    `gorm:"size:64" json:"hash"`                           // 完整文件哈希（可选，用于秒传）
	Status         string    `gorm:"size:16;default:uploading" json:"status"`       // uploading / merging / done / failed
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}
