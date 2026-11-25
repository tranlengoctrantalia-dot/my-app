/**
 * Các tính năng "thông minh": khoản lạ cần xem lại, gợi ý ngân sách, tổng kết tháng, lịch tiền.
 * Hàm thuần, không dùng React.
 */
import { cardSettings, monthOf, monthRange, statementPaid, budgetReport, incomeIn, installmentActive, installmentMine, isSpending, parsePeriod, periodInfo, shiftPeriod, spentByCategory, statement, sum, txInPeriod } from './calc';
import { fold } from '../ai/redact';
import { budgetRoom } from './coach';
import { goalStatus } from './goals';
import { basePeriods, periodTotals, spendCategoryIds } from './report';
import type { AppData, Installment, ISODate, PeriodKey, Transaction } from './types';

const days = (a: ISODate, b: ISODate) => Math.abs(Date.parse(a) - Date.parse(b)) / 86_400_000;
const norm = (s: string) => s.trim().toLowerCase();
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0;
};

/* ---------- Khoản lạ ---------- */

export type Odd =
  /** Cùng nơi, cùng số tiền, cách nhau ≤ 2 ngày: ghi trùng hoặc bị trừ 2 lần. */
  | { kind: 'duplicate'; tx: Transaction; other: Transaction }
  /** Khoản hằng tháng (các tháng trước 1 lần) mà tháng này bị trừ 2 lần. */
  | { kind: 'twice'; tx: Transaction; other: Transaction }
  /** To bất thường so với cùng danh mục 3 tháng trước. */
  | { kind: 'big'; tx: Transaction; times: number }
  /** Ghi nhầm thành Chi, làm tổng chi bị lố: trả thẻ (phải là Chuyển), trả góp (app đã tự cộng), cho mượn (phải là Cho vay). */
  | { kind: 'cardPay' | 'installment' | 'loan'; tx: Transaction };

/** Ghi chú kiểu "trả thẻ", "thanh toán thẻ tín dụng" (đã bỏ dấu). */
export const CARD_PAY = /(^|\s)(tra|thanh toan|tt)( du)? (no )?the( tin dung)?(\s|$)|card payment|tra tien the/;
const LOAN = /(^|\s)cho (\S+ ){0,3}(muon|vay)(\s|$)|(^|\s)(tra no|tra lai tien)(\s|$)/;
// Chỉ "trả góp" mới tính; "góp quỹ", "góp tiền đi chơi"… không phải trả góp.
export const INSTALLMENT = /(^|\s)tra gop(\s|$)|installment/;

/** Khoản sắp ghi có vẻ trùng một khoản trả góp đang chạy (app đã tự cộng vào sao kê và ngân sách). */
export function installmentMatch(data: AppData, merchant: string, amount: number, date: ISODate): Installment | undefined {
  const text = fold(merchant);
  const active = data.installments.filter((i) => installmentActive(i, monthOf(date)));
  return active.find((i) => i.monthly === amount || (fold(i.name).length > 2 && text.includes(fold(i.name))));
}

/** Khoản to bất thường: gấp ≥ BIG_TIMES lần mức thường và ≥ BIG_MIN. */
const BIG_TIMES = 3;
const BIG_MIN = 500_000;

