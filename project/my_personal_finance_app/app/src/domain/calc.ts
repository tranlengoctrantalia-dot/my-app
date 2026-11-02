import { splitsOf } from './split';
import type { AppData, Budget, ISODate, Installment, PeriodKey, Recurring, Settings, Transaction } from './types';

const pad = (n: number) => String(n).padStart(2, '0');
const periodKey = (y: number, m: number): PeriodKey => `${y}-${pad(m)}`;

export function parsePeriod(p: PeriodKey): [number, number] {
  const [y, m] = p.split('-').map(Number);
  return [y, m];
}

export function shiftPeriod(p: PeriodKey, delta: number): PeriodKey {
  const [y, m] = parsePeriod(p);
  const idx = y * 12 + (m - 1) + delta;
  return periodKey(Math.floor(idx / 12), (idx % 12) + 1);
}

function clampDay(y: number, m: number, d: number): ISODate {
  const last = new Date(y, m, 0).getDate();
  return `${y}-${pad(m)}-${pad(Math.min(d, last))}`;
}

/** Tháng dương lịch (1 → 30/31) của một ngày: dùng cho chi tiêu, ngân sách, báo cáo. */
export const monthOf = (date: ISODate): PeriodKey => date.slice(0, 7);

/** Ngày đầu / cuối của tháng dương lịch. */
export function monthRange(period: PeriodKey): { start: ISODate; end: ISODate } {
  const [y, m] = parsePeriod(period);
  return { start: `${period}-01`, end: clampDay(y, m, 31) };
}

/** Kỳ sao kê thẻ (tháng đến hạn trả) mà một giao dịch thuộc về — chỉ dùng cho thẻ tín dụng. */
export function periodOf(date: ISODate, cutoffDay: number): PeriodKey {
  const [y, m, d] = date.split('-').map(Number);
  if (d <= cutoffDay) return periodKey(y, m);
  return m === 12 ? periodKey(y + 1, 1) : periodKey(y, m + 1);
}

export interface PeriodInfo {
  period: PeriodKey;
  /** Khoảng ngày giao dịch được tính vào kỳ. */
  start: ISODate;
  end: ISODate;
  /** Ngày đến hạn trả thẻ. */
  due: ISODate;
  /** Ngày nhận lương dùng để trả kỳ này. */
  salary: ISODate;
}

/** Hạn trả: cùng tháng chốt nếu ngày trả sau ngày chốt (chốt 8, trả 25), không thì sang tháng sau (chốt 20, trả 4). */
function dueDate(period: PeriodKey, s: Settings): ISODate {
  const [y, m] = parsePeriod(s.dueDay > s.cutoffDay ? period : shiftPeriod(period, 1));
  return clampDay(y, m, s.dueDay);
}

export function periodInfo(period: PeriodKey, s: Settings): PeriodInfo {
  const [y, m] = parsePeriod(period);
  const [py, pm] = parsePeriod(shiftPeriod(period, -1));
  // Bắt đầu ngay sau ngày chốt của kỳ trước (tháng ngắn thì ngày chốt là ngày cuối tháng).
  const prevEnd = clampDay(py, pm, s.cutoffDay);
  const startDate = new Date(Date.parse(prevEnd + 'T12:00:00') + 86_400_000);
  return {
    period,
    start: `${startDate.getFullYear()}-${pad(startDate.getMonth() + 1)}-${pad(startDate.getDate())}`,
    end: clampDay(y, m, s.cutoffDay),
    due: dueDate(period, s),
    salary: clampDay(y, m, s.salaryDay),
  };
}

/** Khoảng ngày của kỳ sao kê thẻ, vd. "21/10 – 20/11"; chốt cuối tháng thì không cần ghi. */
export function periodRange(period: PeriodKey, s: Settings): string | undefined {
  if (s.cutoffDay >= 28) return undefined;
  const p = periodInfo(period, s);
  const d = (x: ISODate) => `${x.slice(8, 10)}/${x.slice(5, 7)}`;
  return `${d(p.start)} – ${d(p.end)}`;
}

