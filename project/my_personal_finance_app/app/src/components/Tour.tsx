/**
 * Hướng dẫn từng bước ngay trên màn hình: làm tối xung quanh, khoanh sáng đúng nút đang nói tới,
 * kèm một thẻ giải thích ngắn. Mỗi bộ hướng dẫn chỉ tự hiện một lần.
 */
import { useEffect, useLayoutEffect, useState } from 'react';
import { L } from '../labels';

export interface TourStep {
  /** CSS selector của phần cần chỉ vào. Không thấy trên màn hình thì bỏ qua bước đó. */
  target: string;
  title: string;
  text: string;
}

const KEY = (id: string) => `vi-cua-nang/tour/${id}`;

export function tourSeen(id: string) {
  try {
    return localStorage.getItem(KEY(id)) === '1';
  } catch {
    return true;
  }
}

function markSeen(id: string) {
  try {
    localStorage.setItem(KEY(id), '1');
  } catch {
    /* bỏ qua */
  }
}

/** Cho các bộ hướng dẫn hiện lại từ đầu (nút "Xem lại hướng dẫn nhanh"). */
export function resetTours() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('vi-cua-nang/tour/'))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* bỏ qua */
  }
  window.dispatchEvent(new Event('vg-tour-reset'));
}

export function Tour({ id, steps, delay = 400 }: { id: string; steps: TourStep[]; delay?: number }) {
  const [active, setActive] = useState(false);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const visible = steps.filter((s) => document.querySelector(s.target));
  const step = visible[i];

  // Đợi màn hình / bảng nhập hiện xong rồi mới bắt đầu.
  useEffect(() => {
    if (tourSeen(id)) return;
    const t = setTimeout(() => setActive(true), delay);
    return () => clearTimeout(t);
  }, [id, delay]);

  useLayoutEffect(() => {
    if (!active || !step) return;
    const el = document.querySelector(step.target);
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const measure = () => setRect(el.getBoundingClientRect());
    const t = setTimeout(measure, 350);
    measure();
    window.addEventListener('resize', measure);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', measure);
    };
  }, [active, step]);

  if (!active || !step || !rect) return null;

  const finish = () => {
    markSeen(id);
    setActive(false);
  };
  const last = i === visible.length - 1;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = Math.min(320, vw - 32);
  const pad = 6;
  const below = rect.top + rect.height / 2 < vh / 2;
  const left = Math.min(Math.max(16, rect.left + rect.width / 2 - w / 2), vw - w - 16);

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label={step.title}>
      <div
        className="tour__spot"
        style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }}
      />
      <div className="tour__card" style={{ width: w, left, ...(below ? { top: rect.bottom + 14 } : { bottom: vh - rect.top + 14 }) }}>
        <b>{step.title}</b>
        <p>{step.text}</p>
        <div className="tour__actions">
          {visible.length > 1 && (
            <>
              <button className="link" onClick={finish}>
                {L.tour.skip}
              </button>
              <span className="tour__count">
                {i + 1}/{visible.length}
              </span>
            </>
          )}
          <button className="btn btn--primary" onClick={() => (last ? finish() : setI(i + 1))}>
            {visible.length === 1 ? L.news.gotIt : last ? L.tour.done : L.tour.next}
          </button>
        </div>
      </div>
    </div>
  );
}
