// Nowen File Service Worker — 增强版离线缓存策略
const CACHE_NAME = 'nowen-file-v2'
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
]

// 需要 Cache First 的静态资源类型
const CACHE_FIRST_EXTENSIONS = ['.js', '.css', '.woff', '.woff2', '.ttf', '.png', '.jpg', '.svg', '.ico']

// 安装：缓存核心静态资源
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

// 请求拦截：分策略处理
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // API / WebDAV 请求：仅走网络
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/dav/')) {
    return
  }

  // 带版本哈希的静态资源（如 index-abc123.js）：Cache First
  const isCacheFirst = CACHE_FIRST_EXTENSIONS.some((ext) => url.pathname.endsWith(ext))
  if (isCacheFirst && url.pathname.includes('/assets/')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
          }
          return response
        })
      })
    )
    return
  }

  // HTML 导航请求：Network First（确保始终获取最新）
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
          }
          return response
        })
        .catch(() => {
          return caches.match('/index.html').then((cached) => {
            return cached || new Response('离线不可用 / Offline', {
              status: 503,
              headers: { 'Content-Type': 'text/html; charset=utf-8' },
            })
          })
        })
    )
    return
  }

  // 其他静态资源：Stale While Revalidate
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request).then((response) => {
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        }
        return response
      }).catch(() => cached)

      return cached || fetchPromise
    })
  )
})
