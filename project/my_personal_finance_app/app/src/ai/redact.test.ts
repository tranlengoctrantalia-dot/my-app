import { describe, expect, it } from 'vitest';
import { redact } from './redact';

describe('che thông tin cá nhân', () => {
  it('che email, sđt, số thẻ, số tài khoản nhưng giữ ngày và số tiền', () => {
    const text = [
      'Kính gửi: lan.nguyen+bank@gmail.com',
      'SĐT liên hệ 0912 345 678',
      'Số thẻ 4123 45XX XXXX 9876',
      'Tài khoản 1234567890123',
      '05/10/2026  SHOPEE VN  149.435',
      '06/10/2026  GRAB*FOOD  1.373.000 VND',
    ].join('\n');
    const out = redact(text);
    expect(out).not.toMatch(/gmail|0912|4123|9876|1234567890123/);
    expect(out).toContain('05/10/2026  SHOPEE VN  149.435');
    expect(out).toContain('06/10/2026  GRAB*FOOD  1.373.000 VND');
  });

  it('che dòng có nhãn họ tên / địa chỉ và tên tự khai (có dấu lẫn không dấu)', () => {
    const out = redact('Họ tên: Trần Lê Ngọc Trân\nĐịa chỉ: 12 Nguyễn Huệ, Q1\nKính chào Quý khách hàng TRAN LE NGOC TRAN', ['Trần Lê Ngọc Trân']);
    expect(out).not.toMatch(/Ngọc|NGOC|Nguyễn Huệ/);
    expect(out).toContain('Họ tên: [đã che]');
  });
});
