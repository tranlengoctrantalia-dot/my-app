/** Mục tiêu tiết kiệm: đã để dành bao nhiêu, còn thiếu bao nhiêu, mỗi tháng cần bỏ thêm bao nhiêu. */
import { sum } from './calc';
import type { Goal, ISODate } from './types';

export const goalSaved = (g: Goal) => Math.max(0, sum(g.deposits.map((d) => d.amount)));

/** Số tháng còn lại tới hạn (tính cả tháng này), ít nhất 1. undefined nếu không đặt hạn. */
export function monthsLeft(g: Goal, today: ISODate): number | undefined {
  if (!g.deadline) return undefined;
  const [y1, m1] = today.split('-').map(Number);
  const [y2, m2] = g.deadline.split('-').map(Number);
  return Math.max(1, (y2 - y1) * 12 + (m2 - m1) + (g.deadline.slice(8) >= today.slice(8) ? 1 : 0));
}

export function goalStatus(g: Goal, today: ISODate) {
  const saved = goalSaved(g);
  const left = Math.max(0, g.target - saved);
  const months = monthsLeft(g, today);
  return {
    saved,
    left,
    pct: g.target > 0 ? Math.min(1, saved / g.target) : 0,
    done: left === 0 && g.target > 0,
    /** Mỗi tháng cần để dành bao nhiêu để kịp hạn. */
    monthly: months && left ? Math.ceil(left / months / 1000) * 1000 : 0,
    months,
    late: !!g.deadline && g.deadline < today && left > 0,
  };
}