export function oddTransactions(data: AppData, period: PeriodKey): Odd[] {
  const cur = txInPeriod(data, period).filter((t) => isSpending(t) && t.amount > 0 && !t.source?.startsWith('recurring:'));
  const out: Odd[] = [];
  const seen = new Set<string>();

  // Ghi nhầm thành Chi (hay gặp nhất khi thấy tiêu lố).
  const catName = (id: string) => data.categories.find((c) => c.id === id)?.name ?? '';
  const instCats = new Set(data.installments.map((i) => i.categoryId));
  const activeInst = data.installments.filter((i) => installmentActive(i, period));
  for (const t of cur) {
    const text = fold(`${t.merchant} ${t.note ?? ''}`);
    const kind = CARD_PAY.test(`${text} ${fold(catName(t.categoryId))}`)
      ? 'cardPay'
      : instCats.has(t.categoryId) ||
          (activeInst.length > 0 && (INSTALLMENT.test(text) || activeInst.some((i) => fold(i.name).length > 2 && text.includes(fold(i.name)))))
        ? 'installment'
        : LOAN.test(text)
          ? 'loan'
          : null;
    if (kind) {
      out.push({ kind, tx: t });
      seen.add(t.id);
    }
  }

  // Trùng: cùng nơi + số tiền, gần ngày.
  const sorted = [...cur].sort((a, b) => a.date.localeCompare(b.date));
  for (let i = 0; i < sorted.length; i++)
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i];
      const b = sorted[j];
      if (days(a.date, b.date) > 2) break;
      if (a.amount === b.amount && norm(a.merchant) === norm(b.merchant) && !seen.has(b.id)) {
        out.push({ kind: 'duplicate', tx: b, other: a });
        seen.add(b.id);
      }
    }

  // Gói tháng bị trừ 2 lần: tháng này 2 lần, mỗi tháng trước đúng 1 lần (cùng nơi + số tiền).
  const prev = [shiftPeriod(period, -1), shiftPeriod(period, -2)];
  const key = (t: Transaction) => `${norm(t.merchant)}|${t.amount}`;
  const groups = new Map<string, Transaction[]>();
  for (const t of cur) groups.set(key(t), [...(groups.get(key(t)) ?? []), t]);
  for (const [k, list] of groups) {
    if (list.length !== 2 || seen.has(list[1].id)) continue;
    const monthly = prev.every((p) => txInPeriod(data, p).filter((t) => isSpending(t) && key(t) === k).length === 1);
    if (monthly) {
      out.push({ kind: 'twice', tx: list[1], other: list[0] });
      seen.add(list[1].id);
    }
  }

  // To bất thường so với trung vị cùng danh mục 3 tháng trước (cần ≥ 4 khoản để so).
  const before = [1, 2, 3].flatMap((i) => txInPeriod(data, shiftPeriod(period, -i))).filter((t) => isSpending(t) && t.amount > 0);
  for (const t of cur) {
    if (seen.has(t.id) || t.amount < BIG_MIN) continue;
    const base = before.filter((x) => x.categoryId === t.categoryId).map((x) => x.amount);
    if (base.length < 4) continue;
    const m = median(base);
    if (m > 0 && t.amount >= BIG_TIMES * m) out.push({ kind: 'big', tx: t, times: Math.round(t.amount / m) });
  }
  // Ghi nhầm lên trước (chắc chắn làm lố), rồi mới tới khoản mới nhất.
  const mistake = (o: Odd) => Number(o.kind === 'cardPay' || o.kind === 'installment' || o.kind === 'loan');
  return out.sort((a, b) => mistake(b) - mistake(a) || b.tx.date.localeCompare(a.tx.date));
}

/* ---------- Gợi ý ngân sách (từ tiền thu + mục tiêu để dành) ---------- */

const floor50 = (n: number) => Math.max(0, Math.floor(n / 50_000) * 50_000);
const isSavingCat = (c: { id: string; name: string }) => c.id === 'saving' || /tiet kiem|de danh/.test(fold(c.name));

export interface BudgetPlan {
  income: number;
  /** Khoản cố định (gửi mẹ, gym, góp quỹ…): giữ số đã nhập, chưa nhập thì lấy mức chi trung bình. */
  fixed: number;
  /** Trả góp kỳ này (đã biết trước). */
  installments: number;
  /** Để dành: theo % thu nhập, nhưng không ít hơn số mục tiêu tiết kiệm cần mỗi tháng. */
  saving: number;
  /** Mục tiêu tiết kiệm cần mỗi tháng. */
  goalsMonthly: number;
  /** Còn lại để chi linh hoạt (ăn uống, mua sắm…). */
  flexible: number;
  /** Chia phần linh hoạt theo thói quen chi các tháng trước (true) hay chia đều (false). */
  byHabit: boolean;
  limits: Record<string, number>;
}

