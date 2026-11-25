/**
 * Đối chiếu sao kê thẻ: so các dòng đọc được từ sao kê ngân hàng với các khoản đã ghi trên thẻ đó.
 * Ra 4 nhóm: khớp, thiếu (sao kê có, app chưa ghi), thừa (app có, sao kê không có — ghi trùng / nhầm thẻ), lệch số tiền.
 */
import { fold } from '../ai/redact';
import { isSpending } from './calc';
import type { AppData, ISODate, Transaction } from './types';

/** Một dòng trên sao kê. amount: dương = chi, âm = hoàn tiền. */
export interface StatementLine {
  date: ISODate;
  merchant: string;
  amount: number;
}

export interface Reconciled {
  matched: { line: StatementLine; tx: Transaction }[];
  missing: StatementLine[];
  extra: { tx: Transaction; dup: boolean }[];
  mismatched: { line: StatementLine; tx: Transaction }[];
}

/** Lệch ngày tối đa giữa ngày giao dịch trên sao kê và ngày đã ghi (ngân hàng hay ghi ngày hạch toán trễ 1–3 ngày). */
const DAY_SLACK = 3;

const days = (a: ISODate, b: ISODate) => Math.abs(Date.parse(a) - Date.parse(b)) / 86_400_000;
const shift = (d: ISODate, n: number) => new Date(Date.parse(d) + n * 86_400_000).toISOString().slice(0, 10);

/** Hai tên nơi chi có chung một từ "có nghĩa" (≥ 3 chữ, bỏ dấu) không. */
function sameMerchant(a: string, b: string) {
  const words = (s: string) => new Set(fold(s).split(/[^a-z0-9]+/).filter((w) => w.length >= 3));
  const wa = words(a);
  return [...words(b)].some((w) => wa.has(w));
}

/**
 * `range`: kỳ sao kê (theo ngày chốt). Khoản trong app ngoài kỳ không bị báo thừa (kỳ trước đã trả / kỳ sau chưa chốt),
 * nhưng vẫn được ghép khớp nếu ngân hàng ghi lệch ngày.
 */
export function reconcile(data: AppData, accountId: string, lines: StatementLine[], range?: { start: ISODate; end: ISODate }): Reconciled {
  if (!lines.length) return { matched: [], missing: [], extra: [], mismatched: [] };
  const dates = lines.map((l) => l.date).sort();
  const from = shift(dates[0], -DAY_SLACK);
  const to = shift(dates[dates.length - 1], DAY_SLACK);
  const txs = data.transactions.filter((t) => t.accountId === accountId && isSpending(t) && t.date >= from && t.date <= to);

  const used = new Set<string>();
  const matched: Reconciled['matched'] = [];
  const left: StatementLine[] = [];
  // Lượt 1: đúng số tiền, ngày gần nhất.
  for (const line of [...lines].sort((a, b) => a.date.localeCompare(b.date))) {
    const best = txs
      .filter((t) => !used.has(t.id) && t.amount === line.amount && days(t.date, line.date) <= DAY_SLACK)
      .sort((a, b) => days(a.date, line.date) - days(b.date, line.date))[0];
    if (best) {
      used.add(best.id);
      matched.push({ line, tx: best });
    } else left.push(line);
  }
  // Lượt 2: cùng nơi chi, ngày gần → ghi lệch số tiền.
  const mismatched: Reconciled['mismatched'] = [];
  const missing: StatementLine[] = [];
  for (const line of left) {
    const near = txs.find((t) => !used.has(t.id) && days(t.date, line.date) <= DAY_SLACK && sameMerchant(t.merchant, line.merchant));
    if (near) {
      used.add(near.id);
      mismatched.push({ line, tx: near });
    } else missing.push(line);
  }
  // Khoản đã huỷ mà sao kê có dòng hoàn đúng số tiền: cặp trừ + hoàn coi là khớp.
  for (const tx of txs.filter((t) => t.cancelled)) {
    const i = missing.findIndex((l) => l.amount === -tx.amount && l.date >= shift(tx.date, -DAY_SLACK));
    if (i >= 0) matched.push({ line: missing.splice(i, 1)[0], tx });
  }
  // Còn lại trong app: thừa (khoản đã huỷ thì không). Có khoản khớp cùng số tiền, gần ngày → nhiều khả năng ghi trùng.
  const extra = txs
    .filter((t) => !used.has(t.id) && !t.cancelled && (!range || (t.date >= range.start && t.date <= range.end)))
    .map((tx) => ({ tx, dup: matched.some((m) => m.tx.amount === tx.amount && days(m.tx.date, tx.date) <= DAY_SLACK) }));
  return { matched, missing, extra, mismatched };
}
