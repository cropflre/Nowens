<template>
  <div class="admin-page">
    <div class="admin-header">
      <h2><el-icon><Setting /></el-icon> 管理员后台</h2>
    </div>

    <el-tabs v-model="activeTab" type="border-card">
      <!-- 系统概览 -->
      <el-tab-pane label="系统概览" name="dashboard">
        <div v-if="dashboard" class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">{{ dashboard.user_count }}</div>
            <div class="stat-label">用户数</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ dashboard.file_count }}</div>
            <div class="stat-label">文件数</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ dashboard.folder_count }}</div>
            <div class="stat-label">文件夹数</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ dashboard.share_count }}</div>
            <div class="stat-label">分享数</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ formatFileSize(dashboard.total_storage) }}</div>
            <div class="stat-label">总存储使用</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ dashboard.today_uploads }}</div>
            <div class="stat-label">今日上传</div>
          </div>
        </div>
      </el-tab-pane>

      <!-- 用户管理 -->
      <el-tab-pane label="用户管理" name="users">
        <el-table :data="users" style="width: 100%">
          <el-table-column prop="id" label="ID" width="70" />
          <el-table-column prop="username" label="用户名" width="140" />
          <el-table-column prop="nickname" label="昵称" width="140" />
          <el-table-column label="角色" width="100">
            <template #default="{ row }">
              <el-tag :type="row.role === 'admin' ? 'danger' : 'info'" size="small">
                {{ row.role === 'admin' ? '管理员' : '用户' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="存储使用" width="200">
            <template #default="{ row }">
              <el-progress
                :percentage="Math.round((row.storage_used / row.storage_limit) * 100)"
                :stroke-width="6"
                :show-text="false"
                style="margin-bottom: 4px"
              />
              <span class="storage-text">
                {{ formatFileSize(row.storage_used) }} / {{ formatFileSize(row.storage_limit) }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="注册时间" width="160">
            <template #default="{ row }">{{ formatDate(row.created_at) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="260" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="handleEditUser(row)">编辑</el-button>
              <el-button link type="warning" size="small" @click="handleResetPwd(row)">重置密码</el-button>
              <el-button link type="danger" size="small" @click="handleDeleteUser(row)" :disabled="row.role === 'admin'">
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-pagination
          v-model:current-page="userPage"
          :page-size="20"
          :total="userTotal"
          layout="total, prev, pager, next"
          style="margin-top: 16px; justify-content: flex-end"
          @current-change="loadUsers"
        />
      </el-tab-pane>

      <!-- 审计日志 -->
      <el-tab-pane label="审计日志" name="logs">
        <div class="log-filters" style="margin-bottom: 12px">
          <el-select v-model="logAction" placeholder="操作类型" clearable style="width: 160px" @change="loadLogs">
            <el-option label="登录" value="login" />
            <el-option label="上传" value="upload" />
            <el-option label="下载" value="download" />
            <el-option label="删除" value="delete" />
            <el-option label="分享" value="share" />
            <el-option label="管理员操作" value="admin_update" />
          </el-select>
        </div>
        <el-table :data="logs" style="width: 100%">
          <el-table-column prop="id" label="ID" width="70" />
          <el-table-column prop="username" label="用户" width="120" />
          <el-table-column label="操作" width="120">
            <template #default="{ row }">
              <el-tag size="small">{{ row.action }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="resource" label="资源" width="80" />
          <el-table-column prop="detail" label="详情" min-width="240" show-overflow-tooltip />
          <el-table-column prop="ip" label="IP" width="140" />
          <el-table-column label="时间" width="180">
            <template #default="{ row }">{{ formatDate(row.created_at) }}</template>
          </el-table-column>
        </el-table>
        <el-pagination
          v-model:current-page="logPage"
          :page-size="20"
          :total="logTotal"
          layout="total, prev, pager, next"
          style="margin-top: 16px; justify-content: flex-end"
          @current-change="loadLogs"
        />
      </el-tab-pane>
    </el-tabs>

    <!-- 编辑用户弹窗 -->
    <el-dialog v-model="showEditDialog" title="编辑用户" width="460px">
      <el-form v-if="editingUser" label-width="80px">
        <el-form-item label="用户名">
          <el-input :model-value="editingUser.username" disabled />
        </el-form-item>
        <el-form-item label="昵称">
          <el-input v-model="editForm.nickname" />
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="editForm.role" style="width: 100%">
            <el-option label="普通用户" value="user" />
            <el-option label="管理员" value="admin" />
          </el-select>
        </el-form-item>
        <el-form-item label="存储限额">
          <el-select v-model="editForm.storage_limit" style="width: 100%">
            <el-option label="1 GB" :value="1073741824" />
            <el-option label="5 GB" :value="5368709120" />
            <el-option label="10 GB" :value="10737418240" />
            <el-option label="50 GB" :value="53687091200" />
            <el-option label="100 GB" :value="107374182400" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditDialog = false">取消</el-button>
        <el-button type="primary" @click="submitEditUser">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Setting } from '@element-plus/icons-vue'
import type { User, AdminDashboard, AuditLog } from '@/types'
import { getDashboard, getUsers, updateUser, deleteUser, resetPassword, getAuditLogs } from '@/api/admin'
import { formatFileSize, formatDate } from '@/utils'

const activeTab = ref('dashboard')

// 系统概览
const dashboard = ref<AdminDashboard | null>(null)

// 用户管理
const users = ref<User[]>([])
const userPage = ref(1)
const userTotal = ref(0)

// 审计日志
const logs = ref<AuditLog[]>([])
const logPage = ref(1)
const logTotal = ref(0)
const logAction = ref('')

// 编辑用户
const showEditDialog = ref(false)
const editingUser = ref<User | null>(null)
const editForm = reactive({
  nickname: '',
  role: '',
  storage_limit: 0,
})

onMounted(() => {
  loadDashboard()
  loadUsers()
  loadLogs()
})

async function loadDashboard() {
  try {
    const res = await getDashboard()
    dashboard.value = res.data!
  } catch { /* */ }
}

async function loadUsers() {
  try {
    const res = await getUsers(userPage.value)
    users.value = res.data!.list || []
    userTotal.value = res.data!.total
  } catch { /* */ }
}

async function loadLogs() {
  try {
    const res = await getAuditLogs(logPage.value, 20, undefined, logAction.value)
    logs.value = res.data!.list || []
    logTotal.value = res.data!.total
  } catch { /* */ }
}

function handleEditUser(user: User) {
  editingUser.value = user
  editForm.nickname = user.nickname
  editForm.role = user.role
  editForm.storage_limit = user.storage_limit
  showEditDialog.value = true
}

async function submitEditUser() {
  if (!editingUser.value) return
  try {
    await updateUser(editingUser.value.id, {
      nickname: editForm.nickname,
      role: editForm.role,
      storage_limit: editForm.storage_limit,
    })
    ElMessage.success('更新成功')
    showEditDialog.value = false
    loadUsers()
  } catch { /* */ }
}

async function handleResetPwd(user: User) {
  try {
    const { value } = await ElMessageBox.prompt(
      `重置用户「${user.username}」的密码`,
      '重置密码',
      { inputPlaceholder: '请输入新密码（至少6位）', inputType: 'password' }
    )
    if (!value || value.length < 6) {
      ElMessage.warning('密码不能少于6位')
      return
    }
    await resetPassword(user.id, value)
    ElMessage.success('密码已重置')
  } catch { /* */ }
}

async function handleDeleteUser(user: User) {
  try {
    await ElMessageBox.confirm(`确定要删除用户「${user.username}」吗？此操作不可恢复`, '删除确认', { type: 'warning' })
    await deleteUser(user.id)
    ElMessage.success('用户已删除')
    loadUsers()
  } catch { /* */ }
}
</script>

<style scoped lang="scss">
.admin-page {
  .admin-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 0;
    margin-bottom: 16px;

    h2 {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 20px;
      color: #303133;
    }
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 16px;
    padding: 12px 0;
  }

  .stat-card {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 12px;
    padding: 24px 20px;
    color: #fff;
    text-align: center;

    &:nth-child(2) { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }
    &:nth-child(3) { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); }
    &:nth-child(4) { background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%); }
    &:nth-child(5) { background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); }
    &:nth-child(6) { background: linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%); }

    .stat-value {
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 8px;
    }

    .stat-label {
      font-size: 14px;
      opacity: 0.9;
    }
  }

  .storage-text {
    font-size: 12px;
    color: #909399;
  }
}
</style>
