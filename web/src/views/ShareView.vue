<template>
  <div class="share-page">
    <div class="share-card">
      <!-- Logo -->
      <div class="share-header">
        <el-icon :size="36" color="#409eff"><FolderOpened /></el-icon>
        <h2>Nowen File 文件分享</h2>
      </div>

      <!-- 加载状态 -->
      <div v-if="loading" class="loading-wrapper">
        <el-icon class="is-loading" :size="32"><Loading /></el-icon>
        <p>加载中...</p>
      </div>

      <!-- 错误状态 -->
      <div v-else-if="errorMsg" class="error-wrapper">
        <el-icon :size="48" color="#f56c6c"><CircleCloseFilled /></el-icon>
        <p>{{ errorMsg }}</p>
      </div>

      <!-- 需要密码 -->
      <div v-else-if="needPassword" class="password-wrapper">
        <el-icon :size="48" color="#e6a23c"><Lock /></el-icon>
        <h3>{{ shareData?.file_name || '加密分享' }}</h3>
        <p>该文件已加密，请输入提取密码</p>
        <el-input
          v-model="password"
          type="password"
          placeholder="请输入提取密码"
          show-password
          size="large"
          style="max-width: 300px; margin: 16px 0"
          @keyup.enter="handleVerify"
        />
        <el-button type="primary" size="large" @click="handleVerify" :loading="verifying">
          提取文件
        </el-button>
      </div>

      <!-- 文件信息 -->
      <div v-else-if="fileInfo" class="file-wrapper">
        <div class="file-info-card">
          <el-icon :size="56" :color="getFileColor(fileInfo.name, fileInfo.is_dir)">
            <component :is="getFileIcon(fileInfo.name, fileInfo.is_dir)" />
          </el-icon>
          <h3>{{ fileInfo.name }}</h3>
          <div class="file-meta">
            <el-tag size="small">{{ formatFileSize(fileInfo.size) }}</el-tag>
            <el-tag size="small" type="info">{{ fileInfo.mime_type || '未知类型' }}</el-tag>
          </div>
        </div>

        <!-- 预览区域 -->
        <div v-if="previewable" class="preview-area">
          <!-- 图片预览 -->
          <div v-if="previewType === 'image'" class="preview-image">
            <img :src="previewSrc" :alt="fileInfo.name" />
          </div>
          <!-- 视频预览 -->
          <div v-else-if="previewType === 'video'" class="preview-video">
            <video controls :src="previewSrc" style="max-width: 100%; max-height: 60vh"></video>
          </div>
          <!-- 音频预览 -->
          <div v-else-if="previewType === 'audio'" class="preview-audio">
            <audio controls :src="previewSrc" style="width: 100%"></audio>
          </div>
          <!-- PDF 预览 -->
          <div v-else-if="previewType === 'pdf'" class="preview-pdf">
            <iframe :src="previewSrc" width="100%" height="500px" frameborder="0"></iframe>
          </div>
          <!-- 文本预览 -->
          <div v-else-if="previewType === 'text'" class="preview-text">
            <pre><code>{{ textContent }}</code></pre>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="actions">
          <el-button type="primary" size="large" @click="handleDownload">
            <el-icon><Download /></el-icon>下载文件
          </el-button>
        </div>

        <!-- 分享信息 -->
        <div v-if="shareInfo" class="share-meta">
          <span>查看 {{ shareInfo.view_count }} 次</span>
          <span>·</span>
          <span>下载 {{ shareInfo.download_count }} 次</span>
          <span v-if="shareInfo.expire_at">·</span>
          <span v-if="shareInfo.expire_at">{{ formatExpire(shareInfo.expire_at) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import {
  FolderOpened, Loading, CircleCloseFilled, Lock, Download,
} from '@element-plus/icons-vue'
import type { FileItem, ShareLink, ShareDetail } from '@/types'
import { getShareInfo, verifySharePassword, getSharePreviewUrl, getShareDownloadUrl } from '@/api/share'
import { formatFileSize, getFileIcon, getFileColor } from '@/utils'

const route = useRoute()
const code = ref('')

const loading = ref(true)
const errorMsg = ref('')
const needPassword = ref(false)
const password = ref('')
const verifying = ref(false)

const shareData = ref<ShareDetail | null>(null)
const fileInfo = ref<FileItem | null>(null)
const shareInfo = ref<ShareLink | null>(null)
const previewable = ref(false)
const previewType = ref('')
const previewSrc = ref('')
const textContent = ref('')

onMounted(async () => {
  code.value = route.params.code as string
  if (!code.value) {
    errorMsg.value = '无效的分享链接'
    loading.value = false
    return
  }

  try {
    const res = await getShareInfo(code.value)
    shareData.value = res.data!
    if (shareData.value.need_password) {
      needPassword.value = true
    } else {
      setFileData(shareData.value)
    }
  } catch (e: any) {
    errorMsg.value = e?.response?.data?.msg || '分享链接不存在或已失效'
  } finally {
    loading.value = false
  }
})

async function handleVerify() {
  if (!password.value.trim()) return
  verifying.value = true
  try {
    const res = await verifySharePassword(code.value, password.value)
    needPassword.value = false
    setFileData(res.data!)
  } catch {
    // 错误在拦截器处理
  } finally {
    verifying.value = false
  }
}

function setFileData(data: ShareDetail) {
  fileInfo.value = data.file || null
  shareInfo.value = data.share || null
  previewable.value = data.previewable || false
  previewType.value = data.preview_type || ''

  if (previewable.value) {
    previewSrc.value = getSharePreviewUrl(code.value, password.value || undefined)

    if (previewType.value === 'text') {
      fetch(previewSrc.value)
        .then(r => r.text())
        .then(t => textContent.value = t)
        .catch(() => textContent.value = '加载失败')
    }
  }
}

function handleDownload() {
  const url = getShareDownloadUrl(code.value, password.value || undefined)
  const a = document.createElement('a')
  a.href = url
  a.download = fileInfo.value?.name || 'file'
  a.click()
}

function formatExpire(expireAt: string): string {
  const date = new Date(expireAt)
  const now = new Date()
  if (date < now) return '已过期'
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 86400))
  if (diffDays <= 1) return '即将过期'
  return `${diffDays} 天后过期`
}
</script>

