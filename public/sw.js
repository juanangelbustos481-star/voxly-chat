const CACHE_NAME = 'voxly-app-v1'
const APP_SHELL = '/'

// Instalar y guardar la página principal
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.add(APP_SHELL)
    })
  )

  self.skipWaiting()
})

// Activar la nueva versión y limpiar cachés antiguas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('voxly-app-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  )

  self.clients.claim()
})

// Gestionar solicitudes de la aplicación
self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)

  // Solo solicitudes GET del mismo origen
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return
  }

  // No guardar ni interceptar servicios externos o API
  if (
    url.pathname.startsWith('/rest/') ||
    url.pathname.startsWith('/auth/') ||
    url.pathname.startsWith('/functions/')
  ) {
    return
  }

  // Para la navegación, intentar internet y usar la página guardada
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put('/', copy))
          }
          return response
        })
        .catch(async () => {
          return (await caches.match('/')) || Response.error()
        })
    )
    return
  }

  // Guardar recursos estáticos de Voxly
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then(async (cached) => {
        if (cached) return cached

        const response = await fetch(request)

        if (response.ok) {
          const copy = response.clone()
          const cache = await caches.open(CACHE_NAME)
          await cache.put(request, copy)
        }

        return response
      })
    )
  }
})
self.addEventListener('push', event => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { title: 'Voxly', body: 'Tienes un mensaje nuevo.' }
  }
  const title = payload.title || 'Voxly'
  const options = {
    body: payload.body || 'Tienes un mensaje nuevo.',
    icon: '/voxly-icon.svg',
    badge: '/voxly-icon.svg',
    tag: payload.tag || 'voxly-message',
    renotify: true,
    data: { url: payload.url || '/' }
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of windows) {
      if ('focus' in client) {
        await client.focus()
        if ('navigate' in client) await client.navigate(target)
        return
      }
    }
    await self.clients.openWindow(target)
  })())
})