export function todayISO(now = new Date()): ISODate {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Kỳ thẻ gần nhất chưa tới hạn (hôm nay <= ngày đến hạn). */
export function nextDuePeriod(today: ISODate, s: Settings): PeriodKey {
  const [y, m] = today.split('-').map(Number);
  let p = shiftPeriod(periodKey(y, m), -1);
  while (dueDate(p, s) < today) p = shiftPeriod(p, 1);
  return p;
}

export const isIncome = (t: Transaction) => t.kind === 'income';
/** Chuyển tiền giữa hai nguồn của mình — không phải chi, không phải thu. */
export const isTransfer = (t: Transaction) => t.kind === 'transfer';
/** Khoản chi (kể cả hoàn tiền, số âm). */
export const isSpending = (t: Transaction) => !t.kind;
/** Cho vay / đi vay — không phải chi, không phải thu. */
export const isLoan = (t: Transaction) => t.kind === 'lend' || t.kind === 'borrow';

/** Giao dịch trong tháng dương lịch. */
export function txInPeriod(data: AppData, period: PeriodKey): Transaction[] {
  return data.transactions.filter((t) => monthOf(t.date) === period);
}

/** Giao dịch thuộc kỳ sao kê thẻ (theo ngày chốt). */
export function txInStatement(data: AppData, period: PeriodKey): Transaction[] {
  return data.transactions.filter((t) => periodOf(t.date, data.settings.cutoffDay) === period);
}

export function installmentActive(i: Installment, period: PeriodKey): boolean {
  if (period < i.firstPeriod) return false;
  if (i.months == null) return true;
  return period <= shiftPeriod(i.firstPeriod, i.months - 1);
}

/** Tiền trả mỗi kỳ khi trả đều hàng tháng theo gốc, số kỳ và lãi suất %/năm (0% → chia đều). */
export function installmentPayment(principal: number, months: number, ratePerYear = 0): number {
  if (!principal || !months) return 0;
  const r = ratePerYear / 12 / 100;
  return Math.round(r ? (principal * r) / (1 - Math.pow(1 + r, -months)) : principal / months);
}

/** Số tiền trả góp tính vào kỳ này (kỳ đầu cộng thêm phí chuyển đổi). */
export function installmentAmount(i: Installment, period: PeriodKey): number {
  if (!installmentActive(i, period)) return 0;
  return i.monthly + (period === i.firstPeriod ? i.fee ?? 0 : 0);
}

/** Đã trả bao nhiêu kỳ (tính cả kỳ đang xem) và còn phải trả bao nhiêu. */
export function installmentProgress(i: Installment, period: PeriodKey) {
  if (!i.months) return null;
  const paid = Math.max(0, Math.min(installmentIndex(i, period), i.months));
  return { paid, left: i.months - paid, amountLeft: (i.months - paid) * i.monthly };
}

export function installmentIndex(i: Installment, period: PeriodKey): number {
  const [y1, m1] = parsePeriod(i.firstPeriod);
  const [y2, m2] = parsePeriod(period);
  return (y2 - y1) * 12 + (m2 - m1) + 1;
}

export interface Statement {
  period: PeriodKey;
  purchases: number;
  refunds: number;
  installments: { item: Installment; amount: number }[];
  total: number;
  transactions: Transaction[];
}

/** Sao kê thẻ tín dụng của một kỳ: giao dịch (đã trừ hoàn tiền) + trả góp. */
export function statement(data: AppData, period: PeriodKey, accountId?: string): Statement {
  const creditIds = new Set(
    data.accounts.filter((a) => a.kind === 'credit' && (!accountId || a.id === accountId)).map((a) => a.id),
  );
  const txs = txInStatement(data, period).filter((t) => creditIds.has(t.accountId) && isSpending(t));
  const purchases = sum(txs.filter((t) => t.amount > 0).map((t) => t.amount));
  const refunds = sum(txs.filter((t) => t.amount < 0).map((t) => t.amount));
  const installments = data.installments
    .filter((i) => creditIds.has(i.accountId) && installmentActive(i, period))
    .map((item) => ({ item, amount: installmentAmount(item, period) }));
  return {
    period,
    purchases,
    refunds,
    installments,
    total: purchases + refunds + sum(installments.map((i) => i.amount)),
    transactions: txs,
  };
}

/** Phần người khác chịu trong khoản này (tổng của mọi người). */
export const otherShare = (t: Transaction) => sum(splitsOf(t).map((x) => x.amount));
/** Người khác còn nợ mình bao nhiêu trong khoản này. */
export const outstanding = (t: Transaction) => sum(splitsOf(t).map((x) => x.amount - x.paid));

/** Gom số còn nợ theo từng người. */
function owedBy(txs: Transaction[]) {
  const open = txs.filter((t) => outstanding(t) !== 0);
  const per = new Map<string, { amount: number; count: number }>();
  for (const t of open)
    for (const x of splitsOf(t)) {
      if (x.amount === x.paid) continue;
      const cur = per.get(x.person) ?? { amount: 0, count: 0 };
      per.set(x.person, { amount: cur.amount + x.amount - x.paid, count: cur.count + 1 });
    }
  const byPerson = [...per.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.amount - a.amount);
  return { open, total: sum(open.map(outstanding)), byPerson };
}

/** Mình đang nợ ai bao nhiêu (các khoản đi vay chưa trả hết). */
export const payables = (data: AppData) => owedBy(data.transactions.filter((t) => t.kind === 'borrow'));

/** Ai đang nợ mình bao nhiêu (chia tiền + cho vay; từng người, chỉ tính khoản chưa trả xong). */
export const receivables = (data: AppData) => owedBy(data.transactions.filter((t) => t.kind !== 'borrow'));

export interface BudgetRow {
  categoryId: string;
  limit: number;
  spent: number;
  remaining: number;
}

/**
 * Phần mình chịu của khoản `t` (ghi ở kỳ `from`) tính vào kỳ `period`.
 * Khoản đóng trước nhiều tháng chia đều; tháng cuối nhận phần lẻ cho đủ số.
 */
export function spreadShare(t: Transaction, from: PeriodKey, period: PeriodKey): number {
  const n = Math.max(1, t.spreadMonths ?? 1);
  if (n === 1) return from === period ? t.myShare : 0;
  const [y1, m1] = parsePeriod(from);
  const [y2, m2] = parsePeriod(period);
  const i = (y2 - y1) * 12 + (m2 - m1);
  if (i < 0 || i >= n) return 0;
  const each = Math.round(t.myShare / n);
  return i === n - 1 ? t.myShare - each * (n - 1) : each;
}

/** Đã chi theo danh mục của một kỳ — chỉ tính phần mình chịu. */
export function spentByCategory(data: AppData, period: PeriodKey): Map<string, number> {
  const out = new Map<string, number>();
  for (const t of data.transactions) {
    if (!isSpending(t)) continue;
    const share = spreadShare(t, monthOf(t.date), period);
    if (share) out.set(t.categoryId, (out.get(t.categoryId) ?? 0) + share);
  }
  for (const i of data.installments) {
    if (installmentActive(i, period)) out.set(i.categoryId, (out.get(i.categoryId) ?? 0) + installmentAmount(i, period));
  }
  return out;
}

export function budgetReport(data: AppData, period: PeriodKey) {
  const budget: Budget | undefined = data.budgets.find((b) => b.period === period);
  const spent = spentByCategory(data, period);
  const rows: BudgetRow[] = (budget?.lines ?? []).map((l) => {
    const s = spent.get(l.categoryId) ?? 0;
    return { categoryId: l.categoryId, limit: l.limit, spent: s, remaining: l.limit - s };
  });
  const budgeted = new Set(rows.map((r) => r.categoryId));
  const unbudgeted = [...spent.entries()]
    .filter(([id, v]) => !budgeted.has(id) && v !== 0)
    .map(([categoryId, s]) => ({ categoryId, limit: 0, spent: s, remaining: -s }));
  const totalLimit = sum(rows.map((r) => r.limit));
  return {
    budget,
    rows,
    unbudgeted,
    income: budget?.income ?? 0,
    totalLimit,
    unallocated: (budget?.income ?? 0) - totalLimit,
    totalSpent: sum([...spent.values()]),
  };
}

/**
 * Kiểm tra đủ tiền trả thẻ: tiền hiện có − các khoản cố định còn phải chi trong kỳ − sao kê.
 * Tương ứng tab "DOC TREN DIEN THOAI" trong file Excel.
 */
export function cashCheck(data: AppData, period: PeriodKey) {
  const report = budgetReport(data, period);
  const fixedIds = new Set(data.categories.filter((c) => c.kind === 'fixed').map((c) => c.id));
  const obligations = report.rows
    .filter((r) => fixedIds.has(r.categoryId) && r.remaining > 0)
    .map((r) => ({ categoryId: r.categoryId, amount: r.remaining }));
  const st = statement(data, period);
  // Đã nhập số dư các ví / tài khoản → dùng tổng số dư thật; chưa thì dùng "Tiền đang có" trong Cài đặt.
  const tracked = data.accounts.filter((a) => a.kind !== 'credit' && a.balanceAdjust !== undefined);
  const cashOnHand = tracked.length ? sum(tracked.map((a) => accountBalance(data, a.id))) : data.settings.cashOnHand;
  const available = cashOnHand - sum(obligations.map((o) => o.amount));
  return { cashOnHand, obligations, available, statement: st.total, surplus: available - st.total };
}

/** Tổng khoản thu trong kỳ. */
export function incomeIn(data: AppData, period: PeriodKey) {
  return sum(txInPeriod(data, period).filter(isIncome).map((t) => t.amount));
}

export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/* ---------- Số dư từng nguồn & tổng tài sản ---------- */

/**
 * Tiền vào (+) / ra (−) của một nguồn tính tới hôm nay: thu, chi, hoàn tiền, chuyển tiền;
 * thẻ tín dụng còn cộng tiền trả góp của các kỳ đã chốt.
 */
export function accountFlow(data: AppData, accountId: string, today = todayISO()): number {
  let flow = 0;
  for (const t of data.transactions) {
    if (t.date > today) continue;
    if (isTransfer(t)) {
      if (t.accountId === accountId) flow -= t.amount;
      if (t.toAccountId === accountId) flow += t.amount;
    } else if (t.accountId === accountId) {
      // Đi vay: tiền vào, trả lại thì tiền ra. Cho vay: ngược lại.
      const back = isLoan(t) ? sum(splitsOf(t).map((x) => x.paid)) : 0;
      if (t.kind === 'borrow') flow += t.amount - back;
      else if (t.kind === 'lend') flow -= t.amount - back;
      else flow += isIncome(t) ? t.amount : -t.amount;
    }
  }
  const acc = data.accounts.find((a) => a.id === accountId);
  if (acc?.kind === 'credit') {
    for (const i of data.installments.filter((x) => x.accountId === accountId)) {
      let p = i.firstPeriod;
      for (let n = 0; n < 600 && periodInfo(p, data.settings).end <= today; n++, p = shiftPeriod(p, 1)) flow -= installmentAmount(i, p);
    }
  }
  return flow;
}

/** Số dư hiện tại (thẻ tín dụng: số âm = đang nợ). undefined nếu chưa nhập số dư cho nguồn này. */
export function accountBalance(data: AppData, accountId: string, today = todayISO()): number {
  const acc = data.accounts.find((a) => a.id === accountId);
  if (acc?.balanceAdjust === undefined) return 0;
  return acc.balanceAdjust + accountFlow(data, accountId, today);
}

/** Muốn số dư hiện tại là `balance` thì balanceAdjust phải bằng bao nhiêu. */
export const adjustFor = (data: AppData, accountId: string, balance: number, today = todayISO()) =>
  balance - accountFlow(data, accountId, today);

/** Tổng tài sản = tiền ở các ví / tài khoản − nợ thẻ (chỉ các nguồn đã nhập số dư). */
export function netWorth(data: AppData, today = todayISO()) {
  const rows = data.accounts.filter((a) => a.balanceAdjust !== undefined).map((a) => ({ account: a, balance: accountBalance(data, a.id, today) }));
  return {
    rows,
    assets: sum(rows.filter((r) => r.balance > 0).map((r) => r.balance)),
    debts: sum(rows.filter((r) => r.balance < 0).map((r) => -r.balance)),
    total: sum(rows.map((r) => r.balance)),
  };
}

/* ---------- Khoản định kỳ ---------- */

/** Các ngày tới hạn của một khoản định kỳ mà chưa ghi (sau lần ghi gần nhất, tới hôm nay). */
export function recurringDue(r: Recurring, today = todayISO()): ISODate[] {
  if (r.paused) return [];
  const out: ISODate[] = [];
  let p = r.startDate.slice(0, 7) as PeriodKey;
  for (let n = 0; n < 120; n++, p = shiftPeriod(p, 1)) {
    const [y, m] = parsePeriod(p);
    const d = clampDay(y, m, r.day);
    if (d > today) break;
    if (d >= r.startDate && (!r.lastDate || d > r.lastDate)) out.push(d);
  }
  return out;
}

/** Lần tới của khoản định kỳ (sau hôm nay). */
export function recurringNext(r: Recurring, today = todayISO()): ISODate {
  let p = (r.lastDate && r.lastDate > today ? r.lastDate : today).slice(0, 7) as PeriodKey;
  for (let n = 0; n < 24; n++, p = shiftPeriod(p, 1)) {
    const [y, m] = parsePeriod(p);
    const d = clampDay(y, m, r.day);
    if (d > today && d >= r.startDate && (!r.lastDate || d > r.lastDate)) return d;
  }
  return today;
}
