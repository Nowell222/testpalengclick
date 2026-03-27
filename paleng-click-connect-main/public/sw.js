// PALENG-CLICK Service Worker — Push Notification Handler
// Place this file at: public/sw.js

const CACHE_NAME = 'paleng-click-v1';

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  console.log('[SW] Installed');
  self.skipWaiting();
});

// ── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  console.log('[SW] Activated');
  event.waitUntil(self.clients.claim());
});

// ── Push received ─────────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  console.log('[SW] Push received');

  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'PALENG-CLICK', body: event.data ? event.data.text() : 'New notification' };
  }

  const title   = data.title   || 'PALENG-CLICK';
  const options = {
    body:    data.body  || 'You have a new notification.',
    icon:    '/favicon.png',
    badge:   '/favicon.png',
    tag:     data.data?.type || 'paleng-click',
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200],
    data:    data.data || {},
    actions: [
      { action: 'view',    title: '📄 View Receipt' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ── Notification click ────────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const action       = event.action;
  const data         = notification.data || {};

  notification.close();

  if (action === 'dismiss') return;

  // Open the app at the notifications page
  const url = data.url || '/vendor/notifications';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // If app is already open, focus it
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.postMessage({ type: 'NOTIFICATION_CLICKED', data });
          return;
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});

// ── Push subscription change ──────────────────────────────────────────────────
self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('[SW] Push subscription changed');
  // Re-subscribe handled by the app
});
