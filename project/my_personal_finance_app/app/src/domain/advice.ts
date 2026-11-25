/**
 * Khả năng thanh toán tháng này, viết cho người không làm tài chính:
 *   Tiền có (ví + lương + người khác trả lại) − Tiền phải trả (khoản cố định + thẻ + ăn tiêu) = Dư / Thiếu.
 * Ăn tiêu do người dùng tự kéo (mỗi ngày bao nhiêu). Thiếu thì gợi ý chưa bỏ tiết kiệm tháng này;
 * không bao giờ tự rút tiết kiệm cũ.
 */
import { budgetReport, cardSettings, cashCheck, monthOf, monthRange, periodInfo, periodOf, shiftPeriod, statement, statementPaid, sum, todayISO, live } from './calc';
import { fold } from '../ai/redact';
import { splitsOf } from './split';
import type { AppData, ISODate, PeriodKey } from './types';

/** Khoản cố định kiểu để dành (hoãn được 1 tháng mà không trễ nợ ai). */
const SAVING = /tiet kiem|tich luy|dau tu|saving|invest/;

export interface CardDue {
  id: string;
  name: string;
  period: PeriodKey;
  due: ISODate;
  amount: number;
}

export interface Incoming {
  person: string;
  amount: number;
  /** Ngày cần nhận: ngày hẹn (nếu có) hoặc hạn của thẻ đã quẹt khoản đó / cuối tháng. */
  date: ISODate;
  promised: boolean;
  /** Đã qua ngày hẹn mà chưa trả: không tính là sẽ có. */
  late: boolean;
}

export interface Plan {
  today: ISODate;
  month: PeriodKey;
  monthEnd: ISODate;
  /** Số ngày từ hôm nay tới cuối tháng (tính cả hôm nay). */
  days: number;
  cash: number;
  salary?: { date: ISODate; amount: number };
  /** Chi linh hoạt mỗi ngày theo Ngân sách (phần còn lại của tháng ÷ số ngày còn lại). */
  flexPerDay: number;
  /** Ăn tiêu đã lố ngân sách tháng này. */
  flexOver: number;
  /** Khoản cố định chưa chi tháng này. */
  fixed: { categoryId: string; amount: number; saving: boolean }[];
  cards: CardDue[];
  incoming: Incoming[];
}

const daysBetween = (from: ISODate, to: ISODate) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;

/** Kỳ của thẻ có hạn trả rơi vào tháng `month`. */
export function periodDueIn(data: AppData, cardId: string, month: PeriodKey): PeriodKey | undefined {
  const cs = cardSettings(data, cardId);
  const { start, end } = monthRange(month);
  return [shiftPeriod(month, -1), month, shiftPeriod(month, 1)].find((p) => {
    const d = periodInfo(p, cs).due;
    return d >= start && d <= end;
  });
}

export function buildPlan(data: AppData, today = todayISO()): Plan {
  const month = monthOf(today);
  const monthEnd = monthRange(month).end;
  const c = cashCheck(data, month, today);
  const salaryDate = periodInfo(month, data.settings).salary;
  const report = budgetReport(data, month);
  const income = salaryDate > today ? Math.max(0, report.income - sum(live(data).filter((t) => t.kind === 'income' && monthOf(t.date) === month).map((t) => t.amount))) : 0;
  const cards: CardDue[] = [];
  for (const a of data.accounts.filter((x) => x.kind === 'credit')) {
    const p = periodDueIn(data, a.id, month);
    if (!p) continue;
    const amount = Math.max(0, statement(data, p, a.id).total - statementPaid(data, p, a.id));
    const due = periodInfo(p, cardSettings(data, a.id)).due;
    // Quá hạn mà chưa trả: coi như phải trả ngay hôm nay.
    if (amount > 0) cards.push({ id: a.id, name: a.name, period: p, due: due < today ? today : due, amount });
  }
  cards.sort((a, b) => a.due.localeCompare(b.due));
  const promises = data.settings.promises ?? {};
  const credit = new Set(data.accounts.filter((a) => a.kind === 'credit').map((a) => a.id));
  const incoming: Incoming[] = [];
  for (const t of live(data)) {
    if (t.kind === 'borrow') continue;
    for (const s of splitsOf(t)) {
      const amount = s.amount - s.paid;
      if (amount <= 0) continue;
      const promise = promises[s.person];
      // Chưa hẹn: khoản quẹt thẻ thì cần nhận trước hạn thẻ đó, khoản trả bằng ví thì cuối tháng.
      let date = credit.has(t.accountId) ? periodInfo(periodOf(t.date, cardSettings(data, t.accountId).cutoffDay), cardSettings(data, t.accountId)).due : monthEnd;
      if (date < today) date = today;
      incoming.push({ person: s.person, amount, date: promise ?? date, promised: !!promise, late: !!promise && promise < today });
    }
  }
  const fixedIds = new Set(data.categories.filter((x) => x.kind === 'fixed').map((x) => x.id));
  const fixed = report.rows
    .filter((r) => fixedIds.has(r.categoryId) && r.remaining > 0)
    .map((r) => ({ categoryId: r.categoryId, amount: r.remaining, saving: SAVING.test(fold(data.categories.find((x) => x.id === r.categoryId)?.name ?? '')) }));
  return {
    today,
    month,
    monthEnd,
    days: daysBetween(today, monthEnd),
    flexPerDay: Math.floor(c.daily / daysBetween(today, monthEnd) / 1000) * 1000,
    flexOver: c.flexOver,
    cash: c.cashOnHand,
    salary: income > 0 ? { date: salaryDate, amount: income } : undefined,
    fixed,
    cards,
    incoming,
  };
}

