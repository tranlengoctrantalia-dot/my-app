import { describe, expect, it } from 'vitest';
import { buildQuery } from './gmail';

describe('giới hạn quét Gmail', () => {
  it('số ngày, từ lần trước, chỉ vài ngân hàng', () => {
    expect(buildQuery({ range: 7, max: 20 })).toMatch(/^newer_than:7d -category:promotions \(subject:"biến động"/);
    expect(buildQuery({ range: 'since', max: 50 }, '2026-10-15')).toMatch(/^after:2026\/10\/15 /);
    expect(buildQuery({ range: 'since', max: 50 })).toMatch(/^newer_than:30d /);
    expect(buildQuery({ range: 30, max: 50, banks: ['vcb', 'tpb'] })).toBe('newer_than:30d from:(vietcombank.com.vn OR tpb.vn OR tpbank.com.vn)');
  });
});
