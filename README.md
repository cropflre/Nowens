# Nowen-File 文件管理系统

一个使用 **Go + React** 构建的现代化文件管理系统，支持多数据源映射、WebDAV 协议、文件分享与版本管理。

## ✨ 功能特性

### 核心功能
- 📁 **文件/文件夹管理** — 创建、上传、下载、重命名、移动
- 🔍 **文件搜索** — 关键词搜索 & 按类型分类浏览（图片/视频/音频/文档）
- 🗑️ **回收站** — 软删除 + 恢复，防止误操作
- 🔗 **文件分享** — 链接分享、密码保护、自定义有效期
- � **版本管理** — 文件历史版本记录、回滚、删除
- 🖼️ **文件预览** — 在线预览图片、PDF、文本、视频、音频

### 用户与管理
- �👤 **用户系统** — 注册、登录、JWT 认证
- 📊 **存储空间统计** — 用量监控、配额管理
- �️ **管理员后台** — 系统概览、用户管理、审计日志
- 📋 **操作审计** — 完整的用户操作日志记录

### 高级功能
- 🔌 **数据源映射** — 映射 Windows/Linux/NAS 上的目录进行统一管理
  - 支持本地目录（local）
  - 支持 SMB/CIFS 网络共享
  - 支持 NFS 挂载
  - 远程 Agent（规划中）
- 📡 **WebDAV 协议** — 可通过文件管理器直接挂载网络驱动器
- ☁️ **多存储后端** — 支持本地存储和 S3/MinIO 对象存储
- 🔄 **批量操作** — 批量删除、批量移动

## 🛠️ 技术栈

### 后端

| 技术 | 版本 | 用途 |
|:---|:---|:---|
| Go | 1.25+ | 编程语言 |
| Gin | 1.9 | Web 框架 |
| GORM | 1.25 | ORM 框架 |
| SQLite | (pure Go) | 数据库（无需 CGO） |
| JWT | v5 | 用户认证 |
| MinIO SDK | 7.0 | S3 对象存储 |

### 前端

| 技术 | 版本 | 用途 |
|:---|:---|:---|
| React | 18 | UI 框架 |
| TypeScript | 5.3 | 类型安全 |
| Ant Design | 5 | UI 组件库 |
| React Router | 6 | 路由管理 |
| Zustand | 4.5 | 状态管理 |
| Axios | 1.6 | HTTP 客户端 |
| Vite | 5 | 构建工具 |

## 🚀 快速开始

### 前置要求

- **Go 1.21+**（后端）
- **Node.js 18+**（前端开发）

### 安装运行

```bash
# 克隆项目
git clone <repo-url>
cd nowen-file

# ============ 启动后端 ============
# 下载 Go 依赖
go mod tidy

# 运行后端服务
go run main.go
# 服务将在 http://localhost:8080 启动

# ============ 启动前端（另开终端） ============
cd web

# 安装前端依赖（首次运行）
npm install

# 启动开发服务器
npm run dev
# 前端将在 http://localhost:3000 启动（自动代理 API 到 :8080）
```

打开浏览器访问 `http://localhost:3000`，注册账号后即可使用。

### 生产构建

```bash
# 构建前端
cd web && npm run build
# 产物输出到 web/dist/

# 构建后端（可执行文件）
go build -o nowen-file .
```

## 🐳 Docker 部署

### 快速启动（推荐）

```bash
# 拉取镜像（自动匹配 amd64/arm64 架构）
docker pull nowen/nowen-file:latest

# 一键启动
docker run -d \
  --name nowen-file \
  --restart unless-stopped \
  -p 8080:8080 \
  -v /your/path/data:/app/data \
  -e NOWEN_JWT_SECRET=your-secret-key \
  nowen/nowen-file:latest
```

启动后访问 `http://NAS的IP:8080` 即可使用。

### 使用 Docker Compose

```bash
# 创建项目目录
mkdir -p /volume1/docker/nowen-file && cd /volume1/docker/nowen-file

# 创建 docker-compose.yml（内容见项目根目录 docker-compose.yml）
# 启动
docker compose up -d
```

### 🟢 绿联 NAS 部署

