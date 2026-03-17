<template>
  <el-dialog
    v-model="visible"
    :title="file?.name || '文件预览'"
    width="80%"
    top="5vh"
    destroy-on-close
    class="preview-dialog"
  >
    <!-- 加载状态 -->
    <div v-if="loading" class="preview-loading">
      <el-icon class="is-loading" :size="36"><Loading /></el-icon>
      <p>加载中...</p>
    </div>

    <!-- 不可预览 -->
    <div v-else-if="!previewable" class="preview-unsupported">
      <el-icon :size="64" color="#909399"><DocumentCopy /></el-icon>
      <h3>{{ file?.name }}</h3>
      <p>该文件类型暂不支持在线预览</p>
      <el-button type="primary" @click="handleDownload">下载文件</el-button>
    </div>

    <!-- 图片预览 -->
    <div v-else-if="previewType === 'image'" class="preview-image">
      <img :src="previewUrl" :alt="file?.name" @load="loading = false" />
    </div>

    <!-- PDF 预览 -->
    <div v-else-if="previewType === 'pdf'" class="preview-pdf">
      <iframe :src="previewUrl" width="100%" height="100%" frameborder="0"></iframe>
    </div>

    <!-- 视频预览 -->
    <div v-else-if="previewType === 'video'" class="preview-video">
      <video controls autoplay :src="previewUrl" style="max-width: 100%; max-height: 70vh">
        您的浏览器不支持视频播放
      </video>
    </div>

    <!-- 音频预览 -->
    <div v-else-if="previewType === 'audio'" class="preview-audio">
      <el-icon :size="80" color="#e91e63"><Headset /></el-icon>
      <h3>{{ file?.name }}</h3>
      <audio controls autoplay :src="previewUrl" style="width: 100%; margin-top: 20px">
        您的浏览器不支持音频播放
      </audio>
    </div>

    <!-- 文本预览 -->
    <div v-else-if="previewType === 'text'" class="preview-text">
      <pre><code>{{ textContent }}</code></pre>
    </div>

    <!-- 底部操作 -->
    <template #footer>
      <div class="preview-footer">
        <div class="file-info">
          <span v-if="file">{{ formatFileSize(file.size) }}</span>
          <span v-if="file?.mime_type" class="mime-type">{{ file.mime_type }}</span>
        </div>
        <div class="actions">
          <el-button @click="visible = false">关闭</el-button>
          <el-button type="primary" @click="handleDownload">
            <el-icon><Download /></el-icon>下载
          </el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { Loading, DocumentCopy, Headset, Download } from '@element-plus/icons-vue'
import type { FileItem } from '@/types'
import { getPreviewUrl, getDownloadUrl } from '@/api/file'
import { formatFileSize } from '@/utils'

const props = defineProps<{
  modelValue: boolean
  file: FileItem | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const visible = ref(props.modelValue)
const loading = ref(false)
const previewable = ref(false)
const previewType = ref('')
const previewUrl = ref('')
const textContent = ref('')

watch(() => props.modelValue, (val) => {
  visible.value = val
  if (val && props.file) {
    loadPreview()
  }
})

watch(visible, (val) => {
  emit('update:modelValue', val)
})

function getPreviewType(mimeType: string): string {
  if (!mimeType) return 'unknown'
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  if (mimeType === 'application/pdf') return 'pdf'
  if (mimeType.startsWith('text/') || mimeType === 'application/json') return 'text'
  return 'unknown'
}

function isPreviewable(mimeType: string): boolean {
  const type = getPreviewType(mimeType)
  return type !== 'unknown'
}

async function loadPreview() {
  if (!props.file) return

  const mime = props.file.mime_type || ''
  previewType.value = getPreviewType(mime)
  previewable.value = isPreviewable(mime)
  previewUrl.value = getPreviewUrl(props.file.uuid)

  if (previewType.value === 'text') {
    loading.value = true
    try {
      const response = await fetch(previewUrl.value)
      textContent.value = await response.text()
    } catch {
      textContent.value = '加载文本内容失败'
    } finally {
      loading.value = false
    }
  } else if (previewType.value === 'image') {
    loading.value = true
    // 图片通过 onload 事件设置 loading = false
    setTimeout(() => { loading.value = false }, 5000) // 超时兜底
  }
}

function handleDownload() {
  if (!props.file) return
  const url = getDownloadUrl(props.file.uuid)
  const a = document.createElement('a')
  a.href = url
  a.download = props.file.name
  a.click()
}
</script>

<style scoped lang="scss">
.preview-dialog {
  :deep(.el-dialog__body) {
    padding: 0;
    min-height: 400px;
    max-height: 75vh;
    overflow: auto;
  }
}

.preview-loading, .preview-unsupported {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #909399;

  h3 { margin: 16px 0 8px; color: #303133; }
  p { margin-bottom: 16px; }
}

.preview-image {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 16px;
  background: #f0f0f0;
  min-height: 400px;

  img {
    max-width: 100%;
    max-height: 70vh;
    border-radius: 4px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  }
}

.preview-pdf {
  height: 70vh;
}

.preview-video {
  display: flex;
  justify-content: center;
  align-items: center;
  background: #000;
  padding: 16px;
  min-height: 400px;
}

.preview-audio {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;

  h3 { margin: 16px 0; color: #303133; }
}

.preview-text {
  padding: 16px;
  background: #fafafa;
  min-height: 400px;
  max-height: 70vh;
  overflow: auto;

  pre {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-all;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 13px;
    line-height: 1.6;
    color: #303133;
  }
}

.preview-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;

  .file-info {
    display: flex;
    gap: 12px;
    font-size: 13px;
    color: #909399;

    .mime-type {
      padding: 2px 8px;
      background: #f0f0f0;
      border-radius: 4px;
      font-size: 12px;
    }
  }

  .actions {
    display: flex;
    gap: 8px;
  }
}
</style>