<style scoped lang="scss">
.share-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.share-card {
  width: 100%;
  max-width: 700px;
  background: #fff;
  border-radius: 16px;
  padding: 40px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
}

.share-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 32px;

  h2 {
    font-size: 20px;
    color: #303133;
  }
}

.loading-wrapper, .error-wrapper, .password-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 0;
  color: #909399;

  h3 { margin: 12px 0 4px; color: #303133; }
  p { margin: 4px 0 8px; }
}

.file-wrapper {
  .file-info-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 24px 0;

    h3 {
      margin: 12px 0 8px;
      font-size: 18px;
      color: #303133;
      word-break: break-all;
      text-align: center;
    }

    .file-meta {
      display: flex;
      gap: 8px;
    }
  }

  .preview-area {
    margin: 16px 0;
    border: 1px solid #ebeef5;
    border-radius: 8px;
    overflow: hidden;
    background: #fafafa;
  }

  .preview-image {
    display: flex;
    justify-content: center;
    padding: 16px;
    img { max-width: 100%; max-height: 500px; border-radius: 4px; }
  }

  .preview-video {
    display: flex;
    justify-content: center;
    background: #000;
    padding: 8px;
  }

  .preview-audio {
    padding: 24px;
  }

  .preview-pdf {
    height: 500px;
  }

  .preview-text {
    padding: 16px;
    max-height: 400px;
    overflow: auto;

    pre {
      margin: 0;
      white-space: pre-wrap;
      word-break: break-all;
      font-size: 13px;
      line-height: 1.6;
    }
  }

  .actions {
    display: flex;
    justify-content: center;
    margin: 24px 0 16px;
  }

  .share-meta {
    display: flex;
    justify-content: center;
    gap: 8px;
    font-size: 13px;
    color: #909399;
  }
}
</style>
