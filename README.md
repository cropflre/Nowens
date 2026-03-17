# Nowen-File 文件管理系统

一个使用 Go + Vue3 构建的现代化文件管理系统。

## 功能特性

- 📁 文件/文件夹管理（创建、上传、下载、重命名、移动）
- 🔍 文件搜索
- 🗑️ 回收站（软删除 + 恢复）
- 🔗 文件分享（链接分享、密码保护、有效期）
- 👤 用户系统（注册、登录、JWT 认证）
- 📊 存储空间统计
- 🖼️ 文件预览（图片、PDF、文本、视频）

## 技术栈

**后端：**
- Go 1.21+
- Gin (Web 框架)
- GORM + SQLite (数据库)
- JWT (认证)

**前端（计划中）：**
- Vue 3 + TypeScript
- Element Plus
- Vite

## 快速开始

### 前置要求

- Go 1.21+

### 安装运行

```bash
# 克隆项目
git clone <repo-url>
cd nowen-file

# 下载依赖
go mod tidy

# 运行
go run main.go
```

服务器将在 `http://localhost:8080` 启动。

### 环境变量配置

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| NOWEN_PORT | 8080 | 服务端口 |
| NOWEN_DB_PATH | ./data/nowen.db | 数据库路径 |
| NOWEN_UPLOAD_DIR | ./data/uploads | 文件上传目录 |
| NOWEN_JWT_SECRET | nowen-file-secret-key-change-me | JWT 密钥 |
| NOWEN_MAX_UPLOAD | 1073741824 | 最大上传大小(字节)，默认1GB |

## API 接口

### 认证接口

| 方法 | 路径 | 说明 | 需要登录 |
|------|------|------|----------|
| POST | /api/auth/register | 用户注册 | ❌ |
| POST | /api/auth/login | 用户登录 | ❌ |

### 用户接口

| 方法 | 路径 | 说明 | 需要登录 |
|------|------|------|----------|
| GET | /api/user/profile | 获取当前用户信息 | ✅ |
| PUT | /api/user/profile | 更新用户资料 | ✅ |

### 文件管理接口

| 方法 | 路径 | 说明 | 需要登录 |
|------|------|------|----------|
| GET | /api/files/list | 文件列表 | ✅ |
| POST | /api/files/folder | 创建文件夹 | ✅ |
| POST | /api/files/upload | 上传文件 | ✅ |
| GET | /api/files/download/:uuid | 下载文件 | ✅ |
| GET | /api/files/preview/:uuid | 预览文件 | ✅ |
| PUT | /api/files/rename | 重命名 | ✅ |
| PUT | /api/files/move | 移动文件 | ✅ |
| POST | /api/files/trash | 移入回收站 | ✅ |
| POST | /api/files/restore | 从回收站恢复 | ✅ |
| GET | /api/files/trash | 回收站列表 | ✅ |
| DELETE | /api/files/:id | 永久删除 | ✅ |
| GET | /api/files/search | 搜索文件 | ✅ |
| GET | /api/files/storage | 存储统计 | ✅ |

### 分享接口

| 方法 | 路径 | 说明 | 需要登录 |
|------|------|------|----------|
| POST | /api/share | 创建分享 | ✅ |
| GET | /api/share/list | 我的分享列表 | ✅ |
| DELETE | /api/share/:id | 删除分享 | ✅ |
| GET | /api/share/:code | 获取分享内容 | ❌ |
| POST | /api/share/:code/verify | 验证分享密码 | ❌ |
| GET | /api/share/:code/download | 下载分享文件 | ❌ |

## 项目结构

```
nowen-file/
├── main.go              # 应用入口
├── go.mod               # Go 模块定义
├── config/
│   └── config.go        # 配置管理
├── model/
│   └── model.go         # 数据模型 & 数据库初始化
├── middleware/
│   ├── auth.go          # JWT 认证中间件
│   └── cors.go          # 跨域 & 日志中间件
├── service/
│   ├── user_service.go  # 用户业务逻辑
│   ├── file_service.go  # 文件业务逻辑
│   └── share_service.go # 分享业务逻辑
├── handler/
│   ├── user_handler.go  # 用户 API 接口
│   ├── file_handler.go  # 文件 API 接口
│   ├── share_handler.go # 分享 API 接口
│   └── response.go      # 统一响应
├── router/
│   └── router.go        # 路由配置
└── data/                # 数据目录（自动创建）
    ├── nowen.db         # SQLite 数据库
    └── uploads/         # 上传文件存储
```

## License

MIT
