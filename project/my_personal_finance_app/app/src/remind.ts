/**
 * Nhắc nhở: nhắc ghi chi tiêu mỗi tối, nhắc hạn trả thẻ, báo sắp lố ngân sách.
 * App web không có máy chủ nên: mở app là kiểm tra ngay; lúc app đóng thì nhờ service worker
 * (Periodic Background Sync — chỉ Android / Chrome đã cài app) đọc bản tóm tắt lưu trong Cache Storage.
 */
import { monthOf, budgetReport, nextDuePeriod, periodInfo, statement, todayISO } from './domain/calc';
import { dm, money } from './domain/format';
import type { AppData } from './domain/types';
import { L } from './labels';
import { t } from './i18n';

const R = L.remind;
const SENT_KEY = 'vi-cua-nang/notified';
export const CACHE = 'vg-remind';
export const STATE_URL = '/__vg-remind.json';

export type Perm = 'unsupported' | NotificationPermission;

export function permission(): Perm {
  return typeof Notification === 'undefined' || !('serviceWorker' in navigator) ? 'unsupported' : Notification.permission;
}

export async function askPermission(): Promise<Perm> {
  if (permission() === 'unsupported') return 'unsupported';
  const p = await Notification.requestPermission();
  if (p === 'granted') void registerBackground();
  return p;
}

export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
export const isStandalone = () => matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

export async function notify(title: string, body: string, tag: string) {
  if (permission() !== 'granted') return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(title, { body, tag, icon: '/icon.svg', badge: '/icon.svg', data: { url: tag === 'daily' ? '/?add=1' : '/' } });
    return true;
  } catch {
    try {
      new Notification(title, { body, tag, icon: '/icon.svg' });
      return true;
    } catch {
      return false;
    }
  }
}

/* ---------- Đã nhắc gì rồi (để không nhắc lặp) ---------- */

function sent(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(SENT_KEY) ?? '{}');
  } catch {
    return {};
  }
}
function markSent(key: string, today: string) {
  const all = sent();
  // Chỉ giữ dấu của 40 ngày gần đây.
  for (const [k, d] of Object.entries(all)) if (d < shiftDays(today, -40)) delete all[k];
  all[key] = today;
  try {
    localStorage.setItem(SENT_KEY, JSON.stringify(all));
  } catch {
    /* bỏ qua */
  }
}

const shiftDays = (d: string, n: number) => todayISO(new Date(Date.parse(d + 'T12:00:00') + n * 86_400_000));
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

export const loggedToday = (data: AppData, today = todayISO()) => data.transactions.some((x) => x.date === today && x.source?.startsWith('recurring:') !== true);

/** Có nên hiện lời nhắc "hôm nay chưa ghi" không (dùng cho banner trong app). */
export function dailyDue(data: AppData, now = new Date()) {
  const h = data.settings.reminders?.dailyHour;
  return h !== undefined && now.getHours() >= h && !loggedToday(data, todayISO(now));
}

/** Những lời nhắc cần gửi lúc này. */
export function pending(data: AppData, now = new Date()) {
  const r = data.settings.reminders ?? {};
  const today = todayISO(now);
  const done = sent();
  const out: { key: string; title: string; body: string; tag: string }[] = [];

  if (dailyDue(data, now) && done.daily !== today) out.push({ key: 'daily', title: R.dailyTitle, body: R.dailyBody, tag: 'daily' });

  if (r.cardDays !== undefined && data.accounts.some((a) => a.kind === 'credit')) {
    const p = nextDuePeriod(today, data.settings);
    const due = periodInfo(p, data.settings).due;
    const left = daysBetween(today, due);
    const total = statement(data, p).total;
    if (total > 0 && left >= 0 && left <= r.cardDays && done[`card:${p}`] !== today)
      out.push({
        key: `card:${p}`,
        title: R.cardTitle,
        body: left === 0 ? t(R.cardToday, { amount: money(total) }) : t(R.cardBody, { n: left, date: dm(due), amount: money(total) }),
        tag: 'card',
      });
  }

  if (r.budgetPct !== undefined) {
    const period = monthOf(today);
    for (const row of budgetReport(data, period).rows) {
      if (row.limit <= 0) continue;
      const pct = (row.spent / row.limit) * 100;
      const over = row.spent > row.limit;
      const key = `budget:${period}:${row.categoryId}:${over ? 'over' : 'warn'}`;
      if (pct < r.budgetPct || done[key]) continue;
      const name = data.categories.find((c) => c.id === row.categoryId)?.name ?? '';
      out.push({
        key,
        title: over ? R.budgetOverTitle : R.budgetTitle,
        body: over
          ? t(R.budgetOverBody, { name, amount: money(row.spent - row.limit) })
          : t(R.budgetBody, { name, pct: Math.round(pct), spent: money(row.spent), limit: money(row.limit) }),
        tag: key,
      });
    }
  }
  return out;
}

/** Gửi các lời nhắc tới hạn (gọi khi mở app, sau khi ghi khoản…). */
export async function runReminders(data: AppData, now = new Date()) {
  const today = todayISO(now);
  for (const n of pending(data, now)) if (await notify(n.title, n.body, n.tag)) markSent(n.key, today);
}

/* ---------- Cho service worker lúc app đóng ---------- */

/** Ghi bản tóm tắt cho service worker: giờ nhắc, hôm nay đã ghi chưa, hạn thẻ. Không chứa chi tiết giao dịch. */
export async function saveBackgroundState(data: AppData) {
  if (!('caches' in window)) return;
  const r = data.settings.reminders ?? {};
  const today = todayISO();
  const hasCard = data.accounts.some((a) => a.kind === 'credit');
  const p = hasCard ? nextDuePeriod(today, data.settings) : undefined;
  const state = {
    dailyHour: r.dailyHour ?? null,
    lastLogged: loggedToday(data, today) ? today : null,
    daily: { title: R.dailyTitle, body: R.dailyBody },
    card:
      p && r.cardDays !== undefined && statement(data, p).total > 0
        ? { due: periodInfo(p, data.settings).due, days: r.cardDays, title: R.cardTitle, body: t(R.cardToday, { amount: money(statement(data, p).total) }) }
        : null,
  };
  try {
    const c = await caches.open(CACHE);
    await c.put(STATE_URL, new Response(JSON.stringify(state), { headers: { 'content-type': 'application/json' } }));
  } catch {
    /* bỏ qua */
  }
}

/** Xin chạy ngầm định kỳ (Chrome Android, app đã cài). Máy không hỗ trợ thì thôi. */
export async function registerBackground() {
  try {
    const reg = (await navigator.serviceWorker.ready) as ServiceWorkerRegistration & {
      periodicSync?: { register: (tag: string, o: { minInterval: number }) => Promise<void> };
    };
    if (!reg.periodicSync) return false;
    const st = await navigator.permissions.query({ name: 'periodic-background-sync' as PermissionName });
    if (st.state !== 'granted') return false;
    await reg.periodicSync.register('vg-remind', { minInterval: 60 * 60 * 1000 });
    return true;
  } catch {
    return false;
  }
}

export const activeCount = (data: AppData) => Object.values(data.settings.reminders ?? {}).filter((v) => v !== undefined).length;
