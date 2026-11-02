/** Số liệu cho màn Báo cáo: xu hướng chi/thu theo kỳ và các điểm đáng chú ý. Hàm thuần, không dùng React. */
import { incomeIn, monthOf, shiftPeriod, spentByCategory, sum } from './calc';
import type { AppData, CategoryKind, ISODate, PeriodKey, Settings } from './types';

const SPEND_KINDS: CategoryKind[] = ['spend', 'fixed', 'installment'];

/** Ngưỡng cho điểm đáng chú ý. */
export const UP_PCT = 20;
export const DOWN_PCT = 30;
export const MIN_DIFF = 100_000;

export interface PeriodTotals {
  period: PeriodKey;
  spent: number;
  income: number;
  /** income − spent */
  saving: number;
}

/** n kỳ gần nhất, cũ → mới, kỳ cuối là kỳ đang chạy (chứa `today`). */
export function lastPeriods(today: ISODate, _settings: Settings, n: number): PeriodKey[] {
  const cur = monthOf(today);
  return Array.from({ length: n }, (_, i) => shiftPeriod(cur, i - n + 1));
}

/** Đã chi (phần mình chịu, gồm trả góp), đã thu và để dành được trong một kỳ. */
export function periodTotals(data: AppData, period: PeriodKey): PeriodTotals {
  const spent = sum([...spentByCategory(data, period).values()]);
  const income = incomeIn(data, period);
  return { period, spent, income, saving: income - spent };
}

export function trend(data: AppData, periods: PeriodKey[]): PeriodTotals[] {
  return periods.map((p) => periodTotals(data, p));
}

/** Tỉ lệ để dành (%), null nếu chưa có thu. */
export const savingRate = (t: PeriodTotals) => (t.income > 0 ? Math.round((t.saving / t.income) * 100) : null);

/** % thay đổi của `cur` so với `base` (làm tròn), null nếu base <= 0. */
export const pctChange = (cur: number, base: number) => (base > 0 ? Math.round(((cur - base) / base) * 100) : null);

/** Id các danh mục chi (spend / fixed / installment). */
export function spendCategoryIds(data: AppData): Set<string> {
  return new Set(data.categories.filter((c) => SPEND_KINDS.includes(c.kind)).map((c) => c.id));
}

/** Các kỳ trước `period` (tối đa `n` kỳ) có phát sinh chi — làm mốc so sánh, bỏ qua tháng chưa dùng app. */
export function basePeriods(data: AppData, period: PeriodKey, n = 3): PeriodKey[] {
  const out: PeriodKey[] = [];
  for (let i = 1; i <= n; i++) {
    const p = shiftPeriod(period, -i);
    if (periodTotals(data, p).spent > 0) out.push(p);
  }
  return out.reverse();
}

export interface CategoryTrend {
  categoryId: string;
  points: { period: PeriodKey; value: number }[];
  /** Trung bình mỗi kỳ, tính trên các kỳ có phát sinh chi (bỏ kỳ cuối nếu đang chạy dở). */
  avg: number;
}

export function categoryTrend(data: AppData, categoryId: string, periods: PeriodKey[], lastIsPartial = true): CategoryTrend {
  const points = periods.map((period) => ({ period, value: spentByCategory(data, period).get(categoryId) ?? 0 }));
  const full = lastIsPartial && periods.length > 1 ? points.slice(0, -1) : points;
  const active = full.filter((pt) => periodTotals(data, pt.period).spent > 0);
  const avg = active.length ? sum(active.map((pt) => pt.value)) / active.length : 0;
  return { categoryId, points, avg };
}

/** Danh mục chi có tổng lớn nhất qua các kỳ (lớn → nhỏ), bỏ danh mục bằng 0. */
export function topCategories(data: AppData, periods: PeriodKey[], n = 6): { categoryId: string; total: number }[] {
  const ids = spendCategoryIds(data);
  const totals = new Map<string, number>();
  for (const p of periods) {
    for (const [id, v] of spentByCategory(data, p)) if (ids.has(id)) totals.set(id, (totals.get(id) ?? 0) + v);
  }
  return [...totals.entries()]
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([categoryId, total]) => ({ categoryId, total }));
}

export type Insight =
  /** Danh mục chi nhiều hơn hẳn trung bình các kỳ trước. */
  | { kind: 'up'; categoryId: string; value: number; avg: number; pct: number; months: number }
  /** Danh mục chi ít hơn hẳn (không xét khi kỳ đang chạy dở). */
  | { kind: 'down'; categoryId: string; value: number; avg: number; pct: number; months: number }
  /** Danh mục chi nhiều nhất kỳ; pct = phần trăm trên tổng chi. */
  | { kind: 'top'; categoryId: string; value: number; pct: number }
  /** Chi trung bình mỗi tháng của `months` kỳ trước. */
  | { kind: 'avg'; value: number; months: number };

/**
 * Tối đa 4 điểm đáng chú ý của một kỳ: tối đa 2 danh mục tăng mạnh, 1 danh mục giảm mạnh,
 * danh mục lớn nhất, chi trung bình các kỳ trước.
 */
export function insights(data: AppData, period: PeriodKey, opts: { partial?: boolean } = {}): Insight[] {
  const ids = spendCategoryIds(data);
  const cur = spentByCategory(data, period);
  const base = basePeriods(data, period, 3);
  const baseMaps = base.map((p) => spentByCategory(data, p));
  const avgOf = (id: string) => (base.length ? sum(baseMaps.map((m) => m.get(id) ?? 0)) / base.length : 0);

  type Change = Extract<Insight, { kind: 'up' | 'down' }>;
  const ups: Change[] = [];
  const downs: Change[] = [];
  if (base.length) {
    const all = new Set([...cur.keys(), ...baseMaps.flatMap((m) => [...m.keys()])]);
    for (const id of all) {
      if (!ids.has(id)) continue;
      const value = cur.get(id) ?? 0;
      const avg = avgOf(id);
      const pct = pctChange(value, avg);
      if (pct == null) continue;
      if (pct >= UP_PCT && value - avg >= MIN_DIFF) ups.push({ kind: 'up', categoryId: id, value, avg, pct, months: base.length });
      else if (!opts.partial && pct <= -DOWN_PCT && avg - value >= MIN_DIFF) downs.push({ kind: 'down', categoryId: id, value, avg, pct, months: base.length });
    }
  }
  const byDiff = (a: Change, b: Change) => Math.abs(b.value - b.avg) - Math.abs(a.value - a.avg);
  ups.sort(byDiff);
  downs.sort(byDiff);

  const out: Insight[] = [...ups.slice(0, 2), ...downs.slice(0, 1)];

  const spent = [...cur.entries()].filter(([id, v]) => ids.has(id) && v > 0).sort((a, b) => b[1] - a[1]);
  const total = sum([...cur.values()]);
  if (spent.length && total > 0) {
    const [categoryId, value] = spent[0];
    out.push({ kind: 'top', categoryId, value, pct: Math.round((value / total) * 100) });
  }
  if (base.length) {
    out.push({ kind: 'avg', value: Math.round(sum(base.map((p) => periodTotals(data, p).spent)) / base.length), months: base.length });
  }
  return out.slice(0, 4);
}
