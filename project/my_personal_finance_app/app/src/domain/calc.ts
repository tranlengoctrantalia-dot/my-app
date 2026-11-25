import { personName, splitsOf, unloggedPaid } from './split';
import { L } from '../labels';
import { fold } from '../ai/redact';
import type { Account, AppData, Budget, ISODate, Installment, PaidEntry, PeriodKey, Recurring, Settings, Transaction } from './types';

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
/** Khoản chi (kể cả hoàn tiền, số âm). Khoản đã chuyển thành trả góp thì không: trả góp tính thay từng kỳ. */
export const isSpending = (t: Transaction) => !t.kind && !t.installmentId;
/** Cho vay / đi vay — không phải chi, không phải thu. */
export const isLoan = (t: Transaction) => t.kind === 'lend' || t.kind === 'borrow';

/** Giao dịch còn hiệu lực (bỏ khoản đã huỷ) — dùng cho mọi phép tính tiền. */
export const live = (data: AppData): Transaction[] => data.transactions.filter((t) => !t.cancelled);

/** Giao dịch trong tháng dương lịch. `withCancelled`: kèm khoản đã huỷ (để hiện trong Sổ chi). */
export function txInPeriod(data: AppData, period: PeriodKey, withCancelled = false): Transaction[] {
  return (withCancelled ? data.transactions : live(data)).filter((t) => monthOf(t.date) === period);
}

/** Giao dịch thuộc kỳ sao kê thẻ (theo ngày chốt). */
/** Ngày chốt / hạn trả của một thẻ: thẻ có ngày riêng thì dùng, không thì lấy ngày chung trong Cài đặt. */
export function cardSettings(data: AppData, cardId?: string): Settings {
  const a = cardId ? data.accounts.find((x) => x.id === cardId) : undefined;
  if (!a?.cutoffDay && !a?.dueDay) return data.settings;
  return { ...data.settings, cutoffDay: a.cutoffDay || data.settings.cutoffDay, dueDay: a.dueDay || data.settings.dueDay };
}

/** Giao dịch thuộc kỳ sao kê `period` (mỗi thẻ theo ngày chốt của thẻ đó). */
export function txInStatement(data: AppData, period: PeriodKey): Transaction[] {
  return live(data).filter((t) => periodOf(t.date, cardSettings(data, t.accountId).cutoffDay) === period);
}

/** Các kỳ hạn trả góp hay gặp. */
export const INSTALLMENT_TERMS = [3, 6, 9, 12, 18, 24, 36];

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

/** Phần mình chịu của kỳ trả góp (khoản mua có chia tiền): dùng cho ngân sách; sao kê / số dư thẻ vẫn tính đủ. */
export const installmentMine = (i: Installment, period: PeriodKey) => Math.round(installmentAmount(i, period) * (i.share ?? 1));

/**
 * Gộp các khoản quẹt cùng một thẻ thành một khoản trả góp (như ngân hàng chuyển đổi một lần, phí tính một lần vào kỳ đầu).
 * Kỳ đầu = kỳ sao kê của khoản muộn nhất. Các khoản gốc giữ lại, gắn `installmentId` (không tính chi / sao kê nữa,
 * vẫn theo dõi người khác còn nợ). Có chia tiền thì ngân sách chỉ tính phần mình theo tỉ lệ tổng.
 */
export function mergeInstallment(
  data: AppData,
  txs: Transaction[],
  o: { id: string; categoryId: string; name: string; months: number; fee?: number },
): { item: Installment; txs: Transaction[] } {
  const principal = sum(txs.map((t) => t.amount));
  const mine = sum(txs.map((t) => t.myShare));
  const last = txs.reduce((a, b) => (b.date > a.date ? b : a));
  const item: Installment = {
    id: o.id,
    name: o.name,
    accountId: last.accountId,
    categoryId: o.categoryId,
    monthly: installmentPayment(principal, o.months),
    firstPeriod: periodOf(last.date, cardSettings(data, last.accountId).cutoffDay),
    months: o.months,
    principal,
    fee: o.fee || undefined,
    share: principal > 0 && mine !== principal ? mine / principal : undefined,
  };
  return { item, txs: txs.map((t) => ({ ...t, installmentId: o.id })) };
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
  /** Hoàn tiền về sau ngày chốt kỳ này, trước hạn trả: ngân hàng trừ vào số phải trả kỳ này (đã tính vào "đã trả"). */
  refundsAfter: number;
}

