/**
 * Sổ chung: tính ai nợ ai. Mỗi khoản có người trả (paidBy) và phần của từng người (shares).
 * Trả nợ cũng là một khoản: người trả nợ "trả" cho người nhận, phần của người nhận = số tiền.
 */
export interface Member {
  name: string;
  email: string;
  photo?: string;
}

export interface Ledger {
  id: string;
  name: string;
  members: string[];
  people: Record<string, Member>;
  createdBy: string;
}

export interface SharedEntry {
  id: string;
  kind: 'expense' | 'settle';
  date: string;
  title: string;
  amount: number;
  paidBy: string;
  shares: Record<string, number>;
  createdBy: string;
  createdAt: number;
}

/** Số dư từng người: dương = được nhận lại, âm = đang nợ. */
export function balances(entries: SharedEntry[], members: string[]): Record<string, number> {
  const b: Record<string, number> = Object.fromEntries(members.map((m) => [m, 0]));
  for (const e of entries) {
    b[e.paidBy] = (b[e.paidBy] ?? 0) + e.amount;
    for (const [uid, share] of Object.entries(e.shares)) b[uid] = (b[uid] ?? 0) - share;
  }
  return b;
}

/** Gợi ý ít lần chuyển khoản nhất để hết nợ. */
export function settlements(b: Record<string, number>): { from: string; to: string; amount: number }[] {
  const debtors = Object.entries(b)
    .filter(([, v]) => v < 0)
    .map(([id, v]) => ({ id, v: -v }))
    .sort((x, y) => y.v - x.v);
  const creditors = Object.entries(b)
    .filter(([, v]) => v > 0)
    .map(([id, v]) => ({ id, v }))
    .sort((x, y) => y.v - x.v);
  const out: { from: string; to: string; amount: number }[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].v, creditors[j].v);
    if (amount >= 1) out.push({ from: debtors[i].id, to: creditors[j].id, amount: Math.round(amount) });
    debtors[i].v -= amount;
    creditors[j].v -= amount;
    if (debtors[i].v < 1) i++;
    if (creditors[j].v < 1) j++;
  }
  return out;
}

/** Chia đều, phần lẻ (vài đồng) dồn cho người đầu tiên để tổng luôn khớp. */
export function splitEqually(amount: number, people: string[]): Record<string, number> {
  if (!people.length) return {};
  const each = Math.floor(amount / people.length);
  const shares = Object.fromEntries(people.map((p) => [p, each]));
  shares[people[0]] += amount - each * people.length;
  return shares;
}

/** Tổng chi của cả nhóm và phần của một người (không tính các lần trả nợ). */
export function totals(entries: SharedEntry[], uid: string) {
  const spent = entries.filter((e) => e.kind === 'expense');
  return {
    group: spent.reduce((s, e) => s + e.amount, 0),
    mine: spent.reduce((s, e) => s + (e.shares[uid] ?? 0), 0),
  };
}
