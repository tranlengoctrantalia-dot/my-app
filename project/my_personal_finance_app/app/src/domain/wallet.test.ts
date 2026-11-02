import { describe, expect, it } from 'vitest';
import { starterData } from '../data/starter';
import { accountBalance, adjustFor, cashCheck, netWorth, recurringDue, recurringNext, spentByCategory, statement } from './calc';
import type { AppData, Recurring, Transaction } from './types';

const tx = (p: Partial<Transaction> & Pick<Transaction, 'date' | 'amount' | 'accountId'>): Transaction => ({
  id: Math.random().toString(36),
  merchant: 'x',
  categoryId: 'food',
  myShare: p.amount,
  reimbursed: 0,
  ...p,
});

function base(): AppData {
  const d = { ...starterData(), setupPending: undefined };
  d.transactions = [
    tx({ date: '2026-10-01', amount: 15_000_000, accountId: 'bank', kind: 'income', categoryId: 'salary' }),
    tx({ date: '2026-10-03', amount: 200_000, accountId: 'card' }),
    tx({ date: '2026-10-04', amount: 50_000, accountId: 'momo' }),
    // Nạp Momo từ tài khoản, trả nợ thẻ từ tài khoản: chỉ là chuyển tiền
    tx({ date: '2026-10-05', amount: 500_000, accountId: 'bank', kind: 'transfer', toAccountId: 'momo', categoryId: '' }),
    tx({ date: '2026-10-06', amount: 200_000, accountId: 'bank', kind: 'transfer', toAccountId: 'card', categoryId: '' }),
  ];
  return d;
}

describe('số dư từng nguồn', () => {
  it('nhập số dư hiện tại rồi tiền vào / ra cập nhật đúng; chuyển tiền không tính là chi', () => {
    const d = base();
    const today = '2026-10-10';
    // Người dùng nhập: tài khoản đang có 10 triệu, Momo 450k, thẻ hết nợ.
    d.accounts = d.accounts.map((a) =>
      a.id === 'bank'
        ? { ...a, balanceAdjust: adjustFor(d, 'bank', 10_000_000, today) }
        : a.id === 'momo'
          ? { ...a, balanceAdjust: adjustFor(d, 'momo', 450_000, today) }
          : a.id === 'card'
            ? { ...a, balanceAdjust: adjustFor(d, 'card', 0, today) }
            : a,
    );
    expect(accountBalance(d, 'bank', today)).toBe(10_000_000);
    // Sau đó: quẹt thẻ 300k, chuyển 300k từ tài khoản trả thẻ, tiêu Momo 100k.
    d.transactions.push(
      tx({ date: '2026-10-12', amount: 300_000, accountId: 'card' }),
      tx({ date: '2026-10-13', amount: 300_000, accountId: 'bank', kind: 'transfer', toAccountId: 'card', categoryId: '' }),
      tx({ date: '2026-10-14', amount: 100_000, accountId: 'momo' }),
    );
    const later = '2026-10-20';
    expect(accountBalance(d, 'bank', later)).toBe(9_700_000);
    expect(accountBalance(d, 'card', later)).toBe(0);
    expect(accountBalance(d, 'momo', later)).toBe(350_000);
    const nw = netWorth(d, later);
    expect(nw.total).toBe(10_050_000);
    // Chuyển tiền không vào chi tiêu, không vào sao kê thẻ.
    expect(spentByCategory(d, '2026-10').get('')).toBeUndefined();
    expect(statement(d, '2026-10').total).toBe(200_000);
    // Đã nhập số dư → kiểm tra trả thẻ dùng tổng số dư thật.
    expect(cashCheck(d, '2026-10').cashOnHand).toBe(10_050_000);
  });
});

describe('khoản định kỳ', () => {
  const r: Recurring = { id: 'r', merchant: 'Tiền nhà', amount: 3_000_000, categoryId: 'bills', accountId: 'bank', day: 31, startDate: '2026-08-31' };
  it('tới ngày mới ghi; tháng ngắn lấy ngày cuối tháng; không ghi lại lần đã ghi', () => {
    expect(recurringDue(r, '2026-10-21')).toEqual(['2026-08-31', '2026-09-30']);
    expect(recurringDue({ ...r, lastDate: '2026-09-30' }, '2026-10-31')).toEqual(['2026-10-31']);
    expect(recurringDue({ ...r, paused: true }, '2026-10-31')).toEqual([]);
    expect(recurringNext({ ...r, lastDate: '2026-09-30' }, '2026-10-21')).toBe('2026-10-31');
  });
});
