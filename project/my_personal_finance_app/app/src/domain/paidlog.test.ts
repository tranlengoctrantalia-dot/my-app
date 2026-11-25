/** TASK-0002: tiền người khác trả lại cộng vào ví theo ngày nhận, kể cả với khoản ghi trước mốc số dư. */
import { describe, expect, it } from 'vitest';
import { starterData } from '../data/starter';
import { accountBalance, balanceAnchor, staleAnchor } from './calc';
import { payOldestFirst, receiptsOf, setPaid, undoReceipt } from './split';
import type { AppData, Transaction } from './types';

const loan = (p: Partial<Transaction> = {}): Transaction => ({
  id: 'loan',
  date: '2026-10-30',
  merchant: 'Cho bạn vay',
  amount: 6_000_000,
  myShare: 0,
  categoryId: 'lend',
  accountId: 'card',
  kind: 'lend',
  reimbursed: 0,
  splits: [{ person: 'p1', amount: 6_000_000, paid: 0 }],
  ...p,
});

function base(t: Transaction, anchor: NonNullable<AppData['accounts'][number]['balanceAt']>): AppData {
  const d = { ...starterData(), setupPending: undefined };
  // Chỉ một ví thường (Momo): tiền trả lại khoản quẹt thẻ về đây.
  d.accounts = [
    { id: 'momo', name: 'Momo', kind: 'ewallet', balanceAdjust: 0, balanceAt: anchor },
    { id: 'card', name: 'Thẻ', kind: 'credit' },
  ];
  d.transactions = [t];
  return d;
}

const repay = (t: Transaction, date: string, ts: number, amount = t.splits![0].amount): Transaction => ({
  ...t,
  splits: [setPaid(t.splits![0], amount, date, ts)],
});

describe('tiền trả lại có ngày nhận', () => {
  it('mốc bản cũ (không lưu paid): trả sau mốc vẫn cộng vào ví', () => {
    const t = repay(loan(), '2026-11-08', 2);
    const d = base(t, { date: '2026-11-02', amount: 1_000_000, seen: [] });
    expect(accountBalance(d, 'momo', '2026-11-10')).toBe(7_000_000);
  });

  it('chưa tới ngày nhận thì chưa cộng', () => {
    const t = repay(loan(), '2026-11-08', 2);
    const d = base(t, { date: '2026-11-02', amount: 1_000_000, seen: [] });
    expect(accountBalance(d, 'momo', '2026-11-05')).toBe(1_000_000);
  });

  it('mốc mới: trả trước lúc nhập số dư thì không cộng lần nữa, trả sau thì cộng', () => {
    const paidHalf = repay(loan(), '2026-11-02', 100, 3_000_000);
    const tmp = base(paidHalf, { date: '2026-11-01', amount: 0, seen: [] });
    const anchor = balanceAnchor(tmp, 'momo', 4_000_000, '2026-11-02', 200)!;
    expect(anchor.paid).toEqual({});
    // Cùng ngày nhưng ghi sau lúc nhập số dư: trả nốt 3tr.
    const full = { ...paidHalf, splits: [setPaid(paidHalf.splits![0], 6_000_000, '2026-11-02', 300)] };
    const d = base(full, anchor);
    expect(accountBalance(d, 'momo', '2026-11-02')).toBe(7_000_000);
  });

  it('sửa bớt số đã trả thì trừ lại khỏi ví', () => {
    let t = repay(loan(), '2026-11-05', 2);
    t = { ...t, splits: [setPaid(t.splits![0], 1_000_000, '2026-11-06', 3)] };
    const d = base(t, { date: '2026-11-02', amount: 0, seen: [], paid: {}, v: 3, ts: 1 });
    expect(accountBalance(d, 'momo', '2026-11-10')).toBe(1_000_000);
  });

  it('khoản bản cũ đã trả, chưa rõ ngày: mốc bản 2 vẫn tính như trước', () => {
    const t = loan({ splits: [{ person: 'p1', amount: 6_000_000, paid: 2_000_000 }] });
    const d = base(t, { date: '2026-11-02', amount: 1_000_000, seen: [], paid: { loan: 2_000_000 }, v: 2 });
    expect(accountBalance(d, 'momo', '2026-11-10')).toBe(1_000_000);
    // Trả thêm bằng bản mới → cộng phần thêm.
    const d2 = base({ ...t, splits: [setPaid(t.splits![0], 6_000_000, '2026-11-09', 5)] }, d.accounts[0].balanceAt!);
    expect(accountBalance(d2, 'momo', '2026-11-10')).toBe(5_000_000);
  });

  it('nhắc nhập lại số dư khi mốc bản cũ có khoản đã trả chưa rõ ngày', () => {
    const t = loan({ splits: [{ person: 'p1', amount: 6_000_000, paid: 6_000_000 }] });
    expect(staleAnchor(base(t, { date: '2026-11-02', amount: 0, seen: [] }), 'momo')).toBe(true);
    expect(staleAnchor(base(t, { date: '2026-11-02', amount: 0, seen: [], paid: {}, v: 3, ts: 1 }), 'momo')).toBe(false);
    expect(staleAnchor(base(loan(), { date: '2026-11-02', amount: 0, seen: [] }), 'momo')).toBe(false);
  });
});

