import { describe, expect, it } from 'vitest';
import { starterData } from '../data/starter';
import { reconcile } from './reconcile';
import { moneyEvents, oddTransactions, planBudget, recap } from './insights';
import type { AppData, Transaction } from './types';

let n = 0;
const tx = (p: Partial<Transaction> & Pick<Transaction, 'date' | 'amount'>): Transaction => ({
  id: `t${n++}`,
  merchant: 'Shop',
  categoryId: 'food',
  accountId: 'card',
  myShare: p.amount,
  reimbursed: 0,
  ...p,
});

function base(txs: Transaction[]): AppData {
  const d = { ...starterData(), setupPending: undefined } as AppData;
  d.settings = { ...d.settings, cutoffDay: 31, dueDay: 15, salaryDay: 5 };
  d.accounts = [
    { id: 'card', name: 'Thẻ', kind: 'credit' },
    { id: 'bank', name: 'Ngân hàng', kind: 'bank' },
  ];
  d.transactions = txs;
  return d;
}

describe('đối chiếu sao kê', () => {
  it('ra khớp / thiếu / thừa (ghi trùng) / lệch số tiền', () => {
    const d = base([
      tx({ date: '2026-10-02', amount: 120_000, merchant: 'Grab' }),
      tx({ date: '2026-10-05', amount: 350_000, merchant: 'Shopee' }),
      tx({ date: '2026-10-05', amount: 350_000, merchant: 'Shopee' }), // ghi trùng
      tx({ date: '2026-10-09', amount: 80_000, merchant: 'Highlands Coffee' }), // sao kê 85k
      tx({ date: '2026-10-10', amount: 999_000, merchant: 'X', accountId: 'bank' }), // thẻ khác, bỏ qua
    ]);
    const r = reconcile(d, 'card', [
      { date: '2026-10-03', merchant: 'GRAB*VN', amount: 120_000 }, // lệch 1 ngày vẫn khớp
      { date: '2026-10-06', merchant: 'SHOPEE', amount: 350_000 },
      { date: '2026-10-09', merchant: 'HIGHLANDS COFFEE Q1', amount: 85_000 },
      { date: '2026-10-12', merchant: 'NETFLIX', amount: 260_000 },
    ]);
    expect(r.matched).toHaveLength(2);
    expect(r.missing.map((x) => x.merchant)).toEqual(['NETFLIX']);
    expect(r.mismatched.map((x) => [x.line.amount, x.tx.amount])).toEqual([[85_000, 80_000]]);
    expect(r.extra).toHaveLength(1);
    expect(r.extra[0].dup).toBe(true);
  });
});

describe('đối chiếu theo kỳ chốt', () => {
  it('khoản ngoài kỳ (kỳ trước đã trả, kỳ sau) không bị báo thừa; ghi lệch ngày qua chốt vẫn khớp', () => {
    const d = base([
      tx({ date: '2026-10-06', amount: 50_000, merchant: 'Kỳ trước' }),
      tx({ date: '2026-10-09', amount: 120_000, merchant: 'Grab' }),
      tx({ date: '2026-11-08', amount: 70_000, merchant: 'Lẻ trong kỳ' }),
      tx({ date: '2026-11-09', amount: 77_760, merchant: 'Kỳ sau' }),
      tx({ date: '2026-11-10', amount: 300_000, merchant: 'Shopee' }), // ngân hàng ghi 08/11
    ]);
    const r = reconcile(
      d,
      'card',
      [
        { date: '2026-10-09', merchant: 'GRAB', amount: 120_000 },
        { date: '2026-11-08', merchant: 'SHOPEE', amount: 300_000 },
      ],
      { start: '2026-10-09', end: '2026-11-08' },
    );
    expect(r.matched).toHaveLength(2);
    expect(r.extra.map((x) => x.tx.merchant)).toEqual(['Lẻ trong kỳ']);
  });
});

describe('khoản lạ', () => {
  it('bắt ghi trùng, gói tháng trừ 2 lần, khoản to bất thường', () => {
    const d = base([
      // 3 tháng trước: ăn uống ~100k, Netflix mỗi tháng 1 lần
      ...['07', '08', '09'].flatMap((m) => [
        tx({ date: `2026-${m}-03`, amount: 100_000 }),
        tx({ date: `2026-${m}-10`, amount: 90_000 }),
        tx({ date: `2026-${m}-12`, amount: 260_000, merchant: 'Netflix', categoryId: 'fun' }),
      ]),
      // tháng này
      tx({ date: '2026-10-01', amount: 260_000, merchant: 'Netflix', categoryId: 'fun' }),
      tx({ date: '2026-10-20', amount: 260_000, merchant: 'Netflix', categoryId: 'fun' }),
      tx({ date: '2026-10-05', amount: 45_000, merchant: 'Phở' }),
      tx({ date: '2026-10-06', amount: 45_000, merchant: 'phở ' }),
      tx({ date: '2026-10-15', amount: 1_200_000, merchant: 'Nhà hàng' }),
    ]);
    const odd = oddTransactions(d, '2026-10');
    expect(odd.map((o) => o.kind).sort()).toEqual(['big', 'duplicate', 'twice']);
    expect(odd.find((o) => o.kind === 'big')?.tx.merchant).toBe('Nhà hàng');
  });
});

