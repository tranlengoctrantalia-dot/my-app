import { describe, expect, it } from 'vitest';
import { starterData } from '../data/starter';
import { mergeSamePeople } from './split';
import type { AppData, Transaction } from './types';

const tx = (p: Partial<Transaction>): Transaction => ({
  id: Math.random().toString(36),
  date: '2026-10-10',
  merchant: 'x',
  amount: 300_000,
  myShare: 100_000,
  categoryId: 'food',
  accountId: 'cash',
  reimbursed: 0,
  ...p,
});

describe('gộp người trùng tên', () => {
  it('giữ "partner", chuyển khoản của bản trùng sang, cộng dồn nếu cùng 1 khoản', () => {
    const d = starterData() as AppData;
    d.settings = { ...d.settings, people: [{ id: 'x1', name: 'người yêu ' }, { id: 'partner', name: 'Người yêu' }, { id: 'lan', name: 'Lan' }] };
    d.transactions = [
      tx({ splits: [{ person: 'x1', amount: 100_000, paid: 0 }, { person: 'partner', amount: 100_000, paid: 50_000 }] }),
      tx({ kind: 'lend', myShare: 0, splits: [{ person: 'x1', amount: 300_000, paid: 0 }] }),
    ];
    const r = mergeSamePeople(d);
    expect(r.settings.people!.map((p) => p.id)).toEqual(['partner', 'lan']);
    expect(r.transactions[0].splits).toEqual([{ person: 'partner', amount: 200_000, paid: 50_000 }]);
    expect(r.transactions[1].splits![0].person).toBe('partner');
    expect(mergeSamePeople(r)).toBe(r);
  });

  it('khoản cũ ghi "partner" mà danh sách chỉ có người tên Người yêu (id khác, dấu NFD) → gộp vào người đó', () => {
    const d = starterData() as AppData;
    d.settings = { ...d.settings, partnerName: 'Người yêu', people: [{ id: 'abc', name: 'Người yêu'.normalize('NFD') }] };
    d.transactions = [tx({ counterparty: 'partner', reimbursed: 0 }), tx({ kind: 'lend', myShare: 0, splits: [{ person: 'abc', amount: 300_000, paid: 0 }] })];
    const r = mergeSamePeople(d);
    expect(r.transactions[0].counterparty).toBe('abc');
    expect(r.settings.people!.map((p) => p.id)).toEqual(['abc']);
  });
});
