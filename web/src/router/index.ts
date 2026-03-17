import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: () => import('@/views/Login.vue'),
      meta: { requiresAuth: false },
    },
    {
      // 分享公开页面（不需要登录）
      path: '/share/:code',
      name: 'ShareView',
      component: () => import('@/views/ShareView.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/',
      name: 'Layout',
      component: () => import('@/views/Layout.vue'),
      meta: { requiresAuth: true },
      redirect: '/files',
      children: [
        {
          path: 'files',
          name: 'Files',
          component: () => import('@/views/Files.vue'),
        },
        {
          path: 'category/:type',
          name: 'Category',
          component: () => import('@/views/Category.vue'),
        },
        {
          path: 'trash',
          name: 'Trash',
          component: () => import('@/views/Trash.vue'),
        },
        {
          path: 'shares',
          name: 'MyShares',
          component: () => import('@/views/MyShares.vue'),
        },
        {
          path: 'admin',
          name: 'Admin',
          component: () => import('@/views/Admin.vue'),
          meta: { requiresAdmin: true },
        },
      ],
    },
  ],
})

// 路由守卫
router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem('token')

  if (to.meta.requiresAuth !== false && !token) {
    next('/login')
  } else if (to.path === '/login' && token) {
    next('/')
  } else {
    next()
  }
})

export default router