1. 打开绿联 NAS 的 **Docker** 应用
2. 在「镜像管理」→「仓库」中搜索 `nowen/nowen-file`，下载 `latest` 标签
3. 下载完成后，点击「创建容器」：
   - **端口映射**：本地端口 `8080` → 容器端口 `8080`
   - **存储空间映射**：选择一个 NAS 本地目录（如 `/volume1/docker/nowen-file/data`）→ 容器目录 `/app/data`
   - **环境变量**：添加 `NOWEN_JWT_SECRET`，值设置为你自定义的密钥
4. 启动容器后，浏览器访问 `http://NAS的IP:8080`

### 🔵 群晖 NAS 部署（Synology）

**方式一：Container Manager（DSM 7.2+）**

1. 打开 **Container Manager** → 「项目」→「新建」
2. 选择路径，粘贴以下 docker-compose 内容：
   ```yaml
   services:
     nowen-file:
       image: nowen/nowen-file:latest
       container_name: nowen-file
       restart: unless-stopped
       ports:
         - "8080:8080"
       volumes:
         - /volume1/docker/nowen-file/data:/app/data
       environment:
         - NOWEN_JWT_SECRET=your-secret-key
   ```
3. 点击「部署」即可

**方式二：SSH 命令行**

```bash
docker run -d \
  --name nowen-file \
  --restart unless-stopped \
  -p 8080:8080 \
  -v /volume1/docker/nowen-file/data:/app/data \
  -e NOWEN_JWT_SECRET=your-secret-key \
  nowen/nowen-file:latest
```

### 🟠 威联通 NAS 部署（QNAP）

1. 打开 **Container Station**
2. 「创建」→ 搜索 `nowen/nowen-file`
3. 配置端口映射 `8080:8080` 和存储卷映射
4. 设置环境变量 `NOWEN_JWT_SECRET`
5. 启动容器

### 🟤 飞牛 NAS 部署（fnOS）

1. 打开 **Docker** 管理
2. 「镜像」→ 搜索并拉取 `nowen/nowen-file:latest`
3. 创建容器时配置端口映射和目录映射（同上）
4. 启动即可使用

### 自行构建镜像

```bash
# 单架构构建
docker build -t nowen-file:latest .

# 多架构构建并推送（需要 Docker Buildx）
docker buildx create --use
docker buildx build --platform linux/amd64,linux/arm64 \
  -t nowen/nowen-file:latest --push .
```

### 支持的架构

| 架构 | 适用平台 |
|:---|:---|
| `linux/amd64` | 大部分 x86 NAS（群晖 x86 系列、威联通 x86 系列）、PC/服务器 |
| `linux/arm64` | 绿联 NAS、群晖 ARM 系列、威联通 ARM 系列、飞牛 NAS、树莓派 4/5 |

## ⚙️ 环境变量配置

### 基础配置

| 变量名 | 默认值 | 说明 |
|:---|:---|:---|
| `NOWEN_PORT` | `8080` | 服务端口 |
| `NOWEN_DB_PATH` | `./data/nowen.db` | SQLite 数据库路径 |
| `NOWEN_UPLOAD_DIR` | `./data/uploads` | 文件上传目录 |
| `NOWEN_THUMB_DIR` | `./data/thumbs` | 缩略图目录 |
| `NOWEN_JWT_SECRET` | `nowen-file-secret-key-change-me` | JWT 签名密钥（**生产环境务必修改**） |
| `NOWEN_MAX_UPLOAD` | `1073741824` | 最大上传大小（字节），默认 1GB |
| `NOWEN_STORAGE_TYPE` | `local` | 存储类型：`local` 或 `s3` |

### S3/MinIO 配置（当 `NOWEN_STORAGE_TYPE=s3` 时生效）

| 变量名 | 默认值 | 说明 |
|:---|:---|:---|
| `NOWEN_S3_ENDPOINT` | （空） | S3 服务地址（如 `minio.example.com:9000`） |
| `NOWEN_S3_BUCKET` | `nowen-file` | 存储桶名称 |
| `NOWEN_S3_ACCESS_KEY` | （空） | Access Key |
| `NOWEN_S3_SECRET_KEY` | （空） | Secret Key |
| `NOWEN_S3_USE_SSL` | `false` | 是否启用 SSL |
| `NOWEN_S3_REGION` | `us-east-1` | S3 Region |

### 配置示例

