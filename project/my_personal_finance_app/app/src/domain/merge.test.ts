/** TASK-0003: gộp trả góp, phí một lần, nhắc thẻ đã trả, ngân sách lố. */
import { describe, expect, it } from 'vitest';
import { starterData } from '../data/starter';
import { budgetReport, mergeInstallment, statement } from './calc';
import { budgetRoom, fitBudget } from './coach';
import { nextEvent } from './insights';
import type { AppData, Transaction } from './types';

const tx = (id: string, date: string, amount: number, myShare = amount): Transaction => ({
  id,
  date,
  merchant: id,
  amount,
  myShare,
  categoryId: 'food',
  accountId: 'card',
  reimbursed: 0,
  splits: myShare !== amount ? [{ person: 'p1', amount: amount - myShare, paid: 0 }] : undefined,
});

function base(): AppData {
  const d = { ...starterData(), setupPending: undefined };
  d.accounts = [
    { id: 'bank', name: 'Bank', kind: 'bank' },
    { id: 'card', name: 'Thẻ', kind: 'credit', cutoffDay: 25, dueDay: 10 },
  ];
  d.categories = [...d.categories, { id: 'inst-m', name: 'Góp', icon: '', kind: 'installment' }];
  d.transactions = [tx('a', '2026-11-03', 3_000_000), tx('b', '2026-11-20', 6_000_000, 3_000_000), tx('c', '2026-11-26', 3_000_000)];
  return d;
}

describe('gộp nhiều khoản thành một trả góp', () => {
  it('một khoản, phí một lần vào kỳ đầu = kỳ của khoản muộn nhất', () => {
    const d = base();
    const r = mergeInstallment(d, d.transactions, { id: 'm', categoryId: 'inst-m', name: 'Gộp', months: 6, fee: 300_000 });
    expect(r.item).toMatchObject({ principal: 12_000_000, monthly: 2_000_000, firstPeriod: '2026-12', fee: 300_000 });
    // Phần mình 9tr / 12tr.
    expect(r.item.share).toBe(0.75);
    expect(r.txs.every((t) => t.installmentId === 'm')).toBe(true);
    d.installments = [r.item];
    d.transactions = r.txs;
    // Sao kê: khoản gốc không tính nữa; kỳ đầu = 1 kỳ góp + phí, kỳ sau chỉ kỳ góp.
    expect(statement(d, '2026-11', 'card').total).toBe(0);
    expect(statement(d, '2026-12', 'card').total).toBe(2_300_000);
    expect(statement(d, '2027-01', 'card').total).toBe(2_000_000);
    // Ngân sách: phần mình 75%.
    expect(budgetReport(d, '2027-01').installments).toBe(1_500_000);
  });
});

describe('ngân sách lố', () => {
  it('giảm đều các mục ăn tiêu cho vừa phần còn lại', () => {
    const d = base();
    d.transactions = [];
    d.installments = [{ id: 'i', name: 'Góp', accountId: 'card', categoryId: 'inst-m', monthly: 2_000_000, firstPeriod: '2026-11', months: 6 }];
    const spend = d.categories.filter((c) => c.kind === 'spend').slice(0, 2).map((c) => c.id);
    const fixed = d.categories.find((c) => c.kind === 'fixed')!.id;
    d.budgets = [
      {
        period: '2026-11',
        income: 10_000_000,
        lines: [
          { categoryId: fixed, limit: 5_000_000 },
          { categoryId: spend[0], limit: 3_000_000 },
          { categoryId: spend[1], limit: 1_000_000 },
        ],
      },
    ];
    // Còn được tiêu 10 − 5 − 2 = 3tr, đang đặt 4tr → lố 1tr.
    expect(budgetRoom(d, '2026-11').over).toBe(1_000_000);
    const fit = fitBudget(d, '2026-11')!;
    expect(fit.changes).toEqual([
      { categoryId: spend[0], from: 3_000_000, to: 2_250_000 },
      { categoryId: spend[1], from: 1_000_000, to: 750_000 },
    ]);
    d.budgets = [fit.budget];
    expect(budgetRoom(d, '2026-11').over).toBe(0);
    expect(fitBudget(d, '2026-11')).toBeUndefined();
  });
});

describe('Sắp tới', () => {
  it('hạn thẻ đã trả đủ thì bỏ qua', () => {
    const d = base();
    d.transactions = [tx('a', '2026-10-20', 1_000_000)];
    const labels = { salary: 'Lương', card: 'Trả thẻ' };
    // Hạn kỳ 10 = 10/11.
    expect(nextEvent(d, '2026-11-08', labels)).toMatchObject({ kind: 'card', amount: 1_000_000 });
    d.transactions.push({ id: 'pay', date: '2026-11-05', merchant: 'Trả thẻ', amount: 1_000_000, myShare: 0, categoryId: '', accountId: 'bank', toAccountId: 'card', kind: 'transfer', reimbursed: 0 });
    expect(nextEvent(d, '2026-11-08', labels)?.kind).not.toBe('card');
  });
});
