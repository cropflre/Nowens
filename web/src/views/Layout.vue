<template>
  <el-container class="layout">
    <!-- 侧边栏 -->
    <el-aside :width="sidebarCollapsed ? '64px' : '220px'" class="sidebar">
      <!-- Logo -->
      <div class="sidebar-logo" @click="fileStore.goHome()">
        <el-icon :size="28" color="#409eff"><FolderOpened /></el-icon>
        <span v-if="!sidebarCollapsed" class="logo-text">Nowen File</span>
      </div>

      <!-- 导航菜单 -->
      <el-menu
        :default-active="activeMenu"
        :collapse="sidebarCollapsed"
        router
        class="sidebar-menu"
      >
        <el-menu-item index="/files">
          <el-icon><FolderOpened /></el-icon>
          <template #title>全部文件</template>
        </el-menu-item>

        <!-- 文件分类 -->
        <el-sub-menu index="category" v-if="!sidebarCollapsed">
          <template #title>
            <el-icon><Grid /></el-icon>
            <span>文件分类</span>
          </template>
          <el-menu-item index="/category/image">
            <el-icon><Picture /></el-icon>
            <template #title>图片</template>
          </el-menu-item>
          <el-menu-item index="/category/video">
            <el-icon><VideoCamera /></el-icon>
            <template #title>视频</template>
          </el-menu-item>
          <el-menu-item index="/category/audio">
            <el-icon><Headset /></el-icon>
            <template #title>音频</template>
          </el-menu-item>
          <el-menu-item index="/category/document">
            <el-icon><Document /></el-icon>
            <template #title>文档</template>
          </el-menu-item>
        </el-sub-menu>

        <el-menu-item index="/shares">
          <el-icon><Share /></el-icon>
          <template #title>我的分享</template>
        </el-menu-item>
        <el-menu-item index="/trash">
          <el-icon><Delete /></el-icon>
          <template #title>回收站</template>
        </el-menu-item>

        <!-- 管理员入口 -->
        <el-menu-item v-if="userStore.user?.role === 'admin'" index="/admin">
          <el-icon><Setting /></el-icon>
          <template #title>管理后台</template>
        </el-menu-item>
      </el-menu>

      <!-- 存储空间 -->
      <div v-if="!sidebarCollapsed" class="storage-info">
        <div class="storage-bar">
          <el-progress
            :percentage="storagePercent"
            :stroke-width="6"
            :show-text="false"
            :color="storagePercent > 90 ? '#f56c6c' : '#409eff'"
          />
        </div>
        <div class="storage-text">
          {{ formatFileSize(userStore.user?.storage_used || 0) }} /
          {{ formatFileSize(userStore.user?.storage_limit || 0) }}
        </div>
      </div>

      <!-- 折叠按钮 -->
      <div class="collapse-btn" @click="sidebarCollapsed = !sidebarCollapsed">
        <el-icon>
          <component :is="sidebarCollapsed ? 'Expand' : 'Fold'" />
        </el-icon>
      </div>
    </el-aside>

    <!-- 主内容区 -->
    <el-container>
      <!-- 顶部栏 -->
      <el-header class="header">
        <div class="header-left">
          <el-input
            v-model="searchKeyword"
            placeholder="搜索文件..."
            :prefix-icon="Search"
            clearable
            style="width: 320px"
            @keyup.enter="handleSearch"
            @clear="handleClearSearch"
          />
        </div>
        <div class="header-right">
          <el-dropdown @command="handleUserCommand">
            <div class="user-info">
              <el-avatar :size="32" :src="userStore.user?.avatar">
                {{ userStore.user?.nickname?.charAt(0) || 'U' }}
              </el-avatar>
              <span class="username">{{ userStore.user?.nickname || userStore.user?.username }}</span>
              <el-icon><ArrowDown /></el-icon>
            </div>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="profile">
                  <el-icon><User /></el-icon>个人资料
                </el-dropdown-item>
                <el-dropdown-item divided command="logout">
                  <el-icon><SwitchButton /></el-icon>退出登录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <!-- 页面内容 -->
      <el-main class="main-content">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { useFileStore } from '@/stores/file'
import { formatFileSize } from '@/utils'
import {
  FolderOpened, Delete, Search, ArrowDown,
  User, SwitchButton, Grid, Picture, VideoCamera,
  Headset, Document, Share, Setting,
} from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const fileStore = useFileStore()

const sidebarCollapsed = ref(false)
const searchKeyword = ref('')

const activeMenu = computed(() => route.path)

const storagePercent = computed(() => {
  const used = userStore.user?.storage_used || 0
  const limit = userStore.user?.storage_limit || 1
  return Math.min(Math.round((used / limit) * 100), 100)
})

function handleSearch() {
  if (searchKeyword.value.trim()) {
    router.push({ path: '/files', query: { search: searchKeyword.value } })
  }
}

function handleClearSearch() {
  searchKeyword.value = ''
  fileStore.loadFiles(0)
}

function handleUserCommand(command: string) {
  if (command === 'logout') {
    userStore.logout()
  }
}
</script>

<style scoped lang="scss">
.layout {
  height: 100vh;
}

.sidebar {
  background: #1e1e2d;
  display: flex;
  flex-direction: column;
  transition: width 0.3s;
  overflow: hidden;
}

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 20px 18px;
  cursor: pointer;

  .logo-text {
    font-size: 18px;
    font-weight: 700;
    color: #fff;
    white-space: nowrap;
  }
}

.sidebar-menu {
  border-right: none;
  background: transparent;
  flex: 1;

  :deep(.el-menu-item) {
    color: #a2a3b7;
    &:hover, &.is-active {
      background: rgba(255, 255, 255, 0.06);
      color: #fff;
    }
  }
}

.storage-info {
  padding: 16px;
  margin: 0 8px 8px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;

  .storage-text {
    font-size: 12px;
    color: #a2a3b7;
    margin-top: 8px;
    text-align: center;
  }
}

.collapse-btn {
  padding: 12px;
  text-align: center;
  cursor: pointer;
  color: #a2a3b7;
  border-top: 1px solid rgba(255, 255, 255, 0.06);

  &:hover {
    color: #fff;
  }
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 60px !important;
  padding: 0 24px;
  background: #fff;
  border-bottom: 1px solid #ebeef5;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;

  .username {
    font-size: 14px;
    color: #303133;
  }
}

.main-content {
  background: #f5f7fa;
  overflow-y: auto;
}
</style>