```powershell
# PowerShell（Windows）
$env:NOWEN_PORT = "9090"
$env:NOWEN_JWT_SECRET = "my-super-secret-key"
$env:NOWEN_STORAGE_TYPE = "s3"
$env:NOWEN_S3_ENDPOINT = "minio.local:9000"
$env:NOWEN_S3_BUCKET = "my-files"
$env:NOWEN_S3_ACCESS_KEY = "minioadmin"
$env:NOWEN_S3_SECRET_KEY = "minioadmin"
go run main.go
```

```bash
# Linux / macOS
export NOWEN_PORT=9090
export NOWEN_JWT_SECRET="my-super-secret-key"
go run main.go
```

## 📡 API 接口文档

### 认证接口

| 方法 | 路径 | 说明 | 需要登录 |
|:---|:---|:---|:---:|
| POST | `/api/auth/register` | 用户注册 | ❌ |
| POST | `/api/auth/login` | 用户登录 | ❌ |

### 用户接口

| 方法 | 路径 | 说明 | 需要登录 |
|:---|:---|:---|:---:|
| GET | `/api/user/profile` | 获取当前用户信息 | ✅ |
| PUT | `/api/user/profile` | 更新用户资料 | ✅ |

### 文件管理接口

| 方法 | 路径 | 说明 | 需要登录 |
|:---|:---|:---|:---:|
| GET | `/api/files/list` | 文件列表 | ✅ |
| POST | `/api/files/folder` | 创建文件夹 | ✅ |
| POST | `/api/files/upload` | 上传文件 | ✅ |
| GET | `/api/files/download/:uuid` | 下载文件 | ✅ |
| GET | `/api/files/preview/:uuid` | 预览文件内容 | ✅ |
| GET | `/api/files/preview-info/:uuid` | 预览元信息 | ✅ |
| GET | `/api/files/thumb/:uuid` | 获取缩略图 | ✅ |
| PUT | `/api/files/rename` | 重命名 | ✅ |
| PUT | `/api/files/move` | 移动文件 | ✅ |
| POST | `/api/files/trash` | 移入回收站 | ✅ |
| POST | `/api/files/restore` | 从回收站恢复 | ✅ |
| GET | `/api/files/trash` | 回收站列表 | ✅ |
| DELETE | `/api/files/:id` | 永久删除 | ✅ |
| GET | `/api/files/search` | 搜索文件 | ✅ |
| GET | `/api/files/type/:type` | 按类型搜索 | ✅ |
| GET | `/api/files/storage` | 存储空间统计 | ✅ |

### 批量操作接口

| 方法 | 路径 | 说明 | 需要登录 |
|:---|:---|:---|:---:|
| POST | `/api/files/batch/trash` | 批量移入回收站 | ✅ |
| POST | `/api/files/batch/move` | 批量移动 | ✅ |
| POST | `/api/files/batch/delete` | 批量永久删除 | ✅ |

### 文件版本接口

| 方法 | 路径 | 说明 | 需要登录 |
|:---|:---|:---|:---:|
| GET | `/api/files/versions/:file_id` | 版本列表 | ✅ |
| POST | `/api/files/versions/restore` | 回滚版本 | ✅ |
| DELETE | `/api/files/versions/:file_id/:version_id` | 删除版本 | ✅ |

### 分享接口

| 方法 | 路径 | 说明 | 需要登录 |
|:---|:---|:---|:---:|
| POST | `/api/share` | 创建分享 | ✅ |
| GET | `/api/share/list` | 我的分享列表 | ✅ |
| DELETE | `/api/share/:id` | 删除分享 | ✅ |
| GET | `/api/share/:code` | 获取分享内容 | ❌ |
| POST | `/api/share/:code/verify` | 验证分享密码 | ❌ |
| GET | `/api/share/:code/download` | 下载分享文件 | ❌ |
| GET | `/api/share/:code/preview` | 预览分享文件 | ❌ |

### 数据源/挂载点接口

| 方法 | 路径 | 说明 | 需要登录 |
|:---|:---|:---|:---:|
| POST | `/api/mounts` | 创建数据源 | ✅ |
| GET | `/api/mounts` | 数据源列表 | ✅ |
| GET | `/api/mounts/:id` | 数据源详情 | ✅ |
| PUT | `/api/mounts/:id` | 更新数据源 | ✅ |
| DELETE | `/api/mounts/:id` | 删除数据源 | ✅ |
| POST | `/api/mounts/:id/scan` | 触发扫描 | ✅ |
| GET | `/api/mounts/:id/stats` | 数据源统计 | ✅ |
| GET | `/api/mounts/:id/files` | 浏览索引文件 | ✅ |
| GET | `/api/mounts/search` | 搜索索引文件 | ✅ |
| GET | `/api/mounts/files/:file_id/download` | 下载索引文件 | ✅ |
| GET | `/api/mounts/files/:file_id/preview` | 预览索引文件 | ✅ |

