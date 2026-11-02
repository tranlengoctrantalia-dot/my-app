import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import type { AppData } from './types';
import { buildImport, guessColumns, parseAmount, parseDate, parseRows, readFile, readText } from './importer';

/** Dữ liệu tối thiểu: vài danh mục và nguồn tiền. */
function appData(): AppData {
  return {
    version: 1,
    settings: { cutoffDay: 8, dueDay: 25, salaryDay: 5, partnerName: '', cashOnHand: 0, savingsFund: 0 },
    accounts: [
      { id: 'bank', name: 'Ngân hàng', kind: 'bank' },
      { id: 'cash', name: 'Tiền mặt', kind: 'cash' },
    ],
    categories: [
      { id: 'food', name: 'Ăn uống', icon: '🧋', kind: 'spend' },
      { id: 'other', name: 'Khác', icon: '📌', kind: 'spend' },
      { id: 'family', name: 'Gửi mẹ', icon: '🏡', kind: 'fixed' },
      { id: 'salary', name: 'Lương', icon: '', kind: 'income' },
      { id: 'other-in', name: 'Thu khác', icon: '', kind: 'income' },
    ],
    transactions: [],
    installments: [],
    budgets: [],
  };
}

const parse = (text: string) => {
  const sheet = readText(text);
  return parseRows(sheet, guessColumns(sheet.headers));
};

describe('đọc số tiền', () => {
  it('các kiểu viết', () => {
    expect(parseAmount('1.234.567')).toBe(1234567);
    expect(parseAmount('1,234,567')).toBe(1234567);
    expect(parseAmount('-50.000 ₫')).toBe(-50000);
    expect(parseAmount('50,000.00')).toBe(50000);
    expect(parseAmount('50.000,50')).toBe(50000.5);
    expect(parseAmount('(50.000)')).toBe(-50000);
    expect(parseAmount('50.000 VND')).toBe(50000);
    expect(parseAmount('25000đ')).toBe(25000);
    expect(parseAmount('VND -12,000')).toBe(-12000);
    expect(parseAmount('1.000-')).toBe(-1000);
    expect(parseAmount('12.5')).toBe(12.5);
    expect(parseAmount('abc')).toBeNaN();
  });
});

describe('đọc ngày', () => {
  it('ngày trước tháng, năm trước, tháng trước khi cần', () => {
    expect(parseDate('26/10/2026')).toBe('2026-10-26');
    expect(parseDate('5/3/2026')).toBe('2026-03-05');
    expect(parseDate('05-03-2026')).toBe('2026-03-05');
    expect(parseDate('05.03.2026 14:30')).toBe('2026-03-05');
    expect(parseDate('2026-10-26')).toBe('2026-10-26');
    expect(parseDate('2026-10-26T08:00:00')).toBe('2026-10-26');
    expect(parseDate('10/26/2026')).toBe('2026-10-26');
    expect(parseDate('26/10/26')).toBe('2026-10-26');
    expect(parseDate('46321')).toBe('2026-10-26');
    expect(parseDate('31/02/2026')).toBe('');
    expect(parseDate('hôm qua')).toBe('');
  });
});

describe('đoán cột', () => {
  it('không bắt nhầm', () => {
    expect(guessColumns(['Thời gian', 'Số tiền', 'Thu/Chi', 'Loại tiền'])).toEqual({ date: 0, amount: 1, type: 2 });
    expect(guessColumns(['Ngày GD', 'Số tiền ghi nợ', 'Số tiền ghi có', 'Số dư', 'Nội dung'])).toEqual({
      date: 0,
      expense: 1,
      income: 2,
      note: 4,
    });
    expect(guessColumns(['NGÀY', 'HẠNG MỤC', 'Tiền thu', 'Tiền chi', 'Ví'])).toEqual({
      date: 0,
      category: 1,
      income: 2,
      expense: 3,
      account: 4,
    });
  });
});

