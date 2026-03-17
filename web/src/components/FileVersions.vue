<template>
  <el-dialog
    v-model="visible"
    :title="'版本历史 — ' + (file?.name || '')"
    width="600px"
    destroy-on-close
  >
    <div v-if="loading" class="loading-wrapper">
      <el-icon class="is-loading" :size="24"><Loading /></el-icon>
      <span>加载中...</span>
    </div>

    <el-empty v-else-if="versions.length === 0" description="暂无历史版本" :image-size="80" />

    <el-timeline v-else>
      <el-timeline-item
        v-for="ver in versions"
        :key="ver.id"
        :timestamp="formatDate(ver.created_at)"
        placement="top"
      >
        <el-card shadow="hover" class="version-card">
          <div class="version-info">
            <div class="version-main">
              <el-tag size="small" type="info">v{{ ver.version }}</el-tag>
              <span class="version-size">{{ formatFileSize(ver.size) }}</span>
              <span v-if="ver.comment" class="version-comment">{{ ver.comment }}</span>
            </div>
            <div class="version-actions">
              <el-button link type="primary" size="small" @click="handleRestore(ver)">
                回滚到此版本
              </el-button>
              <el-button link type="danger" size="small" @click="handleDelete(ver)">
                删除
              </el-button>
            </div>
          </div>
        </el-card>
      </el-timeline-item>
    </el-timeline>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Loading } from '@element-plus/icons-vue'
import type { FileItem, FileVersion } from '@/types'
import { getFileVersions, restoreVersion, deleteVersion } from '@/api/file'
import { formatFileSize, formatDate } from '@/utils'

const props = defineProps<{
  modelValue: boolean
  file: FileItem | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
  (e: 'restored'): void
}>()

const visible = ref(props.modelValue)
const loading = ref(false)
const versions = ref<FileVersion[]>([])

watch(() => props.modelValue, (val) => {
  visible.value = val
  if (val && props.file) {
    loadVersions()
  }
})

watch(visible, (val) => {
  emit('update:modelValue', val)
})

async function loadVersions() {
  if (!props.file) return
  loading.value = true
  try {
    const res = await getFileVersions(props.file.id)
    versions.value = res.data?.versions || []
  } catch {
    versions.value = []
  } finally {
    loading.value = false
  }
}

async function handleRestore(ver: FileVersion) {
  if (!props.file) return
  try {
    await ElMessageBox.confirm(
      `确定要回滚到 v${ver.version} 吗？当前版本将自动保存。`,
      '回滚版本',
      { type: 'warning' }
    )
    await restoreVersion(props.file.id, ver.id)
    ElMessage.success('已回滚到该版本')
    loadVersions()
    emit('restored')
  } catch { /* */ }
}

async function handleDelete(ver: FileVersion) {
  if (!props.file) return
  try {
    await ElMessageBox.confirm(`确定要删除 v${ver.version} 吗？`, '删除版本', { type: 'warning' })
    await deleteVersion(props.file.id, ver.id)
    ElMessage.success('版本已删除')
    loadVersions()
  } catch { /* */ }
}
</script>

<style scoped lang="scss">
.loading-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px 0;
  color: #909399;
}

.version-card {
  :deep(.el-card__body) {
    padding: 12px 16px;
  }
}

.version-info {
  display: flex;
  justify-content: space-between;
  align-items: center;

  .version-main {
    display: flex;
    align-items: center;
    gap: 10px;

    .version-size {
      font-size: 13px;
      color: #606266;
    }

    .version-comment {
      font-size: 12px;
      color: #909399;
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .version-actions {
    display: flex;
    gap: 4px;
  }
}
</style>