### 管理员接口（需要 admin 角色）

| 方法 | 路径 | 说明 | 需要登录 |
|:---|:---|:---|:---:|
| GET | `/api/admin/dashboard` | 系统概览 | ✅ (admin) |
| GET | `/api/admin/users` | 用户列表 | ✅ (admin) |
| PUT | `/api/admin/users/:id` | 更新用户信息 | ✅ (admin) |
| DELETE | `/api/admin/users/:id` | 删除用户 | ✅ (admin) |
| POST | `/api/admin/users/:id/reset-password` | 重置用户密码 | ✅ (admin) |
| GET | `/api/admin/logs` | 审计日志 | ✅ (admin) |
| GET | `/api/admin/files` | 系统文件统计 | ✅ (admin) |

### WebDAV 接口

| 路径 | 说明 |
|:---|:---|
| `/dav/*` | WebDAV 协议入口（支持 PROPFIND、MKCOL、GET、PUT、DELETE、COPY、MOVE、LOCK、UNLOCK 等方法） |

使用方式：
- **Windows** — 文件资源管理器「映射网络驱动器」→ 输入 `http://localhost:8080/dav`
- 使用注册的用户名和密码进行认证

## 📦 数据模型

### User（用户）

| 字段 | 类型 | 说明 |
|:---|:---|:---|
| id | uint | 主键 |
| username | string | 用户名（唯一） |
| password | string | 密码（哈希存储，不返回前端） |
| nickname | string | 昵称 |
| avatar | string | 头像 URL |
| role | string | 角色：`admin` / `user` |
| storage_limit | int64 | 存储配额（字节），默认 10GB |
| storage_used | int64 | 已使用存储（字节） |

### FileItem（文件/文件夹）

| 字段 | 类型 | 说明 |
|:---|:---|:---|
| id | uint | 主键 |
| uuid | string | 唯一标识（用于 URL） |
| user_id | uint | 所属用户 |
| parent_id | uint | 父文件夹 ID（0 = 根目录） |
| name | string | 文件/文件夹名 |
| is_dir | bool | 是否为文件夹 |
| size | int64 | 文件大小（字节） |
| mime_type | string | MIME 类型 |
| hash | string | 文件哈希（用于去重） |
| is_trash | bool | 是否在回收站 |

### ShareLink（分享链接）

| 字段 | 类型 | 说明 |
|:---|:---|:---|
| id | uint | 主键 |
| code | string | 分享码（唯一） |
| file_id | uint | 分享的文件 ID |
| user_id | uint | 创建者 |
| password | string | 提取密码（可选） |
| expire_at | time | 过期时间（可选） |
| view_count | int | 查看次数 |
| download_count | int | 下载次数 |

### FileVersion（文件版本）

| 字段 | 类型 | 说明 |
|:---|:---|:---|
| id | uint | 主键 |
| file_id | uint | 关联文件 ID |
| version | int | 版本号 |
| size | int64 | 文件大小 |
| hash | string | 文件哈希 |
| comment | string | 版本备注 |

### MountPoint（数据源/挂载点）

| 字段 | 类型 | 说明 |
|:---|:---|:---|
| id | uint | 主键 |
| user_id | uint | 所属用户 |
| name | string | 显示名称 |
| type | string | 类型：`local` / `smb` / `nfs` / `agent` |
| base_path | string | 根路径 |
| status | string | 状态：`online` / `offline` / `syncing` / `error` |
| file_count | int64 | 索引文件数 |
| dir_count | int64 | 索引目录数 |
| total_size | int64 | 总大小（字节） |

### IndexedFile（索引文件）

| 字段 | 类型 | 说明 |
|:---|:---|:---|
| id | uint | 主键 |
| mount_id | uint | 所属挂载点 |
| remote_path | string | 远程完整路径 |
| parent_path | string | 父目录路径 |
| name | string | 文件/目录名 |
| is_dir | bool | 是否为目录 |
| size | int64 | 文件大小 |
| mime_type | string | MIME 类型 |