describe('trả dư (TASK-0004)', () => {
  it('nợ tính đủ, phần dư vẫn cộng vào ví', () => {
    const t = repay(loan(), '2026-11-08', 2, 6_500_000);
    expect(t.splits![0].paid).toBe(6_000_000);
    const d = base(t, { date: '2026-11-02', amount: 1_000_000, seen: [] });
    expect(accountBalance(d, 'momo', '2026-11-10')).toBe(7_500_000);
  });

  it('sửa lại số đã nhận: chỉ ghi phần chênh, giảm dư thì trừ lại', () => {
    const t = repay(loan(), '2026-11-08', 2, 6_500_000);
    const again = { ...t, splits: [setPaid(t.splits![0], 6_200_000, '2026-11-09', 3)] };
    expect(again.splits![0].paid).toBe(6_000_000);
    const d = base(again, { date: '2026-11-02', amount: 1_000_000, seen: [] });
    expect(accountBalance(d, 'momo', '2026-11-10')).toBe(7_200_000);
    expect(setPaid(again.splits![0], 6_200_000, '2026-11-09', 4)).toBe(again.splits![0]);
  });
});

describe('nhận một cục (TASK-0005)', () => {
  const spend = (id: string, date: string, owe: number, paid = 0): Transaction => ({
    id, date, merchant: id, amount: owe * 2, myShare: owe, categoryId: 'food', accountId: 'card', reimbursed: 0,
    splits: [{ person: 'p1', amount: owe, paid }],
  });
  const txs = [spend('c', '2026-11-05', 1_000_000), spend('a', '2026-11-01', 1_000_000, 400_000), spend('b', '2026-11-03', 2_000_000)];

  it('trừ khoản cũ nhất trước, khoản cuối trả một phần', () => {
    const r = payOldestFirst(txs, 'p1', 2_000_000, '2026-11-10', 5);
    expect(r.txs.map((t) => [t.id, t.splits![0].paid])).toEqual([['a', 1_000_000], ['b', 1_400_000]]);
    expect(r.full).toBe(1);
    expect(r.partial).toMatchObject({ left: 600_000 });
    expect(r.extra).toBe(0);
  });

  it('trả dư: tất cả đủ, phần dư vẫn cộng vào ví', () => {
    const r = payOldestFirst(txs, 'p1', 4_000_000, '2026-11-10', 5);
    expect(r.full).toBe(3);
    expect(r.extra).toBe(400_000);
    const d = base(r.txs[0], { date: '2026-11-08', amount: 0, seen: r.txs.map((t) => t.id) });
    d.transactions = r.txs;
    expect(accountBalance(d, 'momo', '2026-11-10')).toBe(4_000_000);
  });
});

describe('nhận một cục với khoản ghi kiểu cũ (counterparty)', () => {
  it('khoản kiểu cũ vẫn được ghi đã trả', () => {
    const old: Transaction = { id: 'o', date: '2026-10-10', merchant: 'Shopee', amount: 500_000, myShare: 0, categoryId: 'food', accountId: 'card', reimbursed: 0, counterparty: 'p1' };
    const r = payOldestFirst([old], 'p1', 500_000, '2026-11-12', 5);
    expect(r.txs[0].splits).toEqual([{ person: 'p1', amount: 500_000, paid: 500_000, log: [{ date: '2026-11-12', amount: 500_000, ts: 5 }] }]);
  });
});

describe('lịch sử nhận tiền (TASK-0006)', () => {
  const spend = (id: string, date: string, owe: number): Transaction => ({
    id, date, merchant: id, amount: owe, myShare: 0, categoryId: 'food', accountId: 'card', reimbursed: 0, counterparty: 'p1',
  });
  it('gộp theo lần nhận, xoá thì các khoản và ví quay về như trước', () => {
    const txs = [spend('a', '2026-10-01', 1_000_000), spend('b', '2026-10-02', 2_000_000)];
    const r1 = payOldestFirst(txs, 'p1', 1_500_000, '2026-11-10', 10);
    const after1 = txs.map((t) => r1.txs.find((x) => x.id === t.id) ?? t);
    const r2 = payOldestFirst(after1, 'p1', 2_000_000, '2026-11-12', 20);
    const after2 = after1.map((t) => r2.txs.find((x) => x.id === t.id) ?? t);
    expect(receiptsOf(after2, 'p1').map((r) => [r.ts, r.total, r.items.length])).toEqual([[20, 2_000_000, 1], [10, 1_500_000, 2]]);
    const undone = undoReceipt(after2, 'p1', 20);
    const back = after2.map((t) => undone.find((x) => x.id === t.id) ?? t);
    expect(back.map((t) => t.splits![0].paid)).toEqual([1_000_000, 500_000]);
    const d = base(back[0], { date: '2026-11-01', amount: 0, seen: [] });
    d.transactions = back;
    expect(accountBalance(d, 'momo', '2026-11-12')).toBe(1_500_000);
  });
});
