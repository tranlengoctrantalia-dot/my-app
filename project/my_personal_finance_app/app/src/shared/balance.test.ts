import { describe, expect, it } from 'vitest';
import { balances, settlements, splitEqually, totals, type SharedEntry } from './balance';

const e = (paidBy: string, amount: number, shares: Record<string, number>, kind: SharedEntry['kind'] = 'expense'): SharedEntry => ({
  id: Math.random().toString(36),
  kind,
  date: '2026-10-21',
  title: '',
  amount,
  paidBy,
  shares,
  createdBy: paidBy,
  createdAt: 0,
});

describe('sổ chung', () => {
  it('chia đều không lệch đồng nào', () => {
    const s = splitEqually(100000, ['a', 'b', 'c']);
    expect(Object.values(s).reduce((x, y) => x + y, 0)).toBe(100000);
    expect(s).toEqual({ a: 33334, b: 33333, c: 33333 });
  });

  it('tính số dư, gợi ý chuyển khoản, trả xong thì hết nợ', () => {
    const entries = [
      e('a', 300000, splitEqually(300000, ['a', 'b', 'c'])), // a trả tiền ăn 3 người
      e('b', 90000, { a: 30000, b: 30000, c: 30000 }), // b trả cà phê
    ];
    const b = balances(entries, ['a', 'b', 'c']);
    expect(b).toEqual({ a: 170000, b: -40000, c: -130000 });
    expect(settlements(b)).toEqual([
      { from: 'c', to: 'a', amount: 130000 },
      { from: 'b', to: 'a', amount: 40000 },
    ]);
    entries.push(e('c', 130000, { a: 130000 }, 'settle'), e('b', 40000, { a: 40000 }, 'settle'));
    expect(settlements(balances(entries, ['a', 'b', 'c']))).toEqual([]);
    expect(totals(entries, 'b')).toEqual({ group: 390000, mine: 130000 });
  });
});
