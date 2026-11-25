/**
 * Nhắc nhở: nhắc ghi chi tiêu mỗi tối, nhắc hạn trả thẻ, báo sắp lố ngân sách.
 * App web không có máy chủ nên: mở app là kiểm tra ngay; lúc app đóng thì nhờ service worker
 * (Periodic Background Sync — chỉ Android / Chrome đã cài app) đọc bản tóm tắt lưu trong Cache Storage.
 */
import { buildPlan } from './domain/advice';
import { personName } from './domain/split';
import { cardSettings, monthOf, statementPaid, budgetReport, nextDuePeriod, periodInfo, statement, todayISO } from './domain/calc';
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

  // Mỗi thẻ nhắc theo hạn trả riêng của thẻ đó.
  for (const card of r.cardDays !== undefined ? data.accounts.filter((a) => a.kind === 'credit') : []) {
    const cs = cardSettings(data, card.id);
    const p = nextDuePeriod(today, cs);
    const due = periodInfo(p, cs).due;
    const left = daysBetween(today, due);
    // Trừ phần đã chuyển trả: trả đủ rồi thì thôi nhắc.
    const total = Math.max(0, statement(data, p, card.id).total - statementPaid(data, p, card.id));
    if (total > 0 && left >= 0 && left <= r.cardDays! && done[`card:${card.id}:${p}`] !== today)
      out.push({
        key: `card:${card.id}:${p}`,
        title: `${R.cardTitle} · ${card.name}`,
        body: left === 0 ? t(R.cardToday, { amount: money(total) }) : t(R.cardBody, { n: left, date: dm(due), amount: money(total) }),
        tag: `card:${card.id}`,
      });
  }

  // Nhắc đòi tiền người khác nợ trước ngày cần nhận (hạn thẻ đã quẹt khoản đó / ngày hẹn), cùng mốc với nhắc trả thẻ.
  if (r.cardDays !== undefined) {
    const plan = buildPlan(data, today);
    const per = new Map<string, { amount: number; date: string; late: boolean }>();
    for (const i of plan.incoming) {
      const cur = per.get(i.person);
      per.set(i.person, cur ? { ...cur, amount: cur.amount + i.amount, date: i.date < cur.date ? i.date : cur.date } : { amount: i.amount, date: i.date, late: i.late });
    }
    for (const [id, v] of per) {
      const left = daysBetween(today, v.date);
      const key = `owed:${id}:${v.date}${v.late ? ':late' : ''}`;
      if (done[key] || (!v.late && (left < 0 || left > r.cardDays))) continue;
      const vars = { name: personName(data.settings, id), amount: money(v.amount), date: dm(v.date), n: left };
      out.push({ key, title: v.late ? R.owedLateTitle : R.owedTitle, body: t(v.late ? R.owedLateBody : R.owedBody, vars), tag: `owed:${id}` });
    }
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
  // Thẻ đến hạn sớm nhất còn phải trả.
  const next = data.accounts
    .filter((a) => a.kind === 'credit')
    .map((a) => {
      const cs = cardSettings(data, a.id);
      const p = nextDuePeriod(today, cs);
      return { due: periodInfo(p, cs).due, left: Math.max(0, statement(data, p, a.id).total - statementPaid(data, p, a.id)) };
    })
    .filter((x) => x.left > 0)
    .sort((a, b) => a.due.localeCompare(b.due))[0];
  const cardLeft = next?.left ?? 0;
  const state = {
    dailyHour: r.dailyHour ?? null,
    lastLogged: loggedToday(data, today) ? today : null,
    daily: { title: R.dailyTitle, body: R.dailyBody },
    card:
      next && r.cardDays !== undefined
        ? { due: next.due, days: r.cardDays, title: R.cardTitle, body: t(R.cardToday, { amount: money(cardLeft) }) }
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
