import { describe, expect, it } from 'vitest';
import { starterData } from '../data/starter';
import { accountFlow, payables, receivables, spentByCategory, periodOf, spreadShare, statement } from './calc';

describe('tháng chi tiêu vs kỳ sao kê thẻ', () => {
  it('quẹt thẻ 20/10 (chốt ngày 8): ngân sách tính tháng 10, sao kê thẻ tính kỳ 11', () => {
    const d = { ...starterData(), setupPending: undefined } as AppData;
    d.settings = { ...d.settings, cutoffDay: 8, dueDay: 25 };
    d.accounts = [{ id: 'card', name: 'Thẻ', kind: 'credit' }];
    d.transactions = [{ id: 'a', date: '2026-10-20', merchant: 'x', amount: 100_000, myShare: 100_000, categoryId: 'food', accountId: 'card', reimbursed: 0 }];
    expect(spentByCategory(d, '2026-10').get('food')).toBe(100_000);
    expect(spentByCategory(d, '2026-11').get('food')).toBeUndefined();
    expect(statement(d, '2026-11').total).toBe(100_000);
    expect(statement(d, '2026-10').total).toBe(0);
  });
});

describe('đóng trước nhiều tháng', () => {
  it('500k cho 2 tháng → mỗi tháng 250k; 100k / 3 tháng: tháng cuối nhận phần lẻ', () => {
    const t = { myShare: 500_000, spreadMonths: 2 } as Transaction;
    expect([spreadShare(t, '2026-10', '2026-09'), spreadShare(t, '2026-10', '2026-10'), spreadShare(t, '2026-10', '2026-11'), spreadShare(t, '2026-10', '2026-12')]).toEqual([0, 250_000, 250_000, 0]);
    const u = { myShare: 100_000, spreadMonths: 3 } as Transaction;
    expect(['2026-12', '2027-01', '2027-02'].map((p) => spreadShare(u, '2026-12', p))).toEqual([33_333, 33_333, 33_334]);
  });
});
import type { AppData, Transaction } from './types';

const loan = (kind: 'lend' | 'borrow', person: string, amount: number, paid = 0): Transaction => ({
  id: Math.random().toString(36),
  date: '2026-10-10',
  merchant: 'x',
  amount,
  myShare: 0,
  categoryId: kind,
  accountId: 'bank',
  splits: [{ person, amount, paid }],
  reimbursed: 0,
  kind,
});

describe('vay / cho vay', () => {
  const d: AppData = { ...starterData(), setupPending: undefined };
  d.transactions = [loan('lend', 'lan', 2_000_000, 500_000), loan('borrow', 'me-ruot', 5_000_000, 1_000_000)];

  it('cho vay tính là người ta nợ mình, đi vay là mình nợ', () => {
    expect(receivables(d).total).toBe(1_500_000);
    expect(receivables(d).byPerson.map((p) => p.id)).toEqual(['lan']);
    expect(payables(d).total).toBe(4_000_000);
    expect(payables(d).byPerson[0].id).toBe('me-ruot');
  });
  it('cộng trừ vào số dư ví, kể cả tiền trả lại', () => {
    // cho vay 2tr (đã nhận lại 0,5tr) → −1,5tr; vay 5tr (đã trả 1tr) → +4tr
    expect(accountFlow(d, 'bank', '2026-10-26')).toBe(2_500_000);
  });
  it('không tính là chi tiêu', () => {
    const spent = spentByCategory(d, periodOf('2026-10-10', d.settings.cutoffDay));
    expect([...spent.values()].reduce((a, b) => a + b, 0)).toBe(0);
  });
});
