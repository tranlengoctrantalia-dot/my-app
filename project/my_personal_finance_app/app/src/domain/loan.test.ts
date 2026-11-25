import { describe, expect, it } from 'vitest';
import { starterData } from '../data/starter';
import { accountFlow, payables, receivables, spentByCategory, periodOf, spreadShare, statement, cashCheck, accountBalance, balanceAnchor, recurringDue, statementPaid } from './calc';

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

describe('đủ tiền trả thẻ', () => {
  it('đã chuyển trả thẻ thì không trừ sao kê lần nữa', () => {
    const d = { ...starterData(), setupPending: undefined } as AppData;
    d.settings = { ...d.settings, cutoffDay: 8, dueDay: 25, cashOnHand: 0 };
    d.accounts = [
      { id: 'card', name: 'Thẻ', kind: 'credit' },
      { id: 'bank', name: 'NH', kind: 'bank', balanceAdjust: 10_000_000 },
    ];
    d.transactions = [{ id: 'a', date: '2026-10-05', merchant: 'x', amount: 3_000_000, myShare: 3_000_000, categoryId: 'food', accountId: 'card', reimbursed: 0 }];
    expect(cashCheck(d, '2026-10', '2026-10-06')).toMatchObject({ toPay: 3_000_000, surplus: 7_000_000 });
    d.transactions.push({ id: 'p', date: '2026-10-20', merchant: 'Trả thẻ', amount: 3_000_000, myShare: 0, categoryId: 'other', accountId: 'bank', toAccountId: 'card', reimbursed: 0, kind: 'transfer' });
    // Ví còn 7tr, thẻ đã trả đủ → dư 7tr (trước đây báo dư 4tr vì trừ sao kê 2 lần).
    expect(cashCheck(d, '2026-10', '2026-10-21')).toMatchObject({ paid: 3_000_000, toPay: 0, surplus: 7_000_000 });
  });
  it('trừ cả tiền tiêu hằng ngày còn lại tới cuối tháng (theo ngân sách linh hoạt)', () => {
    const d = { ...starterData(), setupPending: undefined } as AppData;
    d.settings = { ...d.settings, cutoffDay: 8, dueDay: 25, salaryDay: 7, cashOnHand: 10_000_000 };
    d.accounts = [{ id: 'card', name: 'Thẻ', kind: 'credit' }];
    d.budgets = [{ period: '2026-11', income: 0, lines: [{ categoryId: 'food', limit: 4_000_000 }] }];
    d.transactions = [{ id: 'a', date: '2026-11-01', merchant: 'x', amount: 1_000_000, myShare: 1_000_000, categoryId: 'food', accountId: 'card', reimbursed: 0 }];
    // Còn 3tr ăn uống phải tiêu tới cuối tháng, thẻ kỳ 25/11 có 1tr → 10tr − 3tr − 1tr = 6tr.
    expect(cashCheck(d, '2026-11', '2026-11-02')).toMatchObject({ daily: 3_000_000, toPay: 1_000_000, surplus: 6_000_000 });
  });
  it('chưa đặt ngân sách: ước theo tháng trước, chia theo ngày còn lại', () => {
    const d = { ...starterData(), setupPending: undefined } as AppData;
    d.settings = { ...d.settings, cutoffDay: 8, dueDay: 25, cashOnHand: 0 };
    d.accounts = [{ id: 'cash', name: 'Tiền mặt', kind: 'cash' }];
    d.transactions = [{ id: 'a', date: '2026-10-10', merchant: 'x', amount: 3_000_000, myShare: 3_000_000, categoryId: 'food', accountId: 'cash', reimbursed: 0 }];
    // Tháng 10 tiêu 3tr; 16/11 còn 15/30 ngày → ước 1,5tr.
    expect(cashCheck(d, '2026-11', '2026-11-16').daily).toBe(1_500_000);
  });
  it('lương về trước hạn trả thẻ (chưa ghi) thì cộng vào; ghi rồi thì thôi', () => {
    const d = { ...starterData(), setupPending: undefined } as AppData;
    d.settings = { ...d.settings, cutoffDay: 8, dueDay: 25, salaryDay: 7, cashOnHand: 1_000_000 };
    d.accounts = [{ id: 'card', name: 'Thẻ', kind: 'credit' }];
    d.budgets = [{ period: '2026-11', income: 15_000_000, lines: [] }];
    expect(cashCheck(d, '2026-11', '2026-11-02')).toMatchObject({ incoming: 15_000_000, surplus: 16_000_000 });
    expect(cashCheck(d, '2026-11', '2026-11-10').incoming).toBe(0);
  });
});

