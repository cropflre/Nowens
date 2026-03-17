<template>
  <div class="shares-page">
    <div class="toolbar">
      <h3>
        <el-icon><Share /></el-icon>
        我的分享
      </h3>
    </div>

    <!-- 空状态 -->
    <el-empty v-if="shares.length === 0" description="暂无分享链接" :image-size="120" />

    <!-- 分享列表 -->
    <el-table v-else :data="shares" style="width: 100%">
      <el-table-column label="分享码" width="140">
        <template #default="{ row }">
          <el-tag>{{ row.code }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="文件ID" width="100" prop="file_id" />
      <el-table-column label="查看" width="80" prop="view_count" />
      <el-table-column label="下载" width="80" prop="download_count" />
      <el-table-column label="过期时间" width="180">
        <template #default="{ row }">
          <span v-if="row.expire_at">{{ formatDate(row.expire_at) }}</span>
          <el-tag v-else type="success" size="small">永久</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="创建时间" width="180">
        <template #default="{ row }">
          {{ formatDate(row.created_at) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="copyLink(row.code)">复制链接</el-button>
          <el-button link type="danger" @click="handleDelete(row.id)">取消分享</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Share } from '@element-plus/icons-vue'
import type { ShareLink } from '@/types'
import { getShareList, deleteShare } from '@/api/share'
import { formatDate } from '@/utils'

const shares = ref<ShareLink[]>([])

async function loadShares() {
  try {
    const res = await getShareList()
    shares.value = res.data || []
  } catch {
    // 已在拦截器处理
  }
}

function copyLink(code: string) {
  const url = `${window.location.origin}/share/${code}`
  navigator.clipboard.writeText(url)
  ElMessage.success('分享链接已复制到剪贴板')
}

async function handleDelete(id: number) {
  try {
    await ElMessageBox.confirm('确定要取消该分享吗？', '取消分享', {
      type: 'warning',
      confirmButtonText: '确定',
      cancelButtonText: '取消',
    })
    await deleteShare(id)
    ElMessage.success('已取消分享')
    loadShares()
  } catch {
    // 取消或失败
  }
}

onMounted(() => loadShares())
</script>

<style scoped lang="scss">
.shares-page {
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
}
</style>
