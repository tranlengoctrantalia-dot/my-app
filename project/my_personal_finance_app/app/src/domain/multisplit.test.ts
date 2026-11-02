import { describe, expect, it } from 'vitest';
import { starterData } from '../data/starter';
import { outstanding, receivables } from './calc';
import { inferSplit, splitByRatio, splitsOf } from './split';
import type { Transaction } from './types';

const base = { ...starterData(), setupPending: undefined };

describe('chia tiền với nhiều người', () => {
  it('chia đều 4 người (1:1 với 3 bạn), tiền lẻ dồn vào phần mình', () => {
    const r = splitByRatio(1_000_000, 1, 1, ['lan', 'minh', 'hoa']);
    expect(r.splits.map((x) => x.amount)).toEqual([250_000, 250_000, 250_000]);
    expect(r.myShare).toBe(250_000);
    const odd = splitByRatio(100_000, 1, 1, ['a', 'b']);
    expect(odd.myShare + odd.splits.reduce((a, x) => a + x.amount, 0)).toBe(100_000);
  });

  it('1:2 với 1 bạn giống cách cũ (khớp Excel); trả hộ = người khác trả hết', () => {
    expect(splitByRatio(1_723_760, 1, 2, ['partner']).myShare).toBe(574_587);
    expect(splitByRatio(300_000, 0, 1, ['a', 'b'])).toEqual({ myShare: 0, splits: [{ person: 'a', amount: 150_000, paid: 0 }, { person: 'b', amount: 150_000, paid: 0 }] });
  });

  it('ai nợ bao nhiêu, đã trả một phần; đọc được cả cách lưu cũ (1 người)', () => {
    const tx = (p: Partial<Transaction>): Transaction => ({ id: Math.random().toString(36), date: '2026-10-20', merchant: 'x', amount: 0, categoryId: 'food', accountId: 'cash', myShare: 0, reimbursed: 0, ...p });
    const data = {
      ...base,
      transactions: [
        tx({ amount: 900_000, myShare: 300_000, splits: [{ person: 'lan', amount: 300_000, paid: 100_000 }, { person: 'minh', amount: 300_000, paid: 300_000 }] }),
        tx({ amount: 200_000, myShare: 100_000, counterparty: 'lan', reimbursed: 0 }), // cách lưu cũ
      ],
    };
    expect(outstanding(data.transactions[0])).toBe(200_000);
    expect(splitsOf(data.transactions[1])).toEqual([{ person: 'lan', amount: 100_000, paid: 0 }]);
    const rec = receivables(data);
    expect(rec.total).toBe(300_000);
    expect(rec.byPerson).toEqual([{ id: 'lan', amount: 300_000, count: 2 }]);
  });

  it('mở lại form sửa: nhận ra chia đều hay tự nhập', () => {
    const s = base.settings;
    const t = (splits: Transaction['splits'], myShare: number): Transaction => ({ id: 'x', date: '2026-10-20', merchant: 'x', amount: 900_000, categoryId: 'food', accountId: 'cash', myShare, reimbursed: 0, splits });
    expect(inferSplit(t([{ person: 'a', amount: 300_000, paid: 0 }, { person: 'b', amount: 300_000, paid: 0 }], 300_000), s).mode).toBe('half');
    const custom = inferSplit(t([{ person: 'a', amount: 500_000, paid: 0 }, { person: 'b', amount: 100_000, paid: 0 }], 300_000), s);
    expect(custom.mode).toBe('custom');
    expect(custom.amounts).toEqual({ a: 500_000, b: 100_000 });
  });
});
