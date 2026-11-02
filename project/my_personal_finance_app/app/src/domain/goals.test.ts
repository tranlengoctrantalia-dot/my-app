import { describe, expect, it } from 'vitest';
import { goalStatus, monthsLeft } from './goals';
import type { Goal } from './types';

const g = (over: Partial<Goal> = {}): Goal => ({ id: 'g', name: 'Đà Lạt', target: 6_000_000, deposits: [], ...over });

describe('mục tiêu tiết kiệm', () => {
  it('tính đã để dành, còn thiếu và mỗi tháng cần bỏ', () => {
    const s = goalStatus(g({ deadline: '2027-01-31', deposits: [{ date: '2026-10-01', amount: 1_000_000 }, { date: '2026-10-05', amount: 2_000_000 }] }), '2026-10-26');
    expect(s.saved).toBe(3_000_000);
    expect(s.left).toBe(3_000_000);
    expect(s.months).toBe(4);
    expect(s.monthly).toBe(750_000);
    expect(s.pct).toBeCloseTo(0.5);
  });
  it('rút tiền ra thì giảm, đủ rồi thì xong', () => {
    expect(goalStatus(g({ deposits: [{ date: '2026-10-01', amount: 7_000_000 }, { date: '2026-10-02', amount: -1_000_000 }] }), '2026-10-26').done).toBe(true);
  });
  it('hạn đã qua mà chưa đủ thì trễ, tối thiểu 1 tháng', () => {
    const goal = g({ deadline: '2026-09-30' });
    expect(monthsLeft(goal, '2026-10-26')).toBe(1);
    expect(goalStatus(goal, '2026-10-26').late).toBe(true);
  });
});
