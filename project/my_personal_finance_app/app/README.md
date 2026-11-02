# Ví Gọn

App quản lý tài chính cá nhân dạng PWA, chạy trên iPhone, Android, Windows và macOS (cài từ trình duyệt, dùng được offline).

## Chạy

```bash
npm install
npm run dev      # phát triển
npm test         # kiểm tra logic tính toán so với file Excel
npm run build    # bản production trong dist/
```

Cài lên điện thoại: deploy `dist/` (Vercel/Netlify/GitHub Pages) → mở link bằng Safari/Chrome → **Thêm vào màn hình chính**.

## Cấu trúc

- `src/domain/` – kiểu dữ liệu và toàn bộ phép tính (kỳ thẻ, sao kê, ngân sách, chia tiền). Không phụ thuộc UI.
- `src/data/seed.ts` – dữ liệu mẫu lấy từ file Excel đầu vào.
- `src/screens/` – Tổng quan, Giao dịch, Thẻ & trả góp, Ngân sách, Chia tiền, Cài đặt.
- `src/store.tsx` – trạng thái, lưu trong `localStorage`; sao lưu/khôi phục JSON ở Cài đặt.

Phân tích yêu cầu: `../docs/01. design/phan-tich-yeu-cau.md`.
