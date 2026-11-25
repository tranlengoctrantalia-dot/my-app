/**
 * Cố vấn dựa trên Ngân sách (gốc duy nhất): lương − khoản cố định − trả góp = được chi linh hoạt.
 * Mọi số "được tiêu bao nhiêu" trong app đều đọc từ đây, không có công thức riêng.
 */
import { budgetReport, installmentActive, installmentMine, monthOf, shiftPeriod, sum } from './calc';
import { goalStatus } from './goals';
import type { AppData, Budget, Goal, ISODate, PeriodKey, Transaction } from './types';

/** Id mục tiêu "Tiền đệm khẩn cấp" (một Mục tiêu như các mục tiêu khác → tự vào dòng tiết kiệm của Ngân sách). */
export const BUFFER_GOAL = 'buffer';
/** Tiền đệm nên có = 1 tháng khoản cố định, gom trong 12 tháng. */
const BUFFER_MONTHS = 12;

/** Ngân sách tháng `month`; chưa đặt thì lấy tháng gần nhất trước đó (lương, cố định thường giống nhau). */
function budgetOf(data: AppData, month: PeriodKey): Budget | undefined {
  return data.budgets.filter((b) => b.period <= month).sort((a, b) => b.period.localeCompare(a.period))[0];
}

/**
 * Ngân sách tháng `month` có cân không: lương − cố định − trả góp = được chi linh hoạt,
 * so với tổng các mục chi linh hoạt đang đặt (ăn uống, mua sắm…).
 */
export function budgetRoom(data: AppData, month: PeriodKey) {
  const b = budgetOf(data, month);
  const kind = new Map(data.categories.map((c) => [c.id, c.kind]));
  const lines = b?.lines ?? [];
  const fixed = sum(lines.filter((l) => kind.get(l.categoryId) === 'fixed').map((l) => l.limit));
  const installments = sum(data.installments.filter((i) => installmentActive(i, month)).map((i) => installmentMine(i, month)));
  const flexPlanned = sum(lines.filter((l) => kind.get(l.categoryId) === 'spend').map((l) => l.limit));
  const income = b?.income ?? 0;
  const room = income - fixed - installments;
  return { month, copied: !!b && b.period !== month, income, fixed, installments, room, flexPlanned, over: flexPlanned - room };
}

/**
 * Ngân sách tháng `month` đặt lố (các mục ăn tiêu nhiều hơn phần còn lại sau cố định + trả góp):
 * giảm đều các mục ăn tiêu cho vừa (làm tròn xuống nghìn). Không lố / chưa đặt ngân sách tháng đó → undefined.
 */
export function fitBudget(data: AppData, month: PeriodKey): { budget: Budget; changes: { categoryId: string; from: number; to: number }[] } | undefined {
  const b = data.budgets.find((x) => x.period === month);
  if (!b) return undefined;
  const r = budgetRoom(data, month);
  if (r.over <= 0 || r.flexPlanned <= 0) return undefined;
  const kind = new Map(data.categories.map((c) => [c.id, c.kind]));
  const ratio = Math.max(0, r.room) / r.flexPlanned;
  const changes = b.lines
    .filter((l) => kind.get(l.categoryId) === 'spend' && l.limit > 0)
    .map((l) => ({ categoryId: l.categoryId, from: l.limit, to: Math.floor((l.limit * ratio) / 1000) * 1000 }));
  const to = new Map(changes.map((c) => [c.categoryId, c.to]));
  return { budget: { ...b, lines: b.lines.map((l) => (to.has(l.categoryId) ? { ...l, limit: to.get(l.categoryId)! } : l)) }, changes };
}

/** 3 tháng tới được chi linh hoạt bao nhiêu (trả góp hết hạn thì tháng đó được chi nhiều hơn). */
export const nextMonths = (data: AppData, month: PeriodKey) => [1, 2, 3].map((i) => budgetRoom(data, shiftPeriod(month, i)));

export const bufferGoal = (data: AppData): Goal | undefined => data.goals?.find((g) => g.id === BUFFER_GOAL);

/** Gợi ý tạo tiền đệm: mục tiêu = 1 tháng khoản cố định, hạn 12 tháng. */
export function bufferSuggest(data: AppData, month: PeriodKey, today: ISODate) {
  const target = budgetRoom(data, month).fixed;
  const d = new Date(Date.parse(today + 'T12:00:00'));
  d.setMonth(d.getMonth() + BUFFER_MONTHS);
  const deadline = d.toISOString().slice(0, 10);
  return { target, deadline, monthly: Math.ceil(target / BUFFER_MONTHS / 1000) * 1000 };
}

/** Tiền đệm đang có (số đã bỏ vào mục tiêu Tiền đệm). */
export const bufferHave = (data: AppData, today: ISODate) => {
  const g = bufferGoal(data);
  return g ? goalStatus(g, today).saved : 0;
};

/**
 * Một khoản chi sắp ghi ảnh hưởng ngân sách tháng đó thế nào: danh mục còn bao nhiêu, chi linh hoạt cả tháng còn bao nhiêu.
 * `before` = khoản cũ khi đang sửa (để không trừ 2 lần). undefined = tháng đó chưa đặt ngân sách.
 */
export function budgetImpact(data: AppData, categoryId: string, myShare: number, date: ISODate, before?: Transaction) {
  const month = monthOf(date);
  const r = budgetReport(data, month);
  if (!r.budget || myShare <= 0) return undefined;
  const kind = new Map(data.categories.map((c) => [c.id, c.kind]));
  const isSpend = kind.get(categoryId) === 'spend';
  // Khoản cũ (đang sửa) đã nằm trong số đã chi → cộng lại trước khi trừ số mới.
  const oldInMonth = before && !before.kind && monthOf(before.date) === month ? before : undefined;
  const row = r.rows.find((x) => x.categoryId === categoryId);
  const spendLeft = sum([...r.rows, ...r.unbudgeted].filter((x) => kind.get(x.categoryId) === 'spend').map((x) => x.remaining));
  return {
    month,
    /** Danh mục còn bao nhiêu sau khoản này (undefined = danh mục chưa đặt ngân sách). */
    catLeft: row ? row.remaining + (oldInMonth?.categoryId === categoryId ? oldInMonth.myShare : 0) - myShare : undefined,
    /** Chi linh hoạt cả tháng còn bao nhiêu sau khoản này (chỉ khi là khoản chi linh hoạt). */
    flexLeft: isSpend ? spendLeft + (oldInMonth && kind.get(oldInMonth.categoryId) === 'spend' ? oldInMonth.myShare : 0) - myShare : undefined,
  };
}
