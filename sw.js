const CACHE = 'roadmind-v2';
const STATIC = [
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/webfonts/fa-solid-900.woff2',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/webfonts/fa-regular-400.woff2',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/webfonts/fa-brands-400.woff2',
  'https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap',
];

// Installation — tout mettre en cache
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.allSettled(STATIC.map(url =>
        cache.add(url).catch(err => console.warn('Cache miss:', url, err))
      ))
    )
  );
  self.skipWaiting();
});

// Activation — supprimer anciens caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — Cache First pour assets statiques, Network First pour le reste
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = e.request.url;

  // Cache First : Font Awesome, fonts, images
  const isCachePriority =
    url.includes('font-awesome') ||
    url.includes('fonts.googleapis') ||
    url.includes('fonts.gstatic') ||
    url.includes('.woff') ||
    url.includes('.png') ||
    url.includes('Chart.js');

  if (isCachePriority) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return res;
        }).catch(() => cached);
      })
    );
    return;
  }

  // Network First avec fallback cache : HTML principal
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then(c => c || caches.match('/index.html')))
  );
});

// Notifications push
self.addEventListener('push', e => {
  const d = e.data ? e.data.json() : { title: 'RoadMind', body: 'Rappel !' };
  e.waitUntil(
    self.registration.showNotification(d.title, {
      body: d.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200, 100, 200],
      tag: 'roadmind',
      requireInteraction: true,
    })
  );
});

// Clic notification → ouvre l'app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then(list => {
      for (const c of list) {
        if (c.url.includes('index.html') && 'focus' in c) return c.focus();
      }
      if (clients.openWindow) return clients.openWindow('/index.html');
    })
  );
});
