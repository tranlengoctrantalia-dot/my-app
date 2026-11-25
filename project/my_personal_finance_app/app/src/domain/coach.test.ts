import { describe, expect, it } from 'vitest';
import { starterData } from '../data/starter';
import { budgetImpact, budgetRoom, bufferSuggest, nextMonths } from './coach';
import { accountBalance, budgetReport, cashCheck, spentByCategory } from './calc';
import { reconcile } from './reconcile';
import type { AppData } from './types';

/** Ngân sách tháng 11: lương 21tr; cố định gửi mẹ 12tr + tiết kiệm 3,5tr; chi linh hoạt ăn uống 3tr + mua sắm 2tr. */
const base = () => {
  const d = { ...starterData(), setupPending: undefined } as AppData;
  d.accounts = [{ id: 'cash', name: 'Ví', kind: 'cash' }];
  d.budgets = [
    {
      period: '2026-11',
      income: 21_000_000,
      lines: [
        { categoryId: 'family', limit: 12_000_000 },
        { categoryId: 'saving', limit: 3_500_000 },
        { categoryId: 'food', limit: 3_000_000 },
        { categoryId: 'shopping', limit: 2_000_000 },
      ],
    },
  ];
  d.installments = [{ id: 'i', name: 'Điện thoại', accountId: 'cash', categoryId: 'inst-i', monthly: 1_000_000, firstPeriod: '2026-10', months: 3 }];
  d.transactions = [{ id: 'a', date: '2026-11-02', merchant: 'Cơm', amount: 500_000, myShare: 500_000, categoryId: 'food', accountId: 'cash', reimbursed: 0 }];
  return d;
};