describe('số dư ví theo mốc nhập', () => {
  it('khoản ghi lùi ngày (trước lúc nhập số dư) không trừ lần nữa; khoản sau mốc thì trừ', () => {
    const d = { ...starterData(), setupPending: undefined } as AppData;
    const tx = (id: string, date: string, amount: number): Transaction => ({ id, date, merchant: 'x', amount, myShare: amount, categoryId: 'food', accountId: 'momo', reimbursed: 0 });
    d.accounts = [{ id: 'momo', name: 'Momo', kind: 'ewallet' }];
    d.transactions = [tx('a', '2026-11-02', 50_000)];
    d.accounts[0] = { ...d.accounts[0], balanceAdjust: 0, balanceAt: balanceAnchor(d, 'momo', 1_715_536, '2026-11-02') };
    const bal = () => accountBalance(d, 'momo', '2026-11-05');
    expect(bal()).toBe(1_715_536);
    d.transactions.push(tx('old', '2026-10-20', 300_000)); // nhập sao kê cũ
    expect(bal()).toBe(1_715_536);
    d.transactions.push(tx('same', '2026-11-02', 15_536), tx('new', '2026-11-04', 200_000));
    expect(bal()).toBe(1_500_000);
  });
});

describe('tiền người khác trả lại về ví', () => {
  const setup = () => {
    const d = { ...starterData(), setupPending: undefined } as AppData;
    d.accounts = [{ id: 'bank', name: 'NH', kind: 'bank' }];
    return d;
  };
  it('chia bill: bạn trả lại 200k thì ví còn 900k (trả 300k, phần mình 100k)', () => {
    const d = setup();
    d.transactions = [{ id: 'a', date: '2026-10-10', merchant: 'Lẩu', amount: 300_000, myShare: 100_000, categoryId: 'food', accountId: 'bank', reimbursed: 0, splits: [{ person: 'lan', amount: 200_000, paid: 200_000 }] }];
    d.accounts[0] = { ...d.accounts[0], balanceAdjust: 1_000_000 };
    expect(accountBalance(d, 'bank', '2026-10-20')).toBe(900_000);
  });
  it('quẹt thẻ, công ty trả lại → tiền vào tài khoản ngân hàng, thẻ vẫn nợ đủ', () => {
    const d = setup();
    d.accounts = [
      { id: 'card', name: 'Thẻ', kind: 'credit', balanceAdjust: 0 },
      { id: 'bank', name: 'NH', kind: 'bank', balanceAdjust: 1_000_000 },
    ];
    d.transactions = [{ id: 'g', date: '2026-10-20', merchant: 'Quà', amount: 1_723_760, myShare: 0, categoryId: 'gift', accountId: 'card', reimbursed: 0, splits: [{ person: 'company', amount: 1_723_760, paid: 1_723_760 }] }];
    expect(accountBalance(d, 'bank', '2026-10-25')).toBe(2_723_760);
    expect(accountBalance(d, 'card', '2026-10-25')).toBe(-1_723_760);
  });
  it('cho vay trước lúc nhập số dư, trả lại sau đó → cộng vào ví', () => {
    const d = setup();
    const loan: Transaction = { id: 'l', date: '2026-10-10', merchant: 'Cho Lan vay', amount: 1_000_000, myShare: 0, categoryId: 'other', accountId: 'bank', reimbursed: 0, kind: 'lend', splits: [{ person: 'lan', amount: 1_000_000, paid: 0 }] };
    d.transactions = [loan];
    d.accounts[0] = { ...d.accounts[0], balanceAdjust: 0, balanceAt: balanceAnchor(d, 'bank', 9_000_000, '2026-10-15') };
    expect(accountBalance(d, 'bank', '2026-10-20')).toBe(9_000_000);
    d.transactions = [{ ...loan, splits: [{ person: 'lan', amount: 1_000_000, paid: 1_000_000 }] }];
    expect(accountBalance(d, 'bank', '2026-10-20')).toBe(10_000_000);
  });
});