describe('ghi nhầm thành Chi', () => {
  it('bắt trả thẻ, trả góp đã khai, cho mượn — và xếp lên đầu', () => {
    const d = base([
      tx({ date: '2026-10-20', amount: 7_000_000, merchant: 'Trả thẻ Shinhan', accountId: 'bank' }),
      tx({ date: '2026-10-08', amount: 1_200_000, merchant: 'Góp Cellphones' }),
      tx({ date: '2026-10-09', amount: 500_000, merchant: 'Cho Lan mượn', accountId: 'bank' }),
      tx({ date: '2026-10-25', amount: 50_000, merchant: 'Thẻ xe tháng' }), // không phải trả thẻ
      tx({ date: '2026-10-26', amount: 60_000, merchant: 'Cơm' }),
      tx({ date: '2026-10-27', amount: 500_000, merchant: 'Góp quỹ lớp' }), // không phải trả góp
    ]);
    d.installments = [{ id: 'i', name: 'Cellphones', accountId: 'card', categoryId: 'inst-x', monthly: 1_200_000, firstPeriod: '2026-01', months: 24 }];
    const odd = oddTransactions(d, '2026-10');
    expect(odd.map((o) => o.kind)).toEqual(['cardPay', 'loan', 'installment']);
  });
});

describe('gợi ý ngân sách theo tiền thu', () => {
  it('thu − cố định − trả góp − để dành, phần còn lại chia theo thói quen chi', () => {
    const d = base([
      tx({ date: '2026-09-03', amount: 3_000_000, categoryId: 'food' }),
      tx({ date: '2026-09-04', amount: 1_000_000, categoryId: 'shopping' }),
      tx({ date: '2026-10-03', amount: 999_999_999 }), // tháng đang lập: không tính
    ]);
    d.installments = [{ id: 'i', name: 'Góp ĐT', accountId: 'card', categoryId: 'inst-x', monthly: 1_000_000, firstPeriod: '2026-01', months: 24 }];
    d.goals = [{ id: 'g', name: 'Đà Lạt', target: 6_000_000, deadline: '2027-03-31', deposits: [] }];
    const p = planBudget(d, '2026-10', 20_000_000, 10, { family: 3_000_000 });
    expect(p.fixed).toBe(3_000_000); // chỉ "Gửi mẹ" đã nhập
    expect(p.installments).toBe(1_000_000);
    expect(p.goalsMonthly).toBe(1_000_000); // 6tr / 6 tháng
    expect(p.saving).toBe(2_000_000); // 10% thu > mục tiêu cần
    expect(p.flexible).toBe(14_000_000);
    expect(p.limits.saving).toBe(2_000_000);
    expect(p.limits['inst-x']).toBe(1_000_000);
    expect(p.limits.food).toBe(10_500_000); // 3/4 phần linh hoạt
    expect(p.limits.shopping).toBe(3_500_000);
    expect(p.byHabit).toBe(true);
  });
  it('để dành không ít hơn số mục tiêu cần; thu không đủ thì phần linh hoạt = 0', () => {
    const d = base([]);
    d.goals = [{ id: 'g', name: 'Máy', target: 12_000_000, deadline: '2026-12-31', deposits: [] }];
    const p = planBudget(d, '2026-10', 5_000_000, 10, {});
    expect(p.saving).toBe(4_000_000);
    expect(planBudget(d, '2026-10', 3_000_000, 10, {}).flexible).toBe(0);
  });
});

describe('tổng kết tháng', () => {
  it('tổng chi, so tháng trước, top danh mục, ngày không tiêu, khoản lớn nhất', () => {
    const d = base([
      tx({ date: '2026-09-03', amount: 500_000 }),
      tx({ date: '2026-10-03', amount: 400_000 }),
      tx({ date: '2026-10-04', amount: 200_000, categoryId: 'shopping' }),
      tx({ date: '2026-10-05', amount: 15_000_000, kind: 'income', categoryId: 'salary', accountId: 'bank' }),
    ]);
    const r = recap(d, '2026-10');
    expect(r.spent).toBe(600_000);
    expect(r.income).toBe(15_000_000);
    expect(r.vsPrev).toBe(20);
    expect(r.top[0]).toEqual({ categoryId: 'food', amount: 400_000, pct: 67 });
    expect(r.totalDays).toBe(31);
    expect(r.noSpendDays).toBe(29);
    expect(r.biggest?.amount).toBe(400_000);
  });
});

describe('lịch tiền', () => {
  it('có lương, hạn thẻ, khoản định kỳ trong tháng', () => {
    const d = base([tx({ date: '2026-10-03', amount: 400_000 })]);
    d.recurring = [{ id: 'r', merchant: 'Tiền nhà', amount: 5_000_000, categoryId: 'bills', accountId: 'bank', day: 31, startDate: '2026-01-01' }];
    const ev = moneyEvents(d, '2026-11', { salary: 'Lương', card: 'Trả thẻ' });
    expect(ev.map((e) => [e.date, e.kind])).toEqual([
      ['2026-11-05', 'salary'],
      ['2026-11-15', 'card'],
      ['2026-11-30', 'recurring'],
    ]);
    expect(ev[1].amount).toBe(400_000);
  });
});
