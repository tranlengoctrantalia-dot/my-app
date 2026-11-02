/* Ví Gọn — nhắc nhở lúc app đang đóng (nạp vào service worker qua workbox importScripts). */
const CACHE = 'vg-remind';
const STATE_URL = '/__vg-remind.json';
const SENT_URL = '/__vg-remind-sent.json';

const pad = (n) => String(n).padStart(2, '0');
const isoDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

async function readJSON(cache, url) {
  const res = await cache.match(url);
  return res ? res.json() : null;
}

async function check() {
  const cache = await caches.open(CACHE);
  const state = await readJSON(cache, STATE_URL);
  if (!state) return;
  const sent = (await readJSON(cache, SENT_URL)) || {};
  const now = new Date();
  const today = isoDay(now);
  const jobs = [];

  if (state.dailyHour !== null && now.getHours() >= state.dailyHour && state.lastLogged !== today && sent.daily !== today) {
    jobs.push(['daily', state.daily.title, state.daily.body, '/?add=1']);
  }
  if (state.card) {
    const left = Math.round((Date.parse(state.card.due + 'T12:00:00') - Date.parse(today + 'T12:00:00')) / 86400000);
    if (left >= 0 && left <= state.card.days && sent.card !== today) jobs.push(['card', state.card.title, state.card.body, '/']);
  }
  for (const [tag, title, body, url] of jobs) {
    await self.registration.showNotification(title, { body, tag, icon: '/icon.svg', badge: '/icon.svg', data: { url } });
    sent[tag] = today;
  }
  if (jobs.length) await cache.put(SENT_URL, new Response(JSON.stringify(sent)));
}

self.addEventListener('periodicsync', (e) => {
  if (e.tag === 'vg-remind') e.waitUntil(check());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) {
          c.navigate(url).catch(() => {});
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
