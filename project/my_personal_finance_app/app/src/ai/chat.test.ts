/** TASK-0007: số liệu gửi cho trợ lý tiền. */
import { describe, expect, it } from 'vitest';
import { starterData } from '../data/starter';
import { moneyContext } from './chat';

describe('moneyContext', () => {
  it('có đủ các phần, số tiền dạng 1.000.000đ (không bị ẩn số)', () => {
    const d = { ...starterData(), setupPending: undefined };
    d.accounts = [{ id: 'm', name: 'Momo', kind: 'ewallet', balanceAdjust: 0, balanceAt: { date: '2026-11-01', amount: 5_000_000, seen: [] } }];
    const s = moneyContext(d, '2026-11-12');
    expect(s).toContain('## Số dư từng nguồn');
    expect(s).toContain('Momo (tiền có): 5.000.000đ');
    expect(s).toContain('## Khả năng thanh toán');
    expect(s).toContain('KẾT QUẢ:');
    expect(s).toContain('## Ngân sách tháng 2026-11');
  });
});