describe('Money Lover CSV', () => {
  const csv =
    '﻿Id;Date;Category;Amount;Currency;Note;Wallet\r\n' +
    '1;26/10/2026;Ăn uống;-45,000;VND;Trà sữa;Tiền mặt\r\n' +
    '2;25/10/2026;Lương;15,000,000;VND;Lương tháng 10;Ngân hàng\r\n' +
    '3;24/10/2026;Transfer;-1,000,000;VND;Nạp ví;Ngân hàng\r\n' +
    '\r\n' +
    '4;;Ăn uống;-10,000;VND;Thiếu ngày;Tiền mặt\r\n' +
    '5;23/10/2026;"Cafe; bánh";-30,000;VND;"Highlands ""HL""";MoMo\r\n';

  it('đọc dòng, bỏ dòng thiếu ngày, đánh dấu chuyển tiền', () => {
    const { rows, skipped } = parse(csv);
    expect(skipped).toBe(1);
    expect(rows).toHaveLength(4);
    expect(rows[0]).toEqual({
      date: '2026-10-26',
      amount: 45000,
      income: false,
      category: 'Ăn uống',
      note: 'Trà sữa',
      account: 'Tiền mặt',
      transfer: false,
    });
    expect(rows[1]).toMatchObject({ amount: 15000000, income: true, category: 'Lương' });
    expect(rows[2].transfer).toBe(true);
    expect(rows[3]).toMatchObject({ category: 'Cafe; bánh', note: 'Highlands "HL"', account: 'MoMo' });
  });

  it('khớp danh mục / nguồn tiền có sẵn, tạo mới khi cần, bỏ qua chuyển tiền', () => {
    const data = appData();
    const plan = buildImport(parse(csv).rows, data);
    expect(plan.transfers).toBe(1);
    expect(plan.transactions).toHaveLength(3);
    const [tea, salary, cafe] = plan.transactions;
    expect(tea).toMatchObject({ categoryId: 'food', accountId: 'cash', amount: 45000, myShare: 45000, merchant: 'Trà sữa' });
    expect(tea.kind).toBeUndefined();
    expect(salary).toMatchObject({ categoryId: 'salary', accountId: 'bank', kind: 'income' });
    expect(plan.newCategories).toHaveLength(1);
    expect(plan.newCategories[0]).toMatchObject({ name: 'Cafe; bánh', kind: 'spend' });
    expect(cafe.categoryId).toBe(plan.newCategories[0].id);
    expect(plan.newAccounts).toHaveLength(1);
    expect(plan.newAccounts[0]).toMatchObject({ name: 'MoMo', kind: 'ewallet' });
  });

  it('nhập lại cùng file thì không trùng', () => {
    const data = appData();
    const rows = parse(csv).rows;
    const first = buildImport(rows, data);
    const again = buildImport(rows, { ...data, transactions: first.transactions });
    expect(again.transactions).toHaveLength(0);
    expect(again.duplicates).toBe(3);
  });

  it('hai dòng giống hệt trong cùng file vẫn nhập cả hai', () => {
    const text = 'Date;Category;Amount\n01/10/2026;Ăn uống;-20.000\n01/10/2026;Ăn uống;-20.000\n';
    const data = appData();
    const first = buildImport(parse(text).rows, data);
    expect(first.transactions).toHaveLength(2);
    expect(new Set(first.transactions.map((t) => t.source)).size).toBe(2);
    // File sau có thêm một dòng giống hệt → chỉ nhập dòng thứ ba.
    const more = text + '01/10/2026;Ăn uống;-20.000\n';
    const again = buildImport(parse(more).rows, { ...data, transactions: first.transactions });
    expect(again.duplicates).toBe(2);
    expect(again.transactions).toHaveLength(1);
  });
});

describe('Misa Sổ Thu Chi', () => {
  // Có dòng tiêu đề sổ phía trên, cột Loại = Thu / Chi, số tiền luôn dương.
  const csv = [
    'SỔ THU CHI,,,,,',
    'Từ 01/10/2026 đến 31/10/2026,,,,,',
    ',,,,,',
    'Ngày,Loại,Hạng mục,Số tiền,Diễn giải,Tài khoản',
    '01/10/2026,Chi,ăn uống,"50.000",Phở,Ví tiền mặt',
    '02/10/2026,Thu,Lương,"20.000.000",,Vietcombank',
    '03/10/2026,Chi,,"15.000",Gửi xe,Ví tiền mặt',
    '04/10/2026,Thu,Tiền lãi,"120.000",,Vietcombank',
    '05/10/2026,Chi,Trả nợ,"500.000",,Vietcombank',
    '06/10/2026,Chi,Gửi mẹ,"2.000.000",,Thẻ tín dụng VIB',
  ].join('\n');

  it('tìm dòng tiêu đề và đọc loại thu/chi', () => {
    const sheet = readText(csv);
    expect(sheet.headers).toEqual(['Ngày', 'Loại', 'Hạng mục', 'Số tiền', 'Diễn giải', 'Tài khoản']);
    const { rows, skipped } = parseRows(sheet, guessColumns(sheet.headers));
    expect(skipped).toBe(0);
    expect(rows.map((r) => r.income)).toEqual([false, true, false, true, false, false]);
    expect(rows.map((r) => r.amount)).toEqual([50000, 20000000, 15000, 120000, 500000, 2000000]);
    expect(rows[4].transfer).toBe(true);
  });

  it('danh mục trống → Khác, thu mới tạo danh mục thu, nguồn tiền đoán loại', () => {
    const data = appData();
    const plan = buildImport(parse(csv).rows, data);
    expect(plan.transfers).toBe(1);
    const t = plan.transactions;
    expect(t[0].categoryId).toBe('food');
    expect(t[1].categoryId).toBe('salary');
    expect(t[2]).toMatchObject({ categoryId: 'other', merchant: 'Gửi xe' });
    expect(t[4].categoryId).toBe('family');
    const interest = plan.newCategories.find((c) => c.name === 'Tiền lãi');
    expect(interest?.kind).toBe('income');
    expect(t[3].categoryId).toBe(interest?.id);
    expect(t[3].merchant).toBe('Tiền lãi');
    const kinds = Object.fromEntries(plan.newAccounts.map((a) => [a.name, a.kind]));
    expect(kinds).toEqual({ 'Ví tiền mặt': 'cash', Vietcombank: 'bank', 'Thẻ tín dụng VIB': 'credit' });
    // Mỗi nguồn tiền mới chỉ tạo một lần.
    expect(t[1].accountId).toBe(t[3].accountId);
  });
});

