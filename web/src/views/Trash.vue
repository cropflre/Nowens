<template>
  <div class="trash-page">
    <div class="toolbar">
      <h3>
        <el-icon><Delete /></el-icon>
        回收站
      </h3>
      <el-button type="danger" plain :disabled="files.length === 0" @click="handleClearAll">
        清空回收站
      </el-button>
    </div>

    <!-- 空状态 -->
    <el-empty v-if="files.length === 0" description="回收站是空的" :image-size="120" />

    <!-- 文件列表 -->
    <el-table v-else :data="files" style="width: 100%">
      <el-table-column label="文件名" min-width="300">
        <template #default="{ row }">
          <div class="list-file-name">
            <el-icon
              :size="24"
              :color="getFileColor(row.name, row.is_dir)"
            >
              <component :is="getFileIcon(row.name, row.is_dir)" />
            </el-icon>
            <span>{{ row.name }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="大小" width="120">
        <template #default="{ row }">
          {{ row.is_dir ? '--' : formatFileSize(row.size) }}
        </template>
      </el-table-column>
      <el-table-column label="删除时间" width="180">
        <template #default="{ row }">
          {{ formatDate(row.trashed_at) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="handleRestore(row)">恢复</el-button>
          <el-button link type="danger" @click="handleDelete(row)">永久删除</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete } from '@element-plus/icons-vue'
import type { FileItem } from '@/types'
import { getTrashList, restoreFile, deleteFile } from '@/api/file'
import { formatFileSize, formatDate, getFileIcon, getFileColor } from '@/utils'

const files = ref<FileItem[]>([])

async function loadTrash() {
  try {
    const res = await getTrashList()
    files.value = res.data || []
  } catch {
    // 已在拦截器处理
  }
}

async function handleRestore(file: FileItem) {
  try {
    await restoreFile({ file_id: file.id })
    ElMessage.success('已恢复')
    loadTrash()
  } catch {
    // 已在拦截器处理
  }
}

async function handleDelete(file: FileItem) {
  try {
    await ElMessageBox.confirm(
      `永久删除「${file.name}」后将无法恢复，是否继续？`,
      '永久删除',
      { type: 'warning', confirmButtonText: '永久删除', cancelButtonText: '取消' }
    )
    await deleteFile(file.id)
    ElMessage.success('已永久删除')
    loadTrash()
  } catch {
    // 取消或失败
  }
}

async function handleClearAll() {
  try {
    await ElMessageBox.confirm(
      '确定要清空回收站吗？所有文件将被永久删除且无法恢复！',
      '清空回收站',
      { type: 'warning', confirmButtonText: '清空', cancelButtonText: '取消' }
    )
    for (const file of files.value) {
      await deleteFile(file.id)
    }
    ElMessage.success('回收站已清空')
    loadTrash()
  } catch {
    // 取消或失败
  }
}

onMounted(() => {
  loadTrash()
})
</script>

<style scoped lang="scss">
.trash-page {
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
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

  .list-file-name {
    display: flex;
    align-items: center;
    gap: 8px;
  }
}
</style>