/** Giao dịch thẻ nằm trong sao kê một kỳ (chưa xét hoàn tiền sau chốt). */
function statementTxs(data: AppData, period: PeriodKey, creditIds: Set<string>): Transaction[] {
  // Cho bạn bè vay bằng thẻ cũng nằm trong sao kê: ngân hàng vẫn đòi đủ.
  return txInStatement(data, period).filter((t) => creditIds.has(t.accountId) && (isSpending(t) || t.kind === 'lend'));
}

function statementInstallments(data: AppData, period: PeriodKey, creditIds: Set<string>) {
  return data.installments
    .filter((i) => creditIds.has(i.accountId) && installmentActive(i, period))
    .map((item) => ({ item, amount: installmentAmount(item, period) }));
}

/**
 * Hoàn tiền về thẻ sau ngày chốt kỳ trước, tới hạn trả kỳ đó, lúc kỳ đó còn nợ: ngân hàng trừ luôn vào số phải trả
 * kỳ trước (không nằm trong sao kê kỳ sau nữa). Trả về: id khoản hoàn → kỳ được trừ + số tiền được trừ.
 */
export function lateRefunds(data: AppData): Map<string, { cardId: string; period: PeriodKey; amount: number }> {
  const out = new Map<string, { cardId: string; period: PeriodKey; amount: number }>();
  for (const card of data.accounts.filter((a) => a.kind === 'credit')) {
    const cs = cardSettings(data, card.id);
    const ids = new Set([card.id]);
    const tx = live(data).filter((t) => t.accountId === card.id || t.toAccountId === card.id);
    const refunds = tx.filter((t) => t.accountId === card.id && isSpending(t) && t.amount < 0).sort((a, b) => a.date.localeCompare(b.date));
    const pays = tx.filter((t) => isTransfer(t) && t.toAccountId === card.id);
    const movedOut = new Map<PeriodKey, number>();
    const movedIn = new Map<PeriodKey, number>();
    for (const r of refunds) {
      const own = periodOf(r.date, cs.cutoffDay);
      const prev = shiftPeriod(own, -1);
      const info = periodInfo(prev, cs);
      if (r.date > info.due || data.settings.cardSettled?.includes(`${card.id}:${prev}`)) continue;
      // Hoàn cho món mua cùng kỳ (mua rồi trả hàng sau ngày chốt): hai khoản bù nhau ở kỳ này, không đụng kỳ trước.
      if (tx.some((p) => p.accountId === card.id && isSpending(p) && p.amount === -r.amount && p.date <= r.date && periodOf(p.date, cs.cutoffDay) === own)) continue;
      // Ngân hàng chỉ trừ vào số phải trả khi mình trả SAU lúc tiền hoàn về (tới hạn trả). Chưa ghi lần trả đó thì thôi.
      if (!pays.some((p) => p.date >= r.date && p.date <= info.due)) continue;
      const total =
        sum(statementTxs(data, prev, ids).map((t) => t.amount)) +
        sum(statementInstallments(data, prev, ids).map((i) => i.amount)) -
        (movedOut.get(prev) ?? 0);
      // Đã trả trước lúc tiền hoàn về (sau ngày chốt): trả đủ rồi thì tiền hoàn để dành cho kỳ sau.
      const paidBefore = sum(
        pays
          .filter((p) => p.date > info.end && p.date <= r.date)
          .filter((p) => (p.source?.match(/^cardpay:(\d{4}-\d{2})$/)?.[1] ?? prev) === prev)
          .map((p) => p.amount),
      );
      const v = Math.min(-r.amount, total - (movedIn.get(prev) ?? 0) - paidBefore);
      if (v <= 0) continue;
      out.set(r.id, { cardId: card.id, period: prev, amount: v });
      movedIn.set(prev, (movedIn.get(prev) ?? 0) + v);
      movedOut.set(own, (movedOut.get(own) ?? 0) + v);
    }
  }
  return out;
}