describe('sao kê ngân hàng', () => {
  const tsv = [
    'Ngày giao dịch\tSố tiền ghi nợ\tSố tiền ghi có\tSố dư\tNội dung',
    '01/10/2026 09:15\t250.000\t\t9.750.000\tTT GRAB',
    '02/10/2026\t\t5.000.000\t14.750.000\tNHAN TIEN',
    '03/10/2026\t0\t0\t14.750.000\tPhi',
  ].join('\n');

  it('cột ghi nợ / ghi có riêng', () => {
    const { rows, skipped } = parse(tsv);
    expect(skipped).toBe(1);
    expect(rows.map((r) => [r.date, r.amount, r.income])).toEqual([
      ['2026-10-01', 250000, false],
      ['2026-10-02', 5000000, true],
    ]);
  });

  it('không có nguồn tiền → dùng nguồn dự phòng; không có danh mục → Khác / Thu khác', () => {
    const plan = buildImport(parse(tsv).rows, appData(), 'cash');
    expect(plan.transactions.map((t) => t.accountId)).toEqual(['cash', 'cash']);
    expect(plan.transactions.map((t) => t.categoryId)).toEqual(['other', 'other-in']);
    expect(plan.newCategories).toHaveLength(0);
  });

  it('chưa có nguồn tiền nào → tạo Tiền mặt, chưa có Khác → tạo Khác', () => {
    const data = { ...appData(), accounts: [], categories: [] };
    const plan = buildImport(parse(tsv).rows, data);
    expect(plan.newAccounts).toEqual([expect.objectContaining({ name: 'Tiền mặt', kind: 'cash' })]);
    expect(plan.newCategories.map((c) => [c.name, c.kind])).toEqual([
      ['Khác', 'spend'],
      ['Khác', 'income'],
    ]);
  });
});

describe('chỉ có số tiền dương', () => {
  it('không có cột loại → coi là khoản chi', () => {
    const { rows } = parse('Ngày,Số tiền,Ghi chú\n01/10/2026,"30,000",Cơm\n02/10/2026,"40,000",Bún\n');
    expect(rows.every((r) => !r.income)).toBe(true);
    expect(rows.map((r) => r.amount)).toEqual([30000, 40000]);
  });
});

describe('file Excel', () => {
  it('đọc ô ngày và số từ xlsx', async () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Báo cáo giao dịch'],
      [],
      ['Ngày', 'Hạng mục', 'Số tiền', 'Ghi chú', 'Ví'],
      [new Date(2026, 9, 26), 'Ăn uống', -45000, 'Trà sữa', 'Tiền mặt'],
      [46320, 'Lương', 15000000, '', 'Ngân hàng'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const sheet = await readFile(new File([buf], 'export.xlsx'));
    expect(sheet.headers).toEqual(['Ngày', 'Hạng mục', 'Số tiền', 'Ghi chú', 'Ví']);
    const { rows } = parseRows(sheet, guessColumns(sheet.headers));
    expect(rows.map((r) => [r.date, r.amount, r.income])).toEqual([
      ['2026-10-26', 45000, false],
      ['2026-10-25', 15000000, true],
    ]);
  });

  it('đọc CSV qua readFile', async () => {
    const sheet = await readFile(new File(['﻿Date,Amount\n01/10/2026,-5000\n'], 'a.csv', { type: 'text/csv' }));
    expect(sheet.rows).toEqual([['01/10/2026', '-5000']]);
  });
});
