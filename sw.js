self.addEventListener('push', e => {
  const d = e.data ? e.data.json() : {};
  e.waitUntil(self.registration.showNotification(d.title || 'تنبيه',
    { body: d.body || '', dir: 'rtl', lang: 'ar', icon: 'apple-touch-icon.png' }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window' })
    .then(l => l.length ? l[0].focus() : clients.openWindow('/')));
});