describe('tiền trả thẻ tính cho kỳ nào', () => {
  const setup = () => {
    const d = { ...starterData(), setupPending: undefined } as AppData;
    d.settings = { ...d.settings, cutoffDay: 8, dueDay: 25 };
    d.accounts = [
      { id: 'card', name: 'Thẻ', kind: 'credit' },
      { id: 'bank', name: 'NH', kind: 'bank' },
    ];
    const spend = (id: string, date: string, amount: number): Transaction => ({ id, date, merchant: 'x', amount, myShare: amount, categoryId: 'food', accountId: 'card', reimbursed: 0 });
    d.transactions = [spend('o', '2026-10-01', 8_200_000), spend('n', '2026-10-20', 10_742_000)];
    return d;
  };
  const pay = (date: string, amount: number): Transaction => ({ id: `p${date}`, date, merchant: 'Trả thẻ', amount, myShare: 0, categoryId: 'other', accountId: 'bank', toAccountId: 'card', reimbursed: 0, kind: 'transfer' });
  it('trả sao kê tháng 10 trễ (27/10) vẫn tính cho kỳ 25/10, kỳ 25/11 còn nguyên', () => {
    const d = setup();
    d.transactions.push(pay('2026-10-27', 8_200_000));
    expect(statementPaid(d, '2026-10')).toBe(8_200_000);
    expect(statementPaid(d, '2026-11')).toBe(0);
  });
  it('trả sau ngày chốt 08/11 → tính cho kỳ 25/11', () => {
    const d = setup();
    d.transactions.push(pay('2026-10-20', 8_200_000), pay('2026-11-15', 2_000_000));
    expect(statementPaid(d, '2026-10')).toBe(8_200_000);
    expect(statementPaid(d, '2026-11')).toBe(2_000_000);
  });
  it('bấm "Ghi đã trả thẻ" ở kỳ 25/11 → tính cho kỳ 25/11 dù kỳ 25/10 trong app còn nợ', () => {
    const d = setup();
    d.transactions.push({ ...pay('2026-11-02', 10_742_000), source: 'cardpay:2026-11' });
    expect(statementPaid(d, '2026-11')).toBe(10_742_000);
    expect(statementPaid(d, '2026-10')).toBe(0);
  });
  it('bấm "Đã trả thẻ" mà số trả ít hơn app tính → kỳ đó vẫn xong (trả là trả)', () => {
    const d = setup();
    d.transactions.push({ ...pay('2026-11-20', 10_000_000), source: 'cardpay:2026-11' });
    expect(statementPaid(d, '2026-11')).toBe(10_742_000);
  });
  it('đánh dấu "đã trả hết" kỳ 25/10 → kỳ đó trả đủ, tiền trả 02/11 tính cho kỳ 25/11', () => {
    const d = setup();
    d.settings = { ...d.settings, cardSettled: ['card:2026-10'] };
    d.transactions.push(pay('2026-11-02', 5_000_000));
    expect(statementPaid(d, '2026-10')).toBe(8_200_000);
    expect(statementPaid(d, '2026-11')).toBe(5_000_000); // kỳ trước đã xong → trả trước cho kỳ đang chạy
  });
  it('kỳ cũ quá hạn hơn 15 ngày mà app chưa thấy trả → coi như đã trả ngoài app', () => {
    const d = setup();
    d.transactions.push(pay('2026-11-20', 10_742_000));
    expect(statementPaid(d, '2026-10')).toBe(0);
    expect(statementPaid(d, '2026-11')).toBe(10_742_000);
  });
  it('app ghi thiếu sao kê tháng 10, trả 27/10 → vẫn không trừ vào kỳ 25/11', () => {
    const d = setup();
    d.transactions = d.transactions.filter((t) => t.id !== 'o');
    d.transactions.push(pay('2026-10-27', 8_200_000));
    expect(statementPaid(d, '2026-11')).toBe(0);
  });
});

