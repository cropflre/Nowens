<template>
  <div class="category-page">
    <div class="toolbar">
      <h3>
        <el-icon :color="iconColor">
          <component :is="iconName" />
        </el-icon>
        {{ categoryTitle }}
      </h3>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-wrapper">
      <el-icon class="is-loading" :size="32"><Loading /></el-icon>
      <p>加载中...</p>
    </div>

    <!-- 空状态 -->
    <el-empty v-else-if="files.length === 0" :description="'暂无' + categoryTitle" :image-size="120" />

    <!-- 文件列表 -->
    <div v-else class="file-grid">
      <div
        v-for="file in files"
        :key="file.id"
        class="file-card"
        @dblclick="handlePreview(file)"
      >
        <div class="file-icon">
          <el-icon
            :size="48"
            :color="getFileColor(file.name, file.is_dir)"
          >
            <component :is="getFileIcon(file.name, file.is_dir)" />
          </el-icon>
        </div>
        <div class="file-name text-ellipsis" :title="file.name">{{ file.name }}</div>
        <div class="file-meta">{{ formatFileSize(file.size) }}</div>
      </div>
    </div>

    <!-- 预览组件 -->
    <FilePreview v-model="showPreview" :file="previewFile" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { Loading } from '@element-plus/icons-vue'
import type { FileItem } from '@/types'
import { searchByType } from '@/api/file'
import { formatFileSize, getFileIcon, getFileColor } from '@/utils'
import FilePreview from '@/components/FilePreview.vue'

const route = useRoute()
const files = ref<FileItem[]>([])
const loading = ref(false)
const showPreview = ref(false)
const previewFile = ref<FileItem | null>(null)

const fileType = computed(() => route.params.type as string)

const categoryTitle = computed(() => {
  const map: Record<string, string> = {
    image: '图片', video: '视频', audio: '音频', document: '文档',
  }
  return map[fileType.value] || '分类'
})

const iconName = computed(() => {
  const map: Record<string, string> = {
    image: 'Picture', video: 'VideoCamera', audio: 'Headset', document: 'Document',
  }
  return map[fileType.value] || 'Folder'
})

const iconColor = computed(() => {
  const map: Record<string, string> = {
    image: '#e6a23c', video: '#9b59b6', audio: '#e91e63', document: '#409eff',
  }
  return map[fileType.value] || '#909399'
})

async function loadFiles() {
  loading.value = true
  try {
    const res = await searchByType(fileType.value)
    files.value = res.data || []
  } catch {
    files.value = []
  } finally {
    loading.value = false
  }
}

function handlePreview(file: FileItem) {
  previewFile.value = file
  showPreview.value = true
}

onMounted(() => loadFiles())
watch(fileType, () => loadFiles())
</script>

<style scoped lang="scss">
.category-page {
  .toolbar {
    padding: 12px 0;
    margin-bottom: 8px;

    h3 {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 18px;
      color: #303133;
    }
  }

  .loading-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 80px 0;
    color: #909399;
  }

  .file-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 16px;
  }

  .file-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 20px 12px 16px;
    background: #fff;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.2s;
    user-select: none;

    &:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
      transform: translateY(-2px);
    }

    .file-icon { margin-bottom: 12px; }
    .file-name {
      font-size: 13px;
      color: #303133;
      max-width: 100%;
      text-align: center;
    }
    .file-meta {
      font-size: 12px;
      color: #909399;
      margin-top: 4px;
    }
  }
}
</style>