/**
 * Lập ngân sách từ tiền thu: thu − cố định − trả góp − để dành = phần chi linh hoạt,
 * rồi chia phần đó cho các mục theo tỉ lệ chi thường ngày (chưa có lịch sử thì chia đều).
 */
export function planBudget(data: AppData, period: PeriodKey, income: number, savePct: number, current: Record<string, number>): BudgetPlan {
  const today = monthRange(period).start;
  const base = basePeriods(data, period, 3);
  const avgSpent = new Map<string, number>();
  for (const p of base) for (const [id, v] of spentByCategory(data, p)) avgSpent.set(id, (avgSpent.get(id) ?? 0) + v / base.length);

  const limits: Record<string, number> = {};
  let fixed = 0;
  let installments = 0;
  const savingCat = data.categories.find((c) => c.kind === 'fixed' && isSavingCat(c));
  for (const c of data.categories) {
    if (c.kind === 'fixed' && c !== savingCat) {
      const v = current[c.id] > 0 ? current[c.id] : Math.ceil((avgSpent.get(c.id) ?? 0) / 50_000) * 50_000;
      limits[c.id] = v;
      fixed += v;
    }
  }
  for (const i of data.installments) {
    if (!installmentActive(i, period)) continue;
    const v = installmentMine(i, period);
    limits[i.categoryId] = (limits[i.categoryId] ?? 0) + v;
    installments += v;
  }
  const goalsMonthly = sum((data.goals ?? []).map((g) => goalStatus(g, today).monthly));
  const saving = Math.max(Math.round((income * savePct) / 100 / 50_000) * 50_000, goalsMonthly);
  if (savingCat) limits[savingCat.id] = saving;

  const flexible = Math.max(0, income - fixed - installments - saving);
  const spendCats = data.categories.filter((c) => c.kind === 'spend');
  const habit = spendCats.map((c) => avgSpent.get(c.id) ?? 0);
  const habitTotal = sum(habit);
  const byHabit = habitTotal > 0;
  spendCats.forEach((c, i) => {
    const w = byHabit ? habit[i] / habitTotal : 1 / spendCats.length;
    limits[c.id] = floor50(flexible * w);
  });
  return { income, fixed, installments, saving, goalsMonthly, flexible, byHabit, limits };
}

/* ---------- Tổng kết tháng ---------- */

export interface Recap {
  period: PeriodKey;
  spent: number;
  income: number;
  saving: number;
  /** % so với tháng trước (null nếu tháng trước chưa có chi). */
  vsPrev: number | null;
  top: { categoryId: string; amount: number; pct: number }[];
  count: number;
  biggest?: Transaction;
  /** Số ngày trong kỳ không tiêu đồng nào (chi linh hoạt). */
  noSpendDays: number;
  totalDays: number;
  /** Số danh mục trong ngân sách / đã giữ được. */
  budget: { kept: number; total: number };
  goalsSaved: number;
}

export function recap(data: AppData, period: PeriodKey): Recap {
  const t = periodTotals(data, period);
  const prev = periodTotals(data, shiftPeriod(period, -1)).spent;
  const ids = spendCategoryIds(data);
  const byCat = [...spentByCategory(data, period).entries()].filter(([id, v]) => ids.has(id) && v > 0).sort((a, b) => b[1] - a[1]);
  const txs = txInPeriod(data, period).filter((x) => isSpending(x) && x.amount > 0);
  const info = monthRange(period);
  const totalDays = Math.round(days(info.start, info.end)) + 1;
  const spendDays = new Set(txs.filter((x) => data.categories.find((c) => c.id === x.categoryId)?.kind === 'spend').map((x) => x.date));
  const rows = budgetReport(data, period).rows.filter((r) => r.limit > 0);
  const goalsSaved = sum(
    (data.goals ?? []).flatMap((g) => g.deposits.filter((d) => !d.opening && monthOf(d.date) === period).map((d) => d.amount)),
  );
  return {
    period,
    spent: t.spent,
    income: incomeIn(data, period),
    saving: t.saving,
    vsPrev: prev > 0 ? Math.round(((t.spent - prev) / prev) * 100) : null,
    top: byCat.slice(0, 3).map(([categoryId, amount]) => ({ categoryId, amount, pct: t.spent ? Math.round((amount / t.spent) * 100) : 0 })),
    count: txs.length,
    biggest: [...txs].sort((a, b) => b.amount - a.amount)[0],
    noSpendDays: Math.max(0, totalDays - spendDays.size),
    totalDays,
    budget: { kept: rows.filter((r) => r.spent <= r.limit).length, total: rows.length },
    goalsSaved,
  };
}