describe('ngân sách là gốc', () => {
  it('lương − cố định − trả góp = được chi linh hoạt; so với đang đặt', () => {
    // 21 − 15,5 − 1 = 4,5tr được chi; đang đặt 5tr → lố 0,5tr.
    expect(budgetRoom(base(), '2026-11')).toMatchObject({ room: 4_500_000, flexPlanned: 5_000_000, over: 500_000 });
  });
  it('"chưa chia" đã trừ trả góp, khớp với phần cân đối', () => {
    const d = base();
    // 21 − 20,5 (các dòng) − 1 (trả góp) = lố 0,5tr, không phải "chưa chia 0,5tr".
    expect(budgetReport(d, '2026-11').unallocated).toBe(-budgetRoom(d, '2026-11').over);
    expect(budgetReport(d, '2026-11').unallocated).toBe(-500_000);
    // Lương đủ: vừa khít thì không còn gì chưa chia.
    d.budgets[0].income = 21_500_000;
    expect(budgetReport(d, '2026-11').unallocated).toBe(0);
    // Có dòng ngân sách cho trả góp: không trừ 2 lần.
    d.categories = [...d.categories, { id: 'inst-i', name: 'Góp điện thoại', icon: '', kind: 'installment' }];
    d.budgets[0].lines = [...d.budgets[0].lines, { categoryId: 'inst-i', limit: 1_000_000 }];
    expect(budgetReport(d, '2026-11').unallocated).toBe(0);
  });
  it('3 tháng tới: chép ngân sách tháng này, hết trả góp thì được chi nhiều hơn', () => {
    expect(nextMonths(base(), '2026-11').map((m) => [m.month, m.room, m.copied])).toEqual([
      ['2026-12', 4_500_000, true],
      ['2027-01', 5_500_000, true],
      ['2027-02', 5_500_000, true],
    ]);
  });
  it('ghi khoản chi: danh mục còn bao nhiêu, chi linh hoạt cả tháng còn bao nhiêu', () => {
    // Ăn uống 3tr đã chi 0,5tr; thêm 1tr → còn 1,5tr. Chi linh hoạt 5tr đã chi 0,5tr → còn 3,5tr.
    expect(budgetImpact(base(), 'food', 1_000_000, '2026-11-03')).toMatchObject({ catLeft: 1_500_000, flexLeft: 3_500_000 });
    // Sửa khoản cũ 0,5tr thành 1tr: không trừ 2 lần.
    const d = base();
    expect(budgetImpact(d, 'food', 1_000_000, '2026-11-02', d.transactions[0])).toMatchObject({ catLeft: 2_000_000, flexLeft: 4_000_000 });
    // Tháng chưa đặt ngân sách: không báo.
    expect(budgetImpact(base(), 'food', 1_000_000, '2026-12-01')).toBeUndefined();
  });
  it('tiền đệm gợi ý = 1 tháng khoản cố định, gom 12 tháng', () => {
    expect(bufferSuggest(base(), '2026-11', '2026-11-03')).toEqual({ target: 15_500_000, deadline: '2027-11-03', monthly: 1_292_000 });
  });
  it('bỏ tiền vào Mục tiêu trong tháng = đã đóng dòng tiết kiệm (không bắt đóng lần nữa)', () => {
    const d = base();
    d.goals = [{ id: 'g', name: 'Du lịch', target: 10_000_000, deposits: [{ date: '2026-11-03', amount: 2_000_000 }] }];
    const row = budgetReport(d, '2026-11').rows.find((r) => r.categoryId === 'saving');
    expect(row).toMatchObject({ spent: 2_000_000, remaining: 1_500_000 });
  });
  it('tiền có từ trước bỏ vào Mục tiêu không tính là đã đóng tiết kiệm tháng này', () => {
    const d = base();
    d.goals = [
      {
        id: 'g',
        name: 'Tiền đệm',
        target: 13_500_000,
        deposits: [
          { date: '2026-11-12', amount: 10_000_000, opening: true },
          { date: '2026-11-15', amount: 500_000 },
        ],
      },
    ];
    const row = budgetReport(d, '2026-11').rows.find((r) => r.categoryId === 'saving');
    expect(row).toMatchObject({ spent: 500_000, remaining: 3_000_000 });
  });
  it('ăn tiêu mỗi ngày: mục lố trừ vào phần còn lại của mục khác', () => {
    const d = base();
    // Ăn uống 3tr đã tiêu 0,5tr; mua sắm 2tr lố thành 2,9tr → còn 5 − 3,4 = 1,6tr (không phải 2,5tr).
    d.transactions.push({ id: 'b', date: '2026-11-03', merchant: 'Áo', amount: 2_900_000, myShare: 2_900_000, categoryId: 'shopping', accountId: 'cash', reimbursed: 0 });
    expect(cashCheck(d, '2026-11', '2026-11-16')).toMatchObject({ daily: 1_600_000, flexOver: 0 });
    // Lố cả tổng: 0đ/ngày, báo lố bao nhiêu.
    d.transactions.push({ id: 'c', date: '2026-11-04', merchant: 'Giày', amount: 2_000_000, myShare: 2_000_000, categoryId: 'shopping', accountId: 'cash', reimbursed: 0 });
    expect(cashCheck(d, '2026-11', '2026-11-16')).toMatchObject({ daily: 0, flexOver: 400_000 });
  });
  it('khoản Đã huỷ không tính vào ngân sách, ví; đối chiếu sao kê coi cặp trừ + hoàn là khớp', () => {
    const d = base();
    d.accounts = [{ id: 'cash', name: 'Ví', kind: 'cash', balanceAdjust: 0 }];
    d.transactions.push({ id: 'x', date: '2026-11-05', merchant: 'Shopee', amount: 800_000, myShare: 800_000, categoryId: 'shopping', accountId: 'cash', reimbursed: 0, cancelled: true });
    expect(spentByCategory(d, '2026-11').get('shopping') ?? 0).toBe(0);
    expect(accountBalance(d, 'cash', '2026-11-16')).toBe(-500_000);
    const r = reconcile(d, 'cash', [
      { date: '2026-11-05', merchant: 'SHOPEE', amount: 800_000 },
      { date: '2026-11-09', merchant: 'SHOPEE HOAN TIEN', amount: -800_000 },
      { date: '2026-11-02', merchant: 'COM', amount: 500_000 },
    ] as never);
    expect(r.missing).toHaveLength(0);
    expect(r.extra).toHaveLength(0);
    expect(r.matched).toHaveLength(3);
  });
});
