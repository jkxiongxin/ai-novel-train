/**
 * Service Worker for PWA
 * 提供离线缓存和更快的加载速度
 */

const CACHE_NAME = 'novel-trainer-v1'
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
]

// 安装事件 - 缓存静态资源
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...')
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static assets')
        return cache.addAll(STATIC_ASSETS)
      })
      .then(() => {
        console.log('[SW] Install complete')
        return self.skipWaiting()
      })
  )
})

// 激活事件 - 清理旧缓存
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...')
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => {
              console.log('[SW] Deleting old cache:', name)
              return caches.delete(name)
            })
        )
      })
      .then(() => {
        console.log('[SW] Activate complete')
        return self.clients.claim()
      })
  )
})

// 请求拦截 - 网络优先策略（适合动态内容）
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // 跳过非同源请求
  if (url.origin !== location.origin) {
    return
  }

  // API 请求使用网络优先
  if (url.pathname.startsWith('/api')) {
    event.respondWith(
      fetch(request)
        .catch(() => {
          // 网络失败时返回离线提示
          return new Response(
            JSON.stringify({ error: '网络连接失败，请检查网络后重试' }),
            {
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            }
          )
        })
    )
    return
  }

  // 静态资源使用缓存优先
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          // 后台更新缓存
          fetch(request)
            .then((response) => {
              if (response && response.status === 200) {
                caches.open(CACHE_NAME)
                  .then((cache) => cache.put(request, response))
              }
            })
            .catch(() => {})
          
          return cachedResponse
        }

        // 没有缓存则请求网络
        return fetch(request)
          .then((response) => {
            // 缓存成功的响应
            if (response && response.status === 200) {
              const responseClone = response.clone()
              caches.open(CACHE_NAME)
                .then((cache) => cache.put(request, responseClone))
            }
            return response
          })
      })
  )
})

// 接收推送通知
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {}
  const title = data.title || '小说写作训练'
  const options = {
    body: data.body || '有新的消息',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/'
    }
  }

  event.waitUntil(
    self.registration.showNotification(title, options)
  )
})

// 点击通知
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  
  event.waitUntil(
    clients.matchAll({ type: 'window' })
      .then((clientList) => {
        const url = event.notification.data?.url || '/'
        
        // 如果已有窗口打开，聚焦它
        for (const client of clientList) {
          if (client.url === url && 'focus' in client) {
            return client.focus()
          }
        }
        
        // 否则打开新窗口
        if (clients.openWindow) {
          return clients.openWindow(url)
        }
      })
  )
})
