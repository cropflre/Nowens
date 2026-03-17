<template>
  <div class="files-page">
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <!-- 面包屑导航 -->
        <el-breadcrumb separator="/">
          <el-breadcrumb-item @click="fileStore.goHome()">
            <el-icon><HomeFilled /></el-icon>
            <span style="cursor: pointer">全部文件</span>
          </el-breadcrumb-item>
          <el-breadcrumb-item
            v-for="item in fileStore.breadcrumb"
            :key="item.id"
            @click="fileStore.enterFolder(item.id)"
          >
            <span style="cursor: pointer">{{ item.name }}</span>
          </el-breadcrumb-item>
        </el-breadcrumb>
      </div>

      <div class="toolbar-right">
        <!-- 上传按钮 -->
        <el-button type="primary" @click="triggerUpload">
          <el-icon><Upload /></el-icon>上传文件
        </el-button>
        <input
          ref="fileInputRef"
          type="file"
          multiple
          style="display: none"
          @change="handleFileSelected"
        />

        <!-- 新建文件夹 -->
        <el-button @click="showNewFolderDialog = true">
          <el-icon><FolderAdd /></el-icon>新建文件夹
        </el-button>

        <!-- 多选模式切换 -->
        <el-button @click="isMultiSelect = !isMultiSelect; selectedIds = new Set()">
          <el-icon><Select /></el-icon>
          {{ isMultiSelect ? '取消多选' : '多选' }}
        </el-button>

        <!-- 视图切换 -->
        <el-button-group>
          <el-button
            :type="fileStore.viewMode === 'grid' ? 'primary' : 'default'"
            @click="fileStore.viewMode = 'grid'"
          >
            <el-icon><Grid /></el-icon>
          </el-button>
          <el-button
            :type="fileStore.viewMode === 'list' ? 'primary' : 'default'"
            @click="fileStore.viewMode = 'list'"
          >
            <el-icon><List /></el-icon>
          </el-button>
        </el-button-group>
      </div>
    </div>

    <!-- 批量操作栏 -->
    <div v-if="isMultiSelect" class="batch-toolbar">
      <el-checkbox
        :model-value="selectedIds.size > 0 && selectedIds.size === displayFiles.length"
        :indeterminate="selectedIds.size > 0 && selectedIds.size < displayFiles.length"
        @change="toggleSelectAll"
      >全选</el-checkbox>
      <span class="batch-info">已选 {{ selectedIds.size }} 项</span>
      <el-button type="danger" size="small" :disabled="selectedIds.size === 0" @click="handleBatchTrash">
        <el-icon><Delete /></el-icon>批量删除
      </el-button>
      <el-button size="small" @click="exitMultiSelect">取消</el-button>
    </div>

    <!-- 搜索结果提示 -->
    <div v-if="isSearchMode" class="search-tip">
      <span>搜索 "{{ searchKeyword }}" 的结果（{{ searchResults.length }} 个）</span>
      <el-button link type="primary" @click="exitSearch">清除搜索</el-button>
    </div>

    <!-- 加载状态 -->
    <div v-if="fileStore.loading" class="loading-wrapper">
      <el-icon class="is-loading" :size="32"><Loading /></el-icon>
      <p>加载中...</p>
    </div>

    <!-- 空状态 -->
    <el-empty
      v-else-if="displayFiles.length === 0"
      description="暂无文件"
      :image-size="120"
    >
      <el-button type="primary" @click="triggerUpload">上传文件</el-button>
    </el-empty>

    <!-- 网格视图 -->
    <div v-else-if="fileStore.viewMode === 'grid'" class="file-grid">
      <div
        v-for="file in displayFiles"
        :key="file.id"
        class="file-card"
        :class="{ selected: selectedIds.has(file.id) }"
        @click="handleClick(file)"
        @dblclick="handleDoubleClick(file)"
        @contextmenu.prevent="showContextMenu($event, file)"
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
        <div class="file-meta">
          {{ file.is_dir ? '--' : formatFileSize(file.size) }}
        </div>
      </div>
    </div>

    <!-- 列表视图 -->
    <el-table
      v-else
      :data="displayFiles"
      style="width: 100%"
      @row-dblclick="handleDoubleClick"
      @row-contextmenu="(row: any, _col: any, e: MouseEvent) => { e.preventDefault(); showContextMenu(e, row) }"
    >
      <el-table-column label="文件名" min-width="300">
        <template #default="{ row }">
          <div class="list-file-name">
            <el-icon
              :size="24"
              :color="getFileColor(row.name, row.is_dir)"
            >
              <component :is="getFileIcon(row.name, row.is_dir)" />
            </el-icon>
            <span class="text-ellipsis">{{ row.name }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="大小" width="120">
        <template #default="{ row }">
          {{ row.is_dir ? '--' : formatFileSize(row.size) }}
        </template>
      </el-table-column>
      <el-table-column label="修改时间" width="180">
        <template #default="{ row }">
          {{ formatDate(row.updated_at) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" v-if="!row.is_dir" @click.stop="handleDownload(row)">
            下载
          </el-button>
          <el-button link type="primary" @click.stop="handleShare(row)">分享</el-button>
          <el-dropdown trigger="click" @command="(cmd: string) => handleAction(cmd, row)">
            <el-button link type="primary" @click.stop>更多</el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="rename">重命名</el-dropdown-item>
                <el-dropdown-item command="move">移动到</el-dropdown-item>
                <el-dropdown-item command="trash" divided>
                  <span style="color: #f56c6c">删除</span>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </template>
      </el-table-column>
    </el-table>

    <!-- 右键菜单 -->
    <div
      v-show="contextMenu.visible"
      class="context-menu"
      :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
    >
      <div class="menu-item" v-if="!contextMenu.file?.is_dir" @click="handlePreview(contextMenu.file!)">
        <el-icon><View /></el-icon>预览
      </div>
      <div class="menu-item" v-if="!contextMenu.file?.is_dir" @click="handleDownload(contextMenu.file!)">
        <el-icon><Download /></el-icon>下载
      </div>
      <div class="menu-item" @click="handleShare(contextMenu.file!)">
        <el-icon><Share /></el-icon>分享
      </div>
      <div class="menu-item" @click="handleAction('rename', contextMenu.file!)">
        <el-icon><Edit /></el-icon>重命名
      </div>
      <div class="menu-item" @click="handleAction('move', contextMenu.file!)">
        <el-icon><Rank /></el-icon>移动到
      </div>
      <div class="menu-item" v-if="!contextMenu.file?.is_dir" @click="handleVersions(contextMenu.file!)">
        <el-icon><Clock /></el-icon>版本历史
      </div>
      <div class="divider"></div>
      <div class="menu-item danger" @click="handleAction('trash', contextMenu.file!)">
        <el-icon><Delete /></el-icon>删除
      </div>
    </div>

    <!-- 新建文件夹弹窗 -->
    <el-dialog v-model="showNewFolderDialog" title="新建文件夹" width="400px">
      <el-input
        v-model="newFolderName"
        placeholder="请输入文件夹名称"
        @keyup.enter="handleCreateFolder"
      />
      <template #footer>
        <el-button @click="showNewFolderDialog = false">取消</el-button>
        <el-button type="primary" @click="handleCreateFolder">创建</el-button>
      </template>
    </el-dialog>

    <!-- 重命名弹窗 -->
    <el-dialog v-model="showRenameDialog" title="重命名" width="400px">
      <el-input
        v-model="renameValue"
        placeholder="请输入新名称"
        @keyup.enter="handleRename"
      />
      <template #footer>
        <el-button @click="showRenameDialog = false">取消</el-button>
        <el-button type="primary" @click="handleRename">确定</el-button>
      </template>
    </el-dialog>

    <!-- 分享弹窗 -->
    <el-dialog v-model="showShareDialog" title="分享文件" width="460px">
      <el-form label-width="80px">
        <el-form-item label="文件名">
          <span>{{ shareTarget?.name }}</span>
        </el-form-item>
        <el-form-item label="提取密码">
          <el-input v-model="sharePassword" placeholder="留空则无密码" maxlength="16" />
        </el-form-item>
        <el-form-item label="有效期">
          <el-select v-model="shareExpireDays" style="width: 100%">
            <el-option :value="0" label="永久有效" />
            <el-option :value="1" label="1 天" />
            <el-option :value="7" label="7 天" />
            <el-option :value="30" label="30 天" />
          </el-select>
        </el-form-item>
      </el-form>
      <div v-if="shareResult" class="share-result">
        <el-alert type="success" :closable="false">
          <p>分享链接已创建！</p>
          <p>分享码：<strong>{{ shareResult.code }}</strong></p>
          <el-button size="small" type="primary" @click="copyShareLink">复制链接</el-button>
        </el-alert>
      </div>
      <template #footer>
        <el-button @click="showShareDialog = false">关闭</el-button>
        <el-button v-if="!shareResult" type="primary" @click="handleCreateShare">创建分享</el-button>
      </template>
    </el-dialog>

    <!-- 文件预览弹窗 -->
    <FilePreview v-model="showPreview" :file="previewFile" />

    <!-- 文件版本历史弹窗 -->
    <FileVersions v-model="showVersions" :file="versionTarget" @restored="fileStore.loadFiles()" />

    <!-- 上传进度 -->
    <div v-if="uploadTasks.length > 0" class="upload-panel">
      <div class="upload-header">
        <span>上传列表 ({{ uploadTasks.length }})</span>
        <el-button link @click="uploadTasks = []">清空</el-button>
      </div>
      <div v-for="(task, i) in uploadTasks" :key="i" class="upload-item">
        <span class="text-ellipsis" style="flex: 1">{{ task.name }}</span>
        <el-progress
          v-if="task.status === 'uploading'"
          :percentage="task.percent"
          :stroke-width="4"
          style="width: 100px"
        />
        <el-tag v-else :type="task.status === 'done' ? 'success' : 'danger'" size="small">
          {{ task.status === 'done' ? '完成' : '失败' }}
        </el-tag>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  HomeFilled, Upload, FolderAdd, Grid, List, Loading,
  Download, Share, Edit, Rank, Delete, View, Select, Clock,
} from '@element-plus/icons-vue'
import { useFileStore } from '@/stores/file'
import type { FileItem, ShareLink } from '@/types'
import { formatFileSize, formatDate, getFileIcon, getFileColor } from '@/utils'
import { createFolder, uploadFile, renameFile, trashFile, searchFiles, getDownloadUrl, batchTrash, batchMove } from '@/api/file'
import { createShare } from '@/api/share'
import FilePreview from '@/components/FilePreview.vue'
import FileVersions from '@/components/FileVersions.vue'

const route = useRoute()
const router = useRouter()
const fileStore = useFileStore()

// 上传相关
const fileInputRef = ref<HTMLInputElement>()
interface UploadTask {
  name: string
  percent: number
  status: 'uploading' | 'done' | 'error'
}
const uploadTasks = ref<UploadTask[]>([])

// 选中状态（批量操作）
const selectedIds = ref(new Set<number>())
const isMultiSelect = ref(false)

// 搜索相关
const isSearchMode = ref(false)
const searchKeyword = ref('')
const searchResults = ref<FileItem[]>([])

// 新建文件夹
const showNewFolderDialog = ref(false)
const newFolderName = ref('')

// 重命名
const showRenameDialog = ref(false)
const renameValue = ref('')
const renameTarget = ref<FileItem | null>(null)

// 分享
const showShareDialog = ref(false)
const shareTarget = ref<FileItem | null>(null)
const sharePassword = ref('')
const shareExpireDays = ref(7)
const shareResult = ref<ShareLink | null>(null)

// 文件预览
const showPreview = ref(false)
const previewFile = ref<FileItem | null>(null)

// 文件版本
const showVersions = ref(false)
const versionTarget = ref<FileItem | null>(null)

// 右键菜单
const contextMenu = reactive({
  visible: false,
  x: 0,
  y: 0,
  file: null as FileItem | null,
})

// 显示的文件列表
const displayFiles = computed(() => {
  return isSearchMode.value ? searchResults.value : fileStore.files
})

// ==================== 生命周期 ====================
onMounted(() => {
  const search = route.query.search as string
  if (search) {
    handleSearchByKeyword(search)
  } else {
    fileStore.loadFiles(0)
  }
  document.addEventListener('click', hideContextMenu)
})

onUnmounted(() => {
  document.removeEventListener('click', hideContextMenu)
})

// 监听路由搜索参数
watch(() => route.query.search, (val) => {
  if (val) {
    handleSearchByKeyword(val as string)
  } else {
    exitSearch()
  }
})

// ==================== 文件操作 ====================
function handleClick(file: FileItem) {
  if (isMultiSelect.value) {
    // 多选模式：切换选中
    const newSet = new Set(selectedIds.value)
    if (newSet.has(file.id)) {
      newSet.delete(file.id)
    } else {
      newSet.add(file.id)
    }
    selectedIds.value = newSet
  } else {
    selectedIds.value = new Set([file.id])
  }
}

// 全选/取消全选
function toggleSelectAll() {
  if (selectedIds.value.size === displayFiles.value.length) {
    selectedIds.value = new Set()
  } else {
    selectedIds.value = new Set(displayFiles.value.map(f => f.id))
  }
}

// 批量删除（移入回收站）
async function handleBatchTrash() {
  if (selectedIds.value.size === 0) return
  try {
    await ElMessageBox.confirm(`确定要删除选中的 ${selectedIds.value.size} 个文件吗？`, '批量删除', {
      type: 'warning',
    })
    await batchTrash(Array.from(selectedIds.value))
    ElMessage.success(`已将 ${selectedIds.value.size} 个文件移入回收站`)
    selectedIds.value = new Set()
    isMultiSelect.value = false
    fileStore.loadFiles()
  } catch { /* 取消 */ }
}

// 退出多选
function exitMultiSelect() {
  isMultiSelect.value = false
  selectedIds.value = new Set()
}

function handleDoubleClick(file: FileItem) {
  if (file.is_dir) {
    isSearchMode.value = false
    fileStore.enterFolder(file.id)
  } else {
    // 非文件夹：打开预览弹窗
    previewFile.value = file
    showPreview.value = true
  }
}

function triggerUpload() {
  fileInputRef.value?.click()
}

async function handleFileSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const files = input.files
  if (!files || files.length === 0) return

  for (const file of Array.from(files)) {
    const task: UploadTask = { name: file.name, percent: 0, status: 'uploading' }
    uploadTasks.value.push(task)

    try {
      await uploadFile(fileStore.currentParentId, file, (percent) => {
        task.percent = percent
      })
      task.status = 'done'
      task.percent = 100
    } catch {
      task.status = 'error'
    }
  }

  // 刷新文件列表
  fileStore.loadFiles()
  input.value = '' // 清空 input
}

async function handleCreateFolder() {
  if (!newFolderName.value.trim()) {
    ElMessage.warning('请输入文件夹名称')
    return
  }
  try {
    await createFolder({ parent_id: fileStore.currentParentId, name: newFolderName.value.trim() })
    ElMessage.success('创建成功')
    showNewFolderDialog.value = false
    newFolderName.value = ''
    fileStore.loadFiles()
  } catch {
    // 已在拦截器处理
  }
}

function handleDownload(file: FileItem) {
  const url = getDownloadUrl(file.uuid)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  a.click()
}

function handlePreview(file: FileItem) {
  hideContextMenu()
  previewFile.value = file
  showPreview.value = true
}

function handleVersions(file: FileItem) {
  hideContextMenu()
  versionTarget.value = file
  showVersions.value = true
}

function handleShare(file: FileItem) {
  shareTarget.value = file
  sharePassword.value = ''
  shareExpireDays.value = 7
  shareResult.value = null
  showShareDialog.value = true
}

async function handleCreateShare() {
  if (!shareTarget.value) return
  try {
    const res = await createShare({
      file_id: shareTarget.value.id,
      password: sharePassword.value || undefined,
      expire_days: shareExpireDays.value,
    })
    shareResult.value = res.data!
    ElMessage.success('分享创建成功')
  } catch {
    // 已在拦截器处理
  }
}

function copyShareLink() {
  if (!shareResult.value) return
  const url = `${window.location.origin}/share/${shareResult.value.code}`
  navigator.clipboard.writeText(url)
  ElMessage.success('链接已复制到剪贴板')
}

async function handleAction(action: string, file: FileItem) {
  hideContextMenu()

  switch (action) {
    case 'rename':
      renameTarget.value = file
      renameValue.value = file.name
      showRenameDialog.value = true
      break

    case 'trash':
      try {
        await ElMessageBox.confirm(`确定要删除「${file.name}」吗？`, '删除确认', {
          type: 'warning',
          confirmButtonText: '删除',
          cancelButtonText: '取消',
        })
        await trashFile({ file_id: file.id })
        ElMessage.success('已移入回收站')
        fileStore.loadFiles()
      } catch {
        // 取消或失败
      }
      break

    case 'move':
      ElMessage.info('移动功能开发中...')
      break
  }
}

async function handleRename() {
  if (!renameTarget.value || !renameValue.value.trim()) return
  try {
    await renameFile({ file_id: renameTarget.value.id, new_name: renameValue.value.trim() })
    ElMessage.success('重命名成功')
    showRenameDialog.value = false
    fileStore.loadFiles()
  } catch {
    // 已在拦截器处理
  }
}

// ==================== 搜索 ====================
async function handleSearchByKeyword(keyword: string) {
  searchKeyword.value = keyword
  isSearchMode.value = true
  try {
    const res = await searchFiles(keyword)
    searchResults.value = res.data || []
  } catch {
    searchResults.value = []
  }
}

function exitSearch() {
  isSearchMode.value = false
  searchKeyword.value = ''
  searchResults.value = []
  router.replace({ path: '/files' })
  fileStore.loadFiles(0)
}

// ==================== 右键菜单 ====================
function showContextMenu(e: MouseEvent, file: FileItem) {
  contextMenu.visible = true
  contextMenu.x = e.clientX
  contextMenu.y = e.clientY
  contextMenu.file = file
}

function hideContextMenu() {
  contextMenu.visible = false
}
</script>

<style scoped lang="scss">
.files-page {
  position: relative;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  margin-bottom: 8px;

  .toolbar-right {
    display: flex;
    gap: 8px;
  }
}

.search-tip {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: #ecf5ff;
  border-radius: 6px;
  margin-bottom: 12px;
  font-size: 14px;
  color: #409eff;
}

.batch-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  background: #fdf6ec;
  border: 1px solid #faecd8;
  border-radius: 8px;
  margin-bottom: 12px;

  .batch-info {
    font-size: 14px;
    color: #e6a23c;
    font-weight: 500;
  }
}