### AuditLog（审计日志）

| 字段 | 类型 | 说明 |
|:---|:---|:---|
| id | uint | 主键 |
| user_id | uint | 操作者 |
| username | string | 操作者用户名 |
| action | string | 操作类型 |
| resource | string | 资源类型 |
| detail | string | 操作详情 |
| ip | string | 操作 IP |

## 📂 项目结构

```
nowen-file/
├── main.go                      # 应用入口
├── go.mod                       # Go 模块定义
├── config/
│   └── config.go                # 配置管理（环境变量加载）
├── model/
│   └── model.go                 # 数据模型 & 数据库初始化（GORM AutoMigrate）
├── middleware/
│   ├── auth.go                  # JWT 认证中间件 & 管理员权限校验
│   └── cors.go                  # 跨域 & 日志中间件
├── service/
│   ├── user_service.go          # 用户业务逻辑
│   ├── file_service.go          # 文件业务逻辑
│   ├── share_service.go         # 分享业务逻辑
│   ├── version_service.go       # 文件版本管理
│   ├── mount_service.go         # 数据源/挂载点扫描
│   └── audit_service.go         # 操作审计日志
├── handler/
│   ├── user_handler.go          # 用户 API
│   ├── file_handler.go          # 文件 API
│   ├── share_handler.go         # 分享 API
│   ├── version_handler.go       # 文件版本 API
│   ├── mount_handler.go         # 数据源 API
│   ├── admin_handler.go         # 管理员 API
│   ├── webdav_handler.go        # WebDAV 协议处理
│   └── response.go              # 统一响应格式
├── router/
│   └── router.go                # 路由配置（所有 API 端点注册）
├── storage/
│   ├── storage.go               # 存储后端接口定义
│   ├── local.go                 # 本地文件系统存储实现
│   └── s3.go                    # S3/MinIO 对象存储实现
├── web/                         # 前端项目（React）
│   ├── index.html               # HTML 入口
│   ├── package.json             # 前端依赖
│   ├── vite.config.ts           # Vite 构建配置
│   ├── tsconfig.json            # TypeScript 配置
│   └── src/
│       ├── main.tsx             # React 入口
│       ├── App.tsx              # 路由配置 & 路由守卫
│       ├── assets/
│       │   └── global.css       # 全局样式
│       ├── api/                 # API 请求层
│       │   ├── user.ts          # 用户 API
│       │   ├── file.ts          # 文件 API
│       │   ├── share.ts         # 分享 API
│       │   ├── admin.ts         # 管理员 API
│       │   └── mount.ts         # 数据源 API
│       ├── stores/              # 状态管理（Zustand）
│       │   ├── user.ts          # 用户状态
│       │   └── file.ts          # 文件列表状态
│       ├── types/
│       │   └── index.ts         # TypeScript 类型定义
│       ├── utils/
│       │   ├── http.ts          # Axios 实例 & 拦截器
│       │   └── index.ts         # 工具函数（格式化等）
│       ├── components/          # 公共组件
│       │   ├── FilePreview.tsx  # 文件预览弹窗
│       │   └── FileVersions.tsx # 版本历史弹窗
│       └── views/               # 页面组件
│           ├── Layout.tsx       # 布局（侧边栏 + 顶部栏）
│           ├── Login.tsx        # 登录/注册
│           ├── Files.tsx        # 文件管理主页
│           ├── Category.tsx     # 文件分类浏览
│           ├── Trash.tsx        # 回收站
│           ├── MyShares.tsx     # 我的分享
│           ├── ShareView.tsx    # 分享查看页（公开）
│           ├── Admin.tsx        # 管理员后台
│           ├── Mounts.tsx       # 数据源管理
│           └── MountBrowse.tsx  # 数据源文件浏览
└── data/                        # 数据目录（运行时自动创建）
    ├── nowen.db                 # SQLite 数据库
    ├── uploads/                 # 上传文件存储
    └── thumbs/                  # 缩略图缓存
```

## 🔐 管理员设置

首个注册用户默认为普通用户。如需设置管理员权限，可使用 SQLite 数据库工具（如 [DB Browser for SQLite](https://sqlitebrowser.org/)）打开 `data/nowen.db`，将对应用户的 `role` 字段修改为 `admin`。

## 📜 License

MIT
