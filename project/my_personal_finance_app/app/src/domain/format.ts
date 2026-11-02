import type { ISODate, PeriodKey } from './types';
import { L } from '../labels';
import { t } from '../i18n';

const nf = new Intl.NumberFormat('vi-VN');

/** Đang bật "Ẩn số tiền": mọi số tiền hiển thị thành •••••đ (ô nhập tiền vẫn hiện số thật). */
let masked = false;
export const setMoneyMask = (on: boolean) => {
  masked = on;
};
export const money = (n: number) => (masked ? `${L.privacy.mask}đ` : `${nf.format(Math.round(n))}đ`);
export const plain = (n: number) => nf.format(Math.round(n));

/** Đọc số người dùng gõ: bỏ mọi ký tự không phải số / dấu trừ. */
export function parseMoney(s: string): number {
  const neg = s.trim().startsWith('-');
  const digits = s.replace(/[^\d]/g, '');
  const n = digits ? Number(digits) : 0;
  return neg ? -n : n;
}

export const dm = (d: ISODate) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
export const dmy = (d: ISODate) => `${dm(d)}/${d.slice(0, 4)}`;

/** "Tháng 11" — thêm năm nếu khác năm hiện tại. */
export function periodLabel(p: PeriodKey) {
  const m = Number(p.slice(5, 7));
  const y = p.slice(0, 4);
  return y === String(new Date().getFullYear()) ? t(L.budget.dates.month, { m }) : t(L.budget.dates.monthYear, { m, y });
}

export function dayLabel(d: ISODate, today: ISODate) {
  const D = L.budget.dates;
  const weekdays = [D.sun, D.mon, D.tue, D.wed, D.thu, D.fri, D.sat];
  if (d === today) return D.today;
  const diff = Math.round((Date.parse(today) - Date.parse(d)) / 86_400_000);
  if (diff === 1) return D.yesterday;
  return t(D.weekdayDate, { wd: weekdays[new Date(d).getDay()], date: dm(d) });
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