.loading-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 0;
  color: #909399;
}

// ==================== 网格视图 ====================
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
  border: 2px solid transparent;
  user-select: none;

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    transform: translateY(-2px);
  }

  &.selected {
    border-color: #409eff;
    background: #ecf5ff;
  }

  .file-icon {
    margin-bottom: 12px;
  }

  .file-name {
    font-size: 13px;
    color: #303133;
    max-width: 100%;
    text-align: center;
    line-height: 1.4;
  }

  .file-meta {
    font-size: 12px;
    color: #909399;
    margin-top: 4px;
  }
}

// ==================== 列表视图 ====================
.list-file-name {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

// ==================== 右键菜单 ====================
.context-menu {
  position: fixed;
  z-index: 9999;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
  padding: 6px 0;
  min-width: 160px;

  .menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    font-size: 14px;
    cursor: pointer;
    color: #303133;

    &:hover {
      background: #f5f7fa;
    }

    &.danger {
      color: #f56c6c;
    }
  }

  .divider {
    height: 1px;
    background: #ebeef5;
    margin: 4px 0;
  }
}

// ==================== 分享结果 ====================
.share-result {
  margin-top: 16px;
}

// ==================== 上传面板 ====================
.upload-panel {
  position: fixed;
  right: 24px;
  bottom: 24px;
  width: 360px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  z-index: 100;
  overflow: hidden;

  .upload-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: #409eff;
    color: #fff;
    font-weight: 500;
  }

  .upload-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    font-size: 13px;
    border-bottom: 1px solid #f0f0f0;
  }
}
</style>