/** Sao kê thẻ tín dụng của một kỳ: giao dịch (đã trừ hoàn tiền) + trả góp. */
export function statement(data: AppData, period: PeriodKey, accountId?: string): Statement {
  const creditIds = new Set(
    data.accounts.filter((a) => a.kind === 'credit' && (!accountId || a.id === accountId)).map((a) => a.id),
  );
  const late = lateRefunds(data);
  // Khoản hoàn đã trừ vào kỳ trước: bỏ phần đó khỏi kỳ này (trừ hết thì bỏ hẳn khỏi danh sách).
  const txs = statementTxs(data, period, creditIds).filter((t) => (late.get(t.id)?.amount ?? 0) !== -t.amount);
  const purchases = sum(txs.filter((t) => t.amount > 0).map((t) => t.amount));
  const refunds = sum(txs.filter((t) => t.amount < 0).map((t) => t.amount + (late.get(t.id)?.amount ?? 0)));
  const installments = statementInstallments(data, period, creditIds);
  const refundsAfter = sum([...late.values()].filter((x) => x.period === period && creditIds.has(x.cardId)).map((x) => x.amount));
  return {
    period,
    purchases,
    refunds,
    installments,
    total: purchases + refunds + sum(installments.map((i) => i.amount)),
    transactions: txs,
    refundsAfter,
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
export const payables = (data: AppData) => owedBy(live(data).filter((t) => t.kind === 'borrow'));

/** Ai đang nợ mình bao nhiêu (chia tiền + cho vay; từng người, chỉ tính khoản chưa trả xong). */
/** Người khác còn nợ mình. Truyền `accountId` = chỉ các khoản đi ra từ nguồn đó (vd. 1 thẻ). */
export const receivables = (data: AppData, accountId?: string) =>
  owedBy(live(data).filter((t) => t.kind !== 'borrow' && (!accountId || t.accountId === accountId)));

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
  for (const t of live(data)) {
    if (!isSpending(t)) continue;
    const share = spreadShare(t, monthOf(t.date), period);
    if (share) out.set(t.categoryId, (out.get(t.categoryId) ?? 0) + share);
  }
  for (const i of data.installments) {
    if (installmentActive(i, period)) out.set(i.categoryId, (out.get(i.categoryId) ?? 0) + installmentMine(i, period));
  }
  return out;
}

/** Danh mục tiết kiệm (cố định): bỏ tiền vào Mục tiêu cũng là đã đóng tiết kiệm. */
const isSavingCategory = (c: { id: string; name: string; kind: string }) => c.kind === 'fixed' && (c.id === 'saving' || /tiet kiem|de danh/.test(fold(c.name)));

export function budgetReport(data: AppData, period: PeriodKey) {
  const budget: Budget | undefined = data.budgets.find((b) => b.period === period);
  const spent = spentByCategory(data, period);
  // Tiền bỏ vào Mục tiêu trong tháng tính là đã đóng dòng tiết kiệm (lấy số lớn hơn, phòng khi vừa ghi chi vừa bỏ vào mục tiêu cùng một khoản).
  const saving = data.categories.find(isSavingCategory);
  const deposited = sum((data.goals ?? []).flatMap((g) => g.deposits.filter((d) => !d.opening && monthOf(d.date) === period).map((d) => d.amount)));
  if (saving && deposited > (spent.get(saving.id) ?? 0)) spent.set(saving.id, deposited);
  const rows: BudgetRow[] = (budget?.lines ?? []).map((l) => {
    const s = spent.get(l.categoryId) ?? 0;
    return { categoryId: l.categoryId, limit: l.limit, spent: s, remaining: l.limit - s };
  });
  const budgeted = new Set(rows.map((r) => r.categoryId));
  const unbudgeted = [...spent.entries()]
    .filter(([id, v]) => !budgeted.has(id) && v !== 0)
    .map(([categoryId, s]) => ({ categoryId, limit: 0, spent: s, remaining: -s }));
  const totalLimit = sum(rows.map((r) => r.limit));
  // Trả góp tính theo số thật của tháng (dòng ngân sách loại trả góp nếu có thì bỏ qua, tránh trừ 2 lần).
  const kind = new Map(data.categories.map((c) => [c.id, c.kind]));
  const planned = sum(rows.filter((r) => kind.get(r.categoryId) !== 'installment').map((r) => r.limit));
  const installments = sum(data.installments.filter((i) => installmentActive(i, period)).map((i) => installmentMine(i, period)));
  return {
    budget,
    rows,
    unbudgeted,
    income: budget?.income ?? 0,
    totalLimit,
    installments,
    /** Lương − các dòng ngân sách − trả góp: số thật sự chưa chia, âm là đặt lố. */
    unallocated: (budget?.income ?? 0) - planned - installments,
    totalSpent: sum([...spent.values()]),
  };
}

/**
 * Kiểm tra đủ tiền trả thẻ: tiền hiện có − các khoản cố định còn phải chi trong kỳ − sao kê.
 * Tương ứng tab "DOC TREN DIEN THOAI" trong file Excel.
 */
/**
 * Tiền trả thẻ được chia cho từng kỳ giống ngân hàng: trả cho sao kê đã chốt còn nợ, cũ nhất trước
 * (trả trễ hạn vẫn tính cho kỳ cũ). Không còn kỳ nào đã chốt mà chưa trả thì mới tính là trả trước cho kỳ đang chạy.
 */
export function cardPayments(data: AppData, cardId: string): Map<PeriodKey, number> {
  const out = new Map<PeriodKey, number>();
  // Tiền hoàn về sau ngày chốt mà ngân hàng trừ vào kỳ trước: tính như đã trả cho kỳ đó.
  for (const x of lateRefunds(data).values()) if (x.cardId === cardId) out.set(x.period, (out.get(x.period) ?? 0) + x.amount);
  const pays = live(data).filter((t) => isTransfer(t) && t.toAccountId === cardId).sort((a, b) => a.date.localeCompare(b.date));
  if (!pays.length) return out;
  const cs = cardSettings(data, cardId);
  const cut = cs.cutoffDay;
  const owed = new Map<PeriodKey, number>();
  const left = (p: PeriodKey) => {
    // Kỳ đã trả xong: không nhận thêm tiền trả nào.
    if (isSettled(data, cardId, p)) return 0;
    if (!owed.has(p)) owed.set(p, statement(data, p, cardId).total);
    return owed.get(p)! - (out.get(p) ?? 0);
  };
  const add = (p: PeriodKey, v: number) => out.set(p, (out.get(p) ?? 0) + v);
  const plus15 = (d: ISODate) => new Date(Date.parse(d) + 15 * 86_400_000).toISOString().slice(0, 10);
  for (const t of pays) {
    // Ghi từ nút "Ghi đã trả thẻ" của một kỳ: tính đúng cho kỳ đó.
    const tagged = t.source?.match(/^cardpay:(\d{4}-\d{2})$/)?.[1];
    if (tagged) {
      add(tagged, t.amount);
      continue;
    }
    let amt = t.amount;
    const open = periodOf(t.date, cut);
    // Sao kê đã chốt (trước ngày trả) mà còn nợ, cũ trước. Quá hạn hơn 15 ngày thì coi như đã trả ngoài app.
    const closed = [3, 2, 1]
      .map((i) => shiftPeriod(open, -i))
      .filter((p) => periodInfo(p, cs).end < t.date && plus15(periodInfo(p, cs).due) >= t.date && left(p) > 0);
    for (const p of closed) {
      const v = Math.min(amt, left(p));
      add(p, v);
      amt -= v;
      if (amt <= 0) break;
    }
    // Còn dư mà không có kỳ cũ nào còn nợ: trả trong 15 ngày sau hạn kỳ trước thì vẫn là trả cho kỳ trước
    // (app ghi thiếu sao kê đó); muộn hơn mới coi là trả trước cho kỳ đang chạy.
    const prev = shiftPeriod(open, -1);
    const lateUntil = plus15(periodInfo(prev, cs).due);
    // Kỳ trước chắc chắn đã xong (đánh dấu, hoặc app thấy trả đủ) → khoản này là trả trước cho kỳ đang chạy.
    const prevDone = isSettled(data, cardId, prev) || (statement(data, prev, cardId).total > 0 && left(prev) <= 0);
    if (!closed.length && amt > 0 && (prevDone || t.date > lateUntil)) add(open, amt);
  }
  return out;
}

/** Kỳ thẻ đã trả xong: đã bấm "Đã trả thẻ" cho kỳ đó (trả là xong, dù số tiền lệch với app), hoặc đánh dấu (bản cũ). */
export const isSettled = (data: AppData, cardId: string, period: PeriodKey) =>
  !!data.settings.cardSettled?.includes(`${cardId}:${period}`) ||
  live(data).some((t) => isTransfer(t) && t.toAccountId === cardId && t.source === `cardpay:${period}`);

/** Tiền đã trả cho kỳ `period` (một thẻ, hoặc mọi thẻ nếu không truyền). Kỳ đã đánh dấu trả hết = trả đủ. */
export function statementPaid(data: AppData, period: PeriodKey, accountId?: string): number {
  const cards = data.accounts.filter((a) => a.kind === 'credit' && (!accountId || a.id === accountId));
  return sum(cards.map((c) => (isSettled(data, c.id, period) ? Math.max(0, statement(data, period, c.id).total) : (cardPayments(data, c.id).get(period) ?? 0))));
}

export function cashCheck(data: AppData, period: PeriodKey, today = todayISO(), accountId?: string) {
  // Khoản cố định + lương lấy theo tháng dương lịch đang chạy (không phải "tháng" của kỳ thẻ).
  const month = monthOf(today);
  const report = budgetReport(data, month);
  const fixedIds = new Set(data.categories.filter((c) => c.kind === 'fixed').map((c) => c.id));
  const obligations = report.rows
    .filter((r) => fixedIds.has(r.categoryId) && r.remaining > 0)
    .map((r) => ({ categoryId: r.categoryId, amount: r.remaining }));
  const st = statement(data, period, accountId);
  // Đã nhập số dư các ví / tài khoản → dùng tổng số dư thật; chưa thì dùng "Tiền đang có" trong Cài đặt.
  const tracked = data.accounts.filter((a) => a.kind !== 'credit' && a.balanceAdjust !== undefined);
  const cashOnHand = tracked.length ? sum(tracked.map((a) => accountBalance(data, a.id, today))) : data.settings.cashOnHand;
  const due = periodInfo(period, cardSettings(data, accountId)).due;
  const salaryDate = periodInfo(month, data.settings).salary;
  // Lương tháng này về trước hạn trả thẻ mà chưa ghi: cộng phần thu đã đặt ở Ngân sách còn chưa về.
  const incoming = salaryDate > today && salaryDate <= due ? Math.max(0, report.income - incomeIn(data, month)) : 0;
  // Tiền tiêu hằng ngày từ nay tới cuối tháng (ăn uống, đi lại…): tổng ngân sách linh hoạt − tổng đã tiêu
  // (mục lố trừ luôn vào phần còn lại của mục khác, giống "Còn tiêu được" ở màn chính).
  // Chưa đặt ngân sách cho các mục đó thì ước theo mức tiêu tháng trước, chia theo số ngày còn lại.
  const spendIds = new Set(data.categories.filter((c) => c.kind === 'spend').map((c) => c.id));
  const flexRows = [...report.rows, ...report.unbudgeted].filter((r) => spendIds.has(r.categoryId));
  const flexLeft = sum(flexRows.map((r) => r.limit)) - sum(flexRows.map((r) => r.spent));
  const { end: monthEnd } = monthRange(month);
  const daysLeft = Math.round((Date.parse(monthEnd) - Date.parse(today)) / 86_400_000) + 1;
  const daysInMonth = Number(monthEnd.slice(8, 10));
  const lastMonthFlex = sum([...spentByCategory(data, shiftPeriod(month, -1)).entries()].filter(([id]) => spendIds.has(id)).map(([, v]) => v));
  const daily = flexRows.some((r) => r.limit > 0)
    ? Math.max(0, flexLeft)
    : Math.round((Math.max(0, lastMonthFlex - sum([...spentByCategory(data, month).entries()].filter(([id]) => spendIds.has(id)).map(([, v]) => v))) * daysLeft) / daysInMonth);
  const available = cashOnHand + incoming - sum(obligations.map((o) => o.amount)) - daily;
  // Đã chuyển trả thẻ cho kỳ này: tiền đó đã ra khỏi ví rồi, không trừ lần nữa.
  const paid = statementPaid(data, period, accountId);
  const toPay = Math.max(0, st.total - paid);
  // Người khác còn nợ mình (người yêu, bạn bè, công ty): trả lại thì cộng vào.
  // Xem 1 thẻ: chỉ tiền người khác nợ từ các khoản quẹt thẻ đó (trả lại để trả nợ thẻ đó).
  const owedBack = receivables(data, accountId).total;
  return {
    cashOnHand,
    /** true: tiền đang có lấy từ số dư các ví; false: lấy số nhập tay ở Cài đặt. */
    fromWallets: tracked.length > 0,
    incoming,
    salaryDate,
    obligations,
    /** Tiêu hằng ngày còn lại tới cuối tháng (đã trừ vào available). */
    daily,
    /** true: lấy theo ngân sách; false: ước theo tháng trước. */
    dailyFromBudget: flexRows.some((r) => r.limit > 0),
    /** Ăn tiêu đã lố ngân sách linh hoạt tháng này (0 nếu chưa lố). */
    flexOver: flexRows.some((r) => r.limit > 0) ? Math.max(0, -flexLeft) : 0,
    available,
    statement: st.total,
    paid,
    toPay,
    owedBack,
    surplus: available - toPay + owedBack,
  };
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
/**
 * Người khác trả lại tiền (chia bill, cho vay) thì tiền vào đâu: khoản trả bằng tiền mặt / ví / ngân hàng thì về
 * đúng nguồn đó; khoản quẹt thẻ thì về tài khoản ngân hàng (bạn bè, công ty chuyển khoản chứ không trả vào thẻ).
 */
export function repayAccount(data: AppData, t: Transaction): string {
  const kind = data.accounts.find((a) => a.id === t.accountId)?.kind;
  if (kind !== 'credit') return t.accountId;
  return (data.accounts.find((a) => a.kind === 'bank') ?? data.accounts.find((a) => a.kind !== 'credit'))?.id ?? t.accountId;
}

/** Một dòng tiền vào / ra của một nguồn (để liệt kê như sao kê ví). */
export interface Move {
  date: ISODate;
  label: string;
  amount: number;
  txId?: string;
  /** Tiền người khác trả lại: thuộc lần nhận nào (cùng người + cùng giờ ghi = 1 lần chuyển). */
  receipt?: { person: string; ts: number };
}

/**
 * Từng khoản tiền vào (+) / ra (−) của một nguồn tính tới hôm nay: thu, chi, hoàn tiền, chuyển tiền, người khác trả lại;
 * thẻ tín dụng còn trừ tiền trả góp của các kỳ đã chốt. Có mốc số dư thì chỉ lấy khoản sau mốc.
 */
export function accountMoves(data: AppData, accountId: string, today = todayISO(), since?: Account['balanceAt']): Move[] {
  const out: Move[] = [];
  const seen = new Set(since?.seen);
  // Có mốc: chỉ tính khoản sau mốc (cùng ngày mốc thì chỉ khoản ghi sau lúc nhập số dư).
  const after = (t: Transaction) => !since || t.date > since.date || (t.date === since.date && !seen.has(t.id));
  // Lần trả có ghi giờ: sau mốc thì cộng. Mốc không có giờ là mốc nhập trước khi app ghi giờ trả → mọi lần trả có giờ đều sau mốc.
  const afterMark = (e: PaidEntry) => !since?.ts || e.ts > since.ts;
  const isSplit = (t: Transaction) => !isTransfer(t) && !isIncome(t);
  const unlogged = (t: Transaction) => (isSplit(t) ? sum(splitsOf(t).map(unloggedPaid)) : 0);
  const sign = (t: Transaction) => (t.kind === 'borrow' ? -1 : 1);
  for (const t of live(data)) {
    if (t.date > today) continue;
    const backHere = repayAccount(data, t) === accountId;
    // Người khác trả lại có ghi ngày nhận: cộng đúng ngày nhận, không phụ thuộc ngày của khoản chi.
    if (backHere && isSplit(t))
      for (const x of splitsOf(t))
        for (const e of x.log ?? [])
          if (e.date <= today && afterMark(e) && e.amount + (e.extra ?? 0))
            out.push({
              date: e.date,
              label: `${personName(data.settings, x.person)} ${L.wallet.paidBack} · ${t.merchant}`,
              amount: sign(t) * (e.amount + (e.extra ?? 0)),
              txId: t.id,
              receipt: { person: x.person, ts: e.ts },
            });
    if (!after(t)) {
      // Khoản trước mốc, phần trả lại chưa rõ ngày (bản cũ): chỉ tính phần tăng thêm SAU lúc nhập số dư.
      // Mốc nhập bằng bản cũ (chưa lưu `paid`) thì bỏ qua, kẻo cộng lại cả tiền đã trả từ trước;
      // mốc bản 1 chỉ lưu `paid` của khoản thuộc chính nguồn này.
      const tracked = since?.paid && ((since.v ?? 1) >= 2 ? backHere : backHere && t.accountId === accountId);
      if (tracked && isSplit(t)) {
        const delta = unlogged(t) - (since!.paid![t.id] ?? 0);
        if (delta) out.push({ date: t.date, label: `${t.merchant} · ${L.wallet.paidBackLater}`, amount: sign(t) * delta, txId: t.id });
      }
      continue;
    }
    if (isTransfer(t)) {
      if (t.accountId === accountId) out.push({ date: t.date, label: t.merchant, amount: -t.amount, txId: t.id });
      if (t.toAccountId === accountId) out.push({ date: t.date, label: t.merchant, amount: t.amount, txId: t.id });
      continue;
    }
    // Đi vay: tiền vào, trả lại thì tiền ra. Cho vay / chia tiền: người khác trả lại thì tiền về `repayAccount`.
    // Khoản đã chuyển trả góp: thẻ bị trừ theo từng kỳ góp (phía dưới), không trừ cả cục.
    if (t.accountId === accountId && !t.installmentId)
      out.push({ date: t.date, label: t.merchant, amount: t.kind === 'borrow' || isIncome(t) ? t.amount : -t.amount, txId: t.id });
    // Phần trả lại chưa rõ ngày (bản cũ): tính vào ngày của khoản chi như trước.
    if (backHere)
      for (const x of splitsOf(t)) {
        const u = unloggedPaid(x);
        if (u)
          out.push({
            date: t.date,
            label: `${personName(data.settings, x.person)} ${L.wallet.paidBack} · ${t.merchant}`,
            amount: sign(t) * u,
            txId: t.id,
          });
      }
  }
  const acc = data.accounts.find((a) => a.id === accountId);
  if (acc?.kind === 'credit') {
    for (const i of data.installments.filter((x) => x.accountId === accountId)) {
      let p = i.firstPeriod;
      const cs = cardSettings(data, accountId);
      for (let n = 0; n < 600 && periodInfo(p, cs).end <= today; n++, p = shiftPeriod(p, 1)) {
        const end = periodInfo(p, cs).end;
        if (!since || end > since.date) out.push({ date: end, label: i.name, amount: -installmentAmount(i, p) });
      }
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export function accountFlow(data: AppData, accountId: string, today = todayISO(), since?: Account['balanceAt']): number {
  return sum(accountMoves(data, accountId, today, since).map((m) => m.amount));
}

/** Số dư hiện tại (thẻ tín dụng: số âm = đang nợ). undefined nếu chưa nhập số dư cho nguồn này. */
export function accountBalance(data: AppData, accountId: string, today = todayISO()): number {
  const acc = data.accounts.find((a) => a.id === accountId);
  if (acc?.balanceAdjust === undefined) return 0;
  if (acc.balanceAt) return acc.balanceAt.amount + accountFlow(data, accountId, today, acc.balanceAt);
  // Bản cũ (chưa có mốc): số dư = số chênh + mọi khoản từ trước tới nay.
  return acc.balanceAdjust + accountFlow(data, accountId, today);
}

/** Mốc số dư khi người dùng nhập "số dư hiện tại" hôm nay. */
export function balanceAnchor(data: AppData, accountId: string, balance: number, today = todayISO(), ts = Date.now()): Account['balanceAt'] {
  const mine = live(data).filter((t) => t.accountId === accountId || t.toAccountId === accountId || repayAccount(data, t) === accountId);
  const seen = mine.filter((t) => t.date === today).map((t) => t.id);
  // Phần trả lại chưa rõ ngày của từng khoản (tiền về nguồn này) lúc nhập số dư: tăng thêm về sau mới cộng vào ví.
  // Phần có ghi ngày thì so giờ ghi với `ts`.
  const paid = Object.fromEntries(
    mine
      .filter((t) => t.date <= today && repayAccount(data, t) === accountId)
      .map((t) => [t.id, sum(splitsOf(t).map(unloggedPaid))] as const)
      .filter(([, v]) => v !== 0),
  );
  return { date: today, amount: balance, seen, paid, v: 3, ts };
}

/**
 * Mốc số dư nhập bằng bản cũ (không lưu số đã trả lúc nhập) mà có khoản trước mốc người khác đã trả lại chưa rõ ngày:
 * app không biết tiền đó về trước hay sau mốc nên không cộng → nên nhập lại số dư.
 */
export function staleAnchor(data: AppData, accountId: string): boolean {
  const since = data.accounts.find((a) => a.id === accountId)?.balanceAt;
  if (!since || since.paid) return false;
  return live(data).some(
    (t) => t.date <= since.date && !isTransfer(t) && !isIncome(t) && repayAccount(data, t) === accountId && splitsOf(t).some((x) => unloggedPaid(x) > 0),
  );
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
    // Tháng đã ghi rồi thì thôi (kể cả khi đổi ngày lặp sang ngày sau trong cùng tháng).
    if (d >= r.startDate && (!r.lastDate || (d > r.lastDate && monthOf(d) !== monthOf(r.lastDate)))) out.push(d);
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
