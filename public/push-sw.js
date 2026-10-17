/* Web Push in de service worker (ingeladen via workbox importScripts in vite.config.js). */
/* eslint-disable no-restricted-globals */

self.addEventListener('push', event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'KSA LeidingsApp', body: event.data ? event.data.text() : '' };
  }

  event.waitUntil(
    ruimVervallenOp().then(() =>
      self.registration.showNotification(data.title || 'KSA LeidingsApp', {
        body: data.body || '',
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: data.tag,
        // verloopt_op: bv. "je kan friet bestellen" verdwijnt na het besteluur (zie ruimVervallenOp)
        data: { url: data.url || '/notificaties', verloopt_op: data.verloopt_op || null },
      })
    )
  );
});

// Meldingen waarvan het moment voorbij is (bv. het besteluur van friet) weghalen. Gebeurt bij elke nieuwe push
// en wanneer de app opent (bericht 'ruim-meldingen-op' vanuit de app).
function ruimVervallenOp() {
  return self.registration.getNotifications().then(lijst => {
    const nu = Date.now();
    for (const n of lijst) {
      const tot = n.data && n.data.verloopt_op ? Date.parse(n.data.verloopt_op) : null;
      if (tot && tot <= nu) n.close();
    }
  });
}

self.addEventListener('message', event => {
  if (event.data === 'ruim-meldingen-op') event.waitUntil(ruimVervallenOp());
});

// Tikken op de melding: bestaand venster van de app focussen, of een nieuw openen
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(vensters => {
      for (const venster of vensters) {
        if (venster.url.startsWith(self.location.origin) && 'focus' in venster) {
          venster.navigate(url);
          return venster.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
