# 构建阶段 - 后端
FROM golang:1.25-alpine AS go-builder

WORKDIR /build

# 安装 CGO 依赖（SQLite 需要）
RUN apk add --no-cache gcc musl-dev

# 复制 Go 模块文件并下载依赖
COPY go.mod go.sum ./
RUN go mod download

# 复制源代码并构建
COPY . .
RUN CGO_ENABLED=1 GOOS=linux go build -ldflags="-s -w" -o nowen-file .

# 构建阶段 - 前端
FROM node:20-alpine AS web-builder

WORKDIR /build/web

COPY web/package.json web/package-lock.json* ./
RUN npm install --frozen-lockfile 2>/dev/null || npm install

COPY web/ .
RUN npm run build

# 运行阶段
FROM alpine:3.19

LABEL maintainer="Nowen <nowen@nowen-file.dev>"
LABEL description="Nowen-File 个人/团队文件管理系统"

WORKDIR /app

# 安装运行时依赖
RUN apk add --no-cache ca-certificates tzdata && \
    cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && \
    echo "Asia/Shanghai" > /etc/timezone

# 创建数据目录
RUN mkdir -p /app/data/uploads /app/data/thumbs

# 从构建阶段复制产物
COPY --from=go-builder /build/nowen-file /app/nowen-file
COPY --from=web-builder /build/web/dist /app/web/dist

# 环境变量默认值
ENV NOWEN_PORT=8080
ENV NOWEN_DB_PATH=/app/data/nowen.db
ENV NOWEN_UPLOAD_DIR=/app/data/uploads
ENV NOWEN_THUMB_DIR=/app/data/thumbs
ENV NOWEN_JWT_SECRET=change-me-in-production
ENV NOWEN_STORAGE_TYPE=local

# 暴露端口
EXPOSE 8080

# 数据卷
VOLUME ["/app/data"]

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/auth/login || exit 1

# 启动
ENTRYPOINT ["/app/nowen-file"]