/* ---------- Lịch tiền ---------- */

export type MoneyEvent = {
  date: ISODate;
  kind: 'salary' | 'card' | 'recurring' | 'income' | 'goal';
  title: string;
  amount?: number;
  /** true = tiền vào. */
  incoming?: boolean;
};

/** Các mốc tiền trong tháng dương lịch `month` ('YYYY-MM'): lương, hạn trả thẻ, khoản định kỳ, hạn mục tiêu. */
export function moneyEvents(data: AppData, month: PeriodKey, labels: { salary: string; card: string }): MoneyEvent[] {
  const s = data.settings;
  const [y, m] = parsePeriod(month);
  const last = new Date(y, m, 0).getDate();
  const day = (d: number) => `${month}-${String(Math.min(d, last)).padStart(2, '0')}`;
  const out: MoneyEvent[] = [];

  const salaryTx = data.recurring?.find((r) => r.kind === 'income' && !r.paused);
  // Chưa có khoản lương định kỳ thì lấy lương trong Ngân sách.
  out.push({ date: day(s.salaryDay), kind: 'salary', title: labels.salary, amount: salaryTx?.amount ?? (budgetRoom(data, month).income || undefined), incoming: true });

  // Kỳ thẻ có hạn trả rơi vào tháng này (mỗi thẻ theo ngày riêng).
  const cards = data.accounts.filter((a) => a.kind === 'credit');
  for (const a of cards) {
    for (const p of [shiftPeriod(month, -1), month, shiftPeriod(month, 1)]) {
      const due = periodInfo(p, cardSettings(data, a.id)).due;
      if (due.startsWith(month))
        out.push({ date: due, kind: 'card', title: cards.length > 1 ? `${labels.card} · ${a.name}` : labels.card, amount: Math.max(0, statement(data, p, a.id).total - statementPaid(data, p, a.id)) });
    }
  }

  for (const r of data.recurring ?? []) {
    if (r.paused || (r.kind === 'income' && r === salaryTx)) continue;
    // Khoản định kỳ quẹt thẻ đã nằm trong số trả thẻ: không tính lần nữa.
    if (r.kind !== 'income' && data.accounts.find((a) => a.id === r.accountId)?.kind === 'credit') continue;
    const d = day(r.day);
    if (d < r.startDate) continue;
    out.push({ date: d, kind: r.kind === 'income' ? 'income' : 'recurring', title: r.merchant, amount: r.amount, incoming: r.kind === 'income' });
  }

  for (const g of data.goals ?? []) if (g.deadline?.startsWith(month)) out.push({ date: g.deadline, kind: 'goal', title: g.name, amount: goalStatus(g, g.deadline).left || undefined });

  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** Mốc sắp tới gần nhất tính từ hôm nay (xem 2 tháng). */
export function nextEvent(data: AppData, today: ISODate, labels: { salary: string; card: string }): MoneyEvent | undefined {
  const month = today.slice(0, 7);
  // Hạn thẻ đã trả đủ (còn 0đ) thì bỏ qua, nhắc việc kế tiếp.
  return [...moneyEvents(data, month, labels), ...moneyEvents(data, shiftPeriod(month, 1), labels)].find((e) => e.date >= today && !(e.kind === 'card' && !e.amount));
}
