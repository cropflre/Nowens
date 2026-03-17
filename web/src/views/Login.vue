<template>
  <div class="login-page">
    <div class="login-card">
      <!-- Logo -->
      <div class="login-header">
        <el-icon :size="48" color="#409eff"><FolderOpened /></el-icon>
        <h1>Nowen File</h1>
        <p>现代化文件管理系统</p>
      </div>

      <!-- 表单 -->
      <el-form ref="formRef" :model="form" :rules="rules" @keyup.enter="handleSubmit">
        <el-form-item prop="username">
          <el-input
            v-model="form.username"
            placeholder="请输入用户名"
            :prefix-icon="User"
            size="large"
          />
        </el-form-item>

        <el-form-item prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="请输入密码"
            show-password
            :prefix-icon="Lock"
            size="large"
          />
        </el-form-item>

        <el-form-item v-if="isRegister" prop="nickname">
          <el-input
            v-model="form.nickname"
            placeholder="请输入昵称（选填）"
            :prefix-icon="UserFilled"
            size="large"
          />
        </el-form-item>

        <el-form-item>
          <el-button
            type="primary"
            size="large"
            :loading="loading"
            style="width: 100%"
            @click="handleSubmit"
          >
            {{ isRegister ? '注 册' : '登 录' }}
          </el-button>
        </el-form-item>
      </el-form>

      <!-- 切换登录/注册 -->
      <div class="switch-mode">
        <span>{{ isRegister ? '已有账号？' : '没有账号？' }}</span>
        <el-button type="primary" link @click="toggleMode">
          {{ isRegister ? '去登录' : '去注册' }}
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { User, Lock, UserFilled, FolderOpened } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'
import type { FormInstance } from 'element-plus'

const userStore = useUserStore()
const formRef = ref<FormInstance>()
const isRegister = ref(false)
const loading = ref(false)

const form = reactive({
  username: '',
  password: '',
  nickname: '',
})

const rules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 32, message: '用户名长度 3-32 位', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, max: 64, message: '密码长度 6-64 位', trigger: 'blur' },
  ],
}

function toggleMode() {
  isRegister.value = !isRegister.value
  formRef.value?.resetFields()
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  loading.value = true
  try {
    if (isRegister.value) {
      await userStore.register(form.username, form.password, form.nickname)
    } else {
      await userStore.login(form.username, form.password)
    }
  } finally {
    loading.value = false
  }
}
</script>

<style scoped lang="scss">
.login-page {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.login-card {
  width: 420px;
  padding: 48px 40px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
}

.login-header {
  text-align: center;
  margin-bottom: 36px;

  h1 {
    margin: 12px 0 4px;
    font-size: 28px;
    color: #303133;
    font-weight: 700;
  }

  p {
    color: #909399;
    font-size: 14px;
  }
}

.switch-mode {
  text-align: center;
  color: #909399;
  font-size: 14px;
}
</style>