describe('cho vay bằng thẻ', () => {
  it('bạn vay 6.666.000 qua thẻ VP → nằm ở sao kê VP, tiền bạn trả lại tính cho VP, không dính SHBVN', () => {
    const d = { ...starterData(), setupPending: undefined } as AppData;
    d.settings = { ...d.settings, cutoffDay: 8, dueDay: 25, cashOnHand: 0 };
    d.accounts = [
      { id: 'shb', name: 'SHBVN', kind: 'credit' },
      { id: 'vp', name: 'VP', kind: 'credit' },
      { id: 'momo', name: 'Momo', kind: 'ewallet' },
    ];
    d.transactions = [
      { id: 'l', date: '2026-10-20', merchant: 'Cho Lan vay', amount: 6_666_000, myShare: 0, categoryId: 'other', accountId: 'vp', reimbursed: 0, kind: 'lend', splits: [{ person: 'lan', amount: 6_666_000, paid: 0 }] },
      { id: 's', date: '2026-10-21', merchant: 'Cơm', amount: 100_000, myShare: 100_000, categoryId: 'food', accountId: 'shb', reimbursed: 0 },
    ];
    expect(statement(d, '2026-11', 'vp').total).toBe(6_666_000);
    expect(statement(d, '2026-11', 'shb').total).toBe(100_000);
    expect(cashCheck(d, '2026-11', '2026-11-02', 'vp').owedBack).toBe(6_666_000);
    expect(cashCheck(d, '2026-11', '2026-11-02', 'shb').owedBack).toBe(0);
    expect(spentByCategory(d, '2026-10').get('other')).toBeUndefined(); // cho vay không phải chi tiêu
  });
});

describe('khoản định kỳ', () => {
  it('đổi ngày lặp từ 5 sang 15 sau khi tháng này đã ghi → không ghi lần 2', () => {
    const r = { id: 'r', merchant: 'Tiền nhà', amount: 5_000_000, categoryId: 'bills', accountId: 'bank', day: 15, startDate: '2026-10-01', lastDate: '2026-11-05' };
    expect(recurringDue(r, '2026-11-20')).toEqual([]);
    expect(recurringDue(r, '2026-12-16')).toEqual(['2026-12-15']);
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

describe('hoàn tiền về thẻ sau ngày chốt, trước hạn trả', () => {
  const setup = () => {
    const d = { ...starterData(), setupPending: undefined } as AppData;
    d.settings = { ...d.settings, cutoffDay: 6, dueDay: 25 };
    d.accounts = [
      { id: 'card', name: 'Thẻ', kind: 'credit' },
      { id: 'bank', name: 'NH', kind: 'bank' },
    ];
    d.transactions = [spend('a', '2026-10-20', 10_000_000), spend('r1', '2026-11-16', -200_000), spend('r2', '2026-11-16', -100_000), spend('b', '2026-11-20', 500_000)];
    return d;
  };
  const spend = (id: string, date: string, amount: number): Transaction => ({ id, date, merchant: 'x', amount, myShare: amount, categoryId: 'shopping', accountId: 'card', reimbursed: 0 });
  const pay = (date: string, amount: number): Transaction => ({ id: `p${date}`, date, merchant: 'Trả thẻ', amount, myShare: 0, categoryId: 'other', accountId: 'bank', toAccountId: 'card', reimbursed: 0, kind: 'transfer' });
  it('trả 23/11 số bank báo (đã trừ tiền hoàn) → kỳ 11 hết nợ, kỳ 12 không tính lại khoản hoàn', () => {
    const d = setup();
    d.transactions.push(pay('2026-11-23', 9_700_000));
    const k11 = statement(d, '2026-11');
    expect(k11.total).toBe(10_000_000);
    expect(k11.refundsAfter).toBe(300_000);
    expect(statementPaid(d, '2026-11')).toBe(10_000_000);
    expect(statement(d, '2026-12').total).toBe(500_000);
  });
  it('đã trả đủ trước lúc tiền hoàn về → khoản hoàn ở lại kỳ sau', () => {
    const d = setup();
    d.transactions.push(pay('2026-11-10', 10_000_000));
    expect(statement(d, '2026-11').refundsAfter).toBe(0);
    expect(statement(d, '2026-12').total).toBe(500_000 - 300_000);
  });
  it('hoàn cho món mua cùng kỳ sau → ở lại kỳ sau', () => {
    const d = setup();
    d.transactions.push(spend('c', '2026-11-16', 150_000), spend('rc', '2026-11-18', -150_000), pay('2026-11-23', 9_700_000));
    expect(statement(d, '2026-11').refundsAfter).toBe(300_000);
    expect(statement(d, '2026-12').total).toBe(500_000);
  });
});
