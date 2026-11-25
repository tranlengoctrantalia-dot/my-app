/** TASK-0002: khoản quẹt thẻ có chia tiền chuyển thành trả góp. */
import { describe, expect, it } from 'vitest';
import { starterData } from '../data/starter';
import { accountBalance, budgetReport, receivables, spentByCategory, statement } from './calc';
import type { AppData } from './types';

function base(): AppData {
  const d = { ...starterData(), setupPending: undefined };
  d.accounts = [{ id: 'card', name: 'Thẻ', kind: 'credit', cutoffDay: 25, dueDay: 10, balanceAdjust: 0 }];
  d.categories = [...d.categories, { id: 'inst-1', name: 'Góp ĐT', icon: '', kind: 'installment' }];
  // Mua 12tr chia đôi với bạn, chuyển trả góp 12 kỳ: sao kê 1tr/kỳ, phần mình 500k/kỳ.
  d.transactions = [
    {
      id: 'buy',
      date: '2026-11-05',
      merchant: 'Điện thoại',
      amount: 12_000_000,
      myShare: 6_000_000,
      categoryId: 'food',
      accountId: 'card',
      reimbursed: 0,
      splits: [{ person: 'p1', amount: 6_000_000, paid: 0 }],
      installmentId: 'i1',
    },
  ];
  d.installments = [{ id: 'i1', name: 'Điện thoại', accountId: 'card', categoryId: 'inst-1', monthly: 1_000_000, firstPeriod: '2026-11', months: 12, principal: 12_000_000, share: 0.5 }];
  return d;
}

describe('trả góp có chia tiền', () => {
  it('sao kê tính đủ tiền góp, không tính khoản mua gốc', () => {
    expect(statement(base(), '2026-11', 'card').total).toBe(1_000_000);
  });

  it('ngân sách chỉ tính phần mình, không tính khoản mua gốc', () => {
    const d = base();
    const spent = spentByCategory(d, '2026-11');
    expect(spent.get('inst-1')).toBe(500_000);
    expect(spent.get('food')).toBeUndefined();
    expect(budgetReport(d, '2026-11').installments).toBe(500_000);
  });

  it('bạn vẫn còn nợ phần của bạn', () => {
    expect(receivables(base()).total).toBe(6_000_000);
  });

  it('nợ thẻ chỉ tăng theo từng kỳ góp đã chốt', () => {
    // Kỳ 11 chốt ngày 25/11: thẻ nợ 1 kỳ góp, không phải 12tr.
    expect(accountBalance(base(), 'card', '2026-11-26')).toBe(-1_000_000);
  });
});
