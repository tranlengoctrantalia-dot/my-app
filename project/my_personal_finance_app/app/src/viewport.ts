/**
 * Xử lý màn hình điện thoại:
 * - đo phần màn hình còn nhìn thấy khi bàn phím bật (visualViewport) để bảng nhập co lại vừa,
 * - khoá cuộn trang phía sau khi đang mở bảng nhập,
 * - đưa ô đang gõ ra giữa phần nhìn thấy.
 */

/** Màn hình cảm ứng (điện thoại / máy tính bảng): không tự bật bàn phím khi mở form. */
export const isTouch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

export function trackVisualViewport() {
  const vv = window.visualViewport;
  if (!vv) return;
  const root = document.documentElement.style;
  const update = () => {
    root.setProperty('--vv-h', `${vv.height}px`);
    root.setProperty('--vv-top', `${vv.offsetTop}px`);
  };
  update();
  vv.addEventListener('resize', update);
  vv.addEventListener('scroll', update);

  // Bàn phím bật xong mới biết chỗ trống còn bao nhiêu — đợi một chút rồi cuộn ô đang gõ ra giữa.
  document.addEventListener('focusin', (e) => {
    const el = e.target as HTMLElement;
    if (!isTouch || !el.matches('input, select, textarea') || !el.closest('.sheet')) return;
    setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 320);
  });
}

let locks = 0;
let savedY = 0;

/** Khoá cuộn trang nền (cách dùng position: fixed để iPhone cũng không trôi). Hỗ trợ nhiều bảng chồng nhau. */
export function lockScroll(): () => void {
  if (locks++ === 0) {
    savedY = window.scrollY;
    const b = document.body.style;
    b.position = 'fixed';
    b.top = `-${savedY}px`;
    b.left = '0';
    b.right = '0';
    b.overflow = 'hidden';
  }
  return () => {
    if (--locks === 0) {
      const b = document.body.style;
      b.position = b.top = b.left = b.right = b.overflow = '';
      window.scrollTo(0, savedY);
    }
  };
}
