// Nowen File Service Worker — 离线缓存策略
const CACHE_NAME = 'nowen-file-v1'
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
]

// 安装：缓存静态资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS)
    })
  )
  self.skipWaiting()
})

// 激活：清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    })
  )
  self.clients.claim()
})

// 请求拦截：Network First 策略（API请求走网络，静态资源走缓存）
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // API 请求：仅走网络
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/dav/')) {
    return
  }

  // 静态资源：Network First with Cache Fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // 缓存成功的 GET 请求
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        }
        return response
      })
      .catch(() => {
        // 网络失败时使用缓存
        return caches.match(event.request).then((cached) => {
          return cached || new Response('离线不可用', { status: 503 })
        })
      })
  )
})
