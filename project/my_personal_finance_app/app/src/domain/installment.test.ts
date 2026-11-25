import { describe, expect, it } from 'vitest';
import { starterData } from '../data/starter';
import { installmentMatch, moneyEvents } from './insights';
import { insights } from './report';
import type { AppData } from './types';

const LABELS = { salary: 'Nhận lương', card: 'Hạn trả thẻ' };

/** Hai thẻ có hạn trả khác nhau; một khoản góp điện thoại 1tr/tháng trên thẻ A. */
const base = () => {
  const d = { ...starterData(), setupPending: undefined } as AppData;
  d.accounts = [
    { id: 'a', name: 'Thẻ A', kind: 'credit', cutoffDay: 8, dueDay: 25 },
    { id: 'b', name: 'Thẻ B', kind: 'credit', cutoffDay: 20, dueDay: 10 },
    { id: 'cash', name: 'Ví', kind: 'cash' },
  ];
  d.categories = [...d.categories, { id: 'inst-i', name: 'Góp Điện thoại', icon: '', kind: 'installment' }];
  d.budgets = [{ period: '2026-11', income: 21_000_000, lines: [] }];
  d.installments = [{ id: 'i', name: 'Điện thoại', accountId: 'a', categoryId: 'inst-i', monthly: 1_000_000, firstPeriod: '2026-10', months: 3 }];
  d.transactions = [];
  return d;
};

describe('ghi trùng trả góp', () => {
  it('trùng số tiền hoặc tên khoản đang chạy thì báo', () => {
    const d = base();
    expect(installmentMatch(d, 'Tiền gì đó', 1_000_000, '2026-11-02')?.id).toBe('i');
    expect(installmentMatch(d, 'Góp điện thoại tháng 11', 900_000, '2026-11-02')?.id).toBe('i');
  });
  it('khoản khác, hoặc khoản góp đã hết kỳ thì không báo', () => {
    const d = base();
    expect(installmentMatch(d, 'Cơm', 50_000, '2026-11-02')).toBeUndefined();
    expect(installmentMatch(d, 'Điện thoại', 1_000_000, '2027-02-02')).toBeUndefined();
  });
});

describe('lịch tiền', () => {
  it('mỗi thẻ một ngày hạn riêng, tính cả trả góp của đúng thẻ đó', () => {
    const cards = moneyEvents(base(), '2026-11', LABELS).filter((e) => e.kind === 'card');
    expect(cards.map((e) => [e.date, e.title, e.amount])).toEqual([
      ['2026-11-10', 'Hạn trả thẻ · Thẻ B', 0],
      ['2026-11-25', 'Hạn trả thẻ · Thẻ A', 1_000_000],
    ]);
  });
  it('lương lấy từ Ngân sách khi chưa có khoản lương định kỳ', () => {
    expect(moneyEvents(base(), '2026-11', LABELS).find((e) => e.kind === 'salary')?.amount).toBe(21_000_000);
  });
});

describe('báo cáo', () => {
  it('không báo "tăng" cho trả góp', () => {
    const d = base();
    d.installments[0].firstPeriod = '2026-11';
    expect(insights(d, '2026-11').filter((n) => n.kind === 'up')).toEqual([]);
  });
});
