import { describe, expect, it } from 'vitest';
import { starterData } from '../data/starter';
import { buildPlan, check, type Plan } from './advice';
import { statement } from './calc';
import type { AppData } from './types';

/**
 * Hôm nay 02/11, lương 10tr về 07/11, ví 2tr.
 * Shinhan (ngày chung: chốt 8, hạn 25): 4tr. VP (riêng: chốt 15, hạn 10 tháng sau): 3tr, hạn 10/11.
 * Kế hoạch tháng 11: gửi mẹ 5tr, tiết kiệm 2tr, ăn uống 3tr.
 */
const base = () => {
  const d = { ...starterData(), setupPending: undefined } as AppData;
  d.settings = { ...d.settings, cutoffDay: 8, dueDay: 25, salaryDay: 7, cashOnHand: 2_000_000, savingsFund: 5_000_000 };
  d.accounts = [
    { id: 'shb', name: 'Shinhan', kind: 'credit' },
    { id: 'vp', name: 'VP', kind: 'credit', cutoffDay: 15, dueDay: 10 },
  ];
  d.budgets = [
    {
      period: '2026-11',
      income: 10_000_000,
      lines: [
        { categoryId: 'family', limit: 5_000_000 },
        { categoryId: 'saving', limit: 2_000_000 },
        { categoryId: 'food', limit: 3_000_000 },
      ],
    },
  ];
  d.transactions = [
    { id: 'v', date: '2026-10-10', merchant: 'x', amount: 3_000_000, myShare: 3_000_000, categoryId: 'shopping', accountId: 'vp', reimbursed: 0 },
    { id: 's', date: '2026-11-01', merchant: 'y', amount: 4_000_000, myShare: 4_000_000, categoryId: 'shopping', accountId: 'shb', reimbursed: 0 },
  ];
  return d;
};
const today = '2026-11-02';

describe('ngày chốt / hạn trả riêng từng thẻ', () => {
  it('VP chốt 15 → quẹt 10/10 vào kỳ trả 10/11; Shinhan vẫn theo ngày chung', () => {
    const d = base();
    expect(statement(d, '2026-10', 'vp').total).toBe(3_000_000);
    expect(statement(d, '2026-11', 'shb').total).toBe(4_000_000);
    expect(buildPlan(d, today).cards.map((c) => [c.name, c.due, c.amount])).toEqual([
      ['VP', '2026-11-10', 3_000_000],
      ['Shinhan', '2026-11-25', 4_000_000],
    ]);
  });
});

describe('khả năng thanh toán (tiền có − tiền phải trả)', () => {
  // Số của chủ app tháng 11: ví 1.715.536, lương 21tr, người yêu + bạn bè trả lại 12.646.085,
  // gửi mẹ 12tr, tiết kiệm 3,5tr, góp quỹ 0,5tr, gym 0,5tr, VP 6.666.666 (10/11), Shinhan 14.105.435 (25/11).
  const plan: Plan = {
    today: '2026-11-02',
    month: '2026-11',
    monthEnd: '2026-11-30',
    days: 29,
    flexPerDay: 0,
    flexOver: 0,
    cash: 1_715_536,
    salary: { date: '2026-11-07', amount: 21_000_000 },
    fixed: [
      { categoryId: 'family', amount: 12_000_000, saving: false },
      { categoryId: 'saving', amount: 3_500_000, saving: true },
      { categoryId: 'fund', amount: 500_000, saving: false },
      { categoryId: 'gym', amount: 500_000, saving: false },
    ],
    cards: [
      { id: 'vp', name: 'VP', period: '2026-10', due: '2026-11-10', amount: 6_666_666 },
      { id: 'shb', name: 'Shinhan', period: '2026-11', due: '2026-11-25', amount: 14_105_435 },
    ],
    incoming: [
      { person: 'friends', amount: 6_666_666, date: '2026-11-10', promised: false, late: false },
      { person: 'partner', amount: 4_085_320, date: '2026-11-25', promised: false, late: false },
      { person: 'friends', amount: 36_099, date: '2026-11-25', promised: false, late: false },
      { person: 'friends', amount: 1_458_000, date: '2026-11-30', promised: false, late: false },
      { person: 'partner', amount: 400_000, date: '2026-11-30', promised: false, late: false },
    ],
  };
  it('không tiêu thêm: thiếu 1.910.480; chưa bỏ tiết kiệm thì dư 1.589.520', () => {
    const r = check(plan, 0);
    expect(r).toMatchObject({ have: 35_361_621, pay: 37_272_101, left: -1_910_480, leftNoSaving: 1_589_520 });
    // Dư 1.589.520 chia 29 ngày ≈ 54k/ngày.
    expect(r).toMatchObject({ maxPerDay: 0, maxPerDayNoSaving: 54_000 });
    // Tiền trả lại qua ví (1.858.000) tới 30/11 → đúng 25/11 hụt 268.480 dù chưa bỏ tiết kiệm.
    expect(r.dip).toEqual({ date: '2026-11-25', amount: 268_480, card: 'Shinhan' });
  });
  it('ăn thêm 50k/ngày: 29 ngày = 1.450.000 tính vào tiền phải trả', () => {
    const r = check(plan, 50_000);
    expect(r).toMatchObject({ spend: 1_450_000, left: -3_360_480, leftNoSaving: 139_520 });
  });
  it('bạn bè trả cho hóa đơn VP tháng 12 thì không cộng vào tháng 11 (VP cũng không nằm trong tiền phải trả)', () => {
    const next = {
      ...plan,
      cards: plan.cards.filter((c) => c.id !== 'vp'),
      incoming: plan.incoming.map((i, n) => (n === 0 ? { ...i, date: '2026-12-10' } : i)),
    };
    // Trước đây ra "dư 4.756.186" vì cộng 6,67tr bạn bè trả mà không trừ thẻ VP.
    expect(check(next, 0).left).toBe(-1_910_480);
  });
  it('người trễ hẹn không tính vào tiền có', () => {
    const late = { ...plan, incoming: plan.incoming.map((i) => (i.person === 'partner' ? { ...i, late: true } : i)) };
    expect(check(late, 0).have).toBe(35_361_621 - 4_485_320);
  });
});
