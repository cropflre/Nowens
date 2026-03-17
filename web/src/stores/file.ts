import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { FileItem } from '@/types'
import { getFileList } from '@/api/file'

export const useFileStore = defineStore('file', () => {
  const files = ref<FileItem[]>([])
  const breadcrumb = ref<FileItem[]>([])
  const currentParentId = ref(0)
  const loading = ref(false)
  const sortBy = ref('updated_at')
  const sortOrder = ref('desc')
  const viewMode = ref<'grid' | 'list'>(
    (localStorage.getItem('viewMode') as 'grid' | 'list') || 'grid'
  )

  // 加载文件列表
  async function loadFiles(parentId?: number) {
    if (parentId !== undefined) {
      currentParentId.value = parentId
    }
    loading.value = true
    try {
      const res = await getFileList({
        parent_id: currentParentId.value,
        sort: sortBy.value,
        order: sortOrder.value,
      })
      files.value = res.data!.files || []
      breadcrumb.value = res.data!.breadcrumb || []
    } catch {
      // 错误已在拦截器处理
    } finally {
      loading.value = false
    }
  }

  // 切换视图模式
  function toggleViewMode() {
    viewMode.value = viewMode.value === 'grid' ? 'list' : 'grid'
    localStorage.setItem('viewMode', viewMode.value)
  }

  // 进入文件夹
  function enterFolder(folderId: number) {
    loadFiles(folderId)
  }

  // 返回上级
  function goBack() {
    if (breadcrumb.value.length > 0) {
      const parent = breadcrumb.value[breadcrumb.value.length - 1]
      loadFiles(parent.parent_id)
    } else {
      loadFiles(0)
    }
  }

  // 回到根目录
  function goHome() {
    loadFiles(0)
  }

  return {
    files,
    breadcrumb,
    currentParentId,
    loading,
    sortBy,
    sortOrder,
    viewMode,
    loadFiles,
    toggleViewMode,
    enterFolder,
    goBack,
    goHome,
  }
})