export interface Result {
  /** Tiền có: ví + lương + người khác trả lại (trừ khoản trễ hẹn). */
  have: number;
  /** Tiền phải trả: khoản cố định + thẻ + ăn tiêu. */
  pay: number;
  /** Ăn tiêu từ hôm nay tới cuối tháng = mỗi ngày × số ngày. */
  spend: number;
  /** Dư (+) / Thiếu (−). */
  left: number;
  /** Tiết kiệm tháng này chưa bỏ (hoãn được). */
  savings: number;
  /** Dư / thiếu nếu tháng này chưa bỏ tiết kiệm. */
  leftNoSaving: number;
  /** Ăn tiêu tối đa mỗi ngày để vẫn đủ (giữ tiết kiệm / khi chưa bỏ tiết kiệm). 0 = không tiêu gì vẫn thiếu. */
  maxPerDay: number;
  maxPerDayNoSaving: number;
  /**
   * Đủ tới cuối tháng nhưng đúng ngày trả thẻ cuối cùng bị hụt vì tiền người khác trả lại tới sau ngày đó
   * (tính theo cách chưa bỏ tiết kiệm).
   */
  dip?: { date: ISODate; amount: number; card: string };
}

/** Tính Dư / Thiếu khi từ hôm nay ăn tiêu `perDay` mỗi ngày. */
export function check(plan: Plan, perDay: number): Result {
  // Chỉ tính tiền nhận lại trong tháng này: khoản để trả hóa đơn thẻ tháng sau thì tính tháng sau (thẻ đó cũng chưa phải trả).
  const counted = plan.incoming.filter((i) => !i.late && i.date <= plan.monthEnd);
  const have = plan.cash + (plan.salary?.amount ?? 0) + sum(counted.map((i) => i.amount));
  const fixed = sum(plan.fixed.map((f) => f.amount));
  const cards = sum(plan.cards.map((c) => c.amount));
  const spend = Math.round(perDay * plan.days);
  const pay = fixed + cards + spend;
  const left = have - pay;
  const savings = sum(plan.fixed.filter((f) => f.saving).map((f) => f.amount));
  const perDayOf = (room: number) => (room > 0 ? Math.floor(room / plan.days / 1000) * 1000 : 0);
  const maxPerDay = perDayOf(have - fixed - cards);
  const maxPerDayNoSaving = perDayOf(have - fixed - cards + savings);
  let dip: Result['dip'];
  const last = plan.cards[plan.cards.length - 1];
  if (last) {
    const d = last.due;
    const atDue =
      plan.cash +
      (plan.salary && plan.salary.date <= d ? plan.salary.amount : 0) +
      sum(counted.filter((i) => i.date <= d).map((i) => i.amount)) -
      (fixed - savings) -
      cards -
      perDay * daysBetween(plan.today, d);
    if (atDue < 0 && counted.some((i) => i.date > d)) dip = { date: d, amount: Math.round(-atDue), card: last.name };
  }
  return { have, pay, spend, left, savings, leftNoSaving: left + savings, maxPerDay, maxPerDayNoSaving, dip };
}
