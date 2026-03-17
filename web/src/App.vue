<template>
  <router-view />
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()

onMounted(() => {
  // 如果有 token，自动获取用户信息
  if (userStore.token) {
    userStore.fetchProfile()
  }
})
</script>

<style>
body {
  margin: 0;
  padding: 0;
}
</style>
