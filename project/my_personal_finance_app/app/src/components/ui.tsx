import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { parseMoney, periodLabel, plain } from '../domain/format';
import { shiftPeriod } from '../domain/calc';
import { Art, Icon, type IconName } from './icons';
import { lockScroll } from '../viewport';
import type { PeriodKey } from '../domain/types';
import { L } from '../labels';

export function Card({ title, action, children, tone, info }: { title?: ReactNode; action?: ReactNode; children: ReactNode; tone?: 'accent'; info?: ReactNode }) {
  return (
    <section className={`card${tone ? ` card--${tone}` : ''}`}>
      {(title || action) && (
        <header className="card__head">
          <h2>
            {title}
            {info && <Info>{info}</Info>}
          </h2>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Progress({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : value > 0 ? 100 : 0;
  const state = value > max ? 'over' : pct >= 85 ? 'warn' : 'ok';
  return (
    <div className="progress" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`progress__bar progress__bar--${state}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function PeriodPicker({
  value,
  onChange,
  hint,
  label,
}: {
  value: PeriodKey;
  onChange: (p: PeriodKey) => void;
  hint?: string;
  /** Thay chữ "Tháng 11" (vd. tab Thẻ ghi "Kỳ trả 25/11" cho khỏi lẫn với tháng dương lịch). */
  label?: (p: PeriodKey) => string;
}) {
  return (
    <div className="period">
      <button className="icon-btn" aria-label={L.common.prevPeriod} onClick={() => onChange(shiftPeriod(value, -1))}>
        <Icon name="left" />
      </button>
      <div className="period__label">
        <strong>{label ? label(value) : periodLabel(value)}</strong>
        {hint && <small>{hint}</small>}
      </div>
      <button className="icon-btn" aria-label={L.common.nextPeriod} onClick={() => onChange(shiftPeriod(value, 1))}>
        <Icon name="right" />
      </button>
    </div>
  );
}

/** Ô nhập tiền có dấu chấm ngăn cách hàng nghìn. */
export function MoneyInput({
  value,
  onChange,
  allowNegative,
  ...rest
}: { value: number; onChange: (n: number) => void; allowNegative?: boolean } & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange'
>) {
  const [text, setText] = useState(value ? plain(value) : '');
  useEffect(() => {
    if (parseMoney(text) !== value) setText(value ? plain(value) : '');
  }, [value]);
  return (
    <div className="money-input">
      <input
        {...rest}
        inputMode={allowNegative ? 'text' : 'numeric'}
        value={text}
        onChange={(e) => {
          let n = parseMoney(e.target.value);
          if (!allowNegative) n = Math.abs(n);
          setText(e.target.value.trim() === '-' ? '-' : n ? plain(n) : '');
          onChange(n);
        }}
      />
      <span>{L.common.currency}</span>
    </div>
  );
}

export function Sheet({ title, onClose, children, info }: { title: string; onClose: () => void; children: ReactNode; info?: ReactNode }) {
  useEffect(() => lockScroll(), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <header className="sheet__head">
          <h2>
            {title}
            {info && <Info>{info}</Info>}
          </h2>
          <button className="icon-btn" aria-label={L.common.close} onClick={onClose}>
            <Icon name="x" />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

/** Màn trống: hình minh họa + một dòng + một nút (nếu có). */
export function Empty({ children, art, action }: { children: ReactNode; art?: IconName; action?: ReactNode }) {
  if (!art) return <p className="empty">{children}</p>;
  return (
    <div className="empty-art">
      <Art name={art} size={96} />
      <p className="empty">{children}</p>
      {action}
    </div>
  );
}

/**
 * Icon ⓘ đặt cạnh tên: chạm mới hiện giải thích ngắn (bong bóng), chạm ra ngoài thì tắt.
 * Dùng thay cho mọi dòng chú thích trên màn hình.
 */
export function Info({ children }: { children: ReactNode }) {
  const [at, setAt] = useState<{ top: number; left: number; width: number } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!at) return;
    const off = (e: Event) => {
      if (!ref.current?.contains(e.target as Node)) setAt(null);
    };
    const close = () => setAt(null);
    document.addEventListener('pointerdown', off, true);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('pointerdown', off, true);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [at]);
  const toggle = (e: MouseEvent<HTMLButtonElement>) => {
    // Nằm trong <label> (công tắc): không cho bật / tắt công tắc khi chạm ⓘ.
    e.preventDefault();
    e.stopPropagation();
    if (at) return setAt(null);
    const r = e.currentTarget.getBoundingClientRect();
    const width = Math.min(260, window.innerWidth - 32);
    const left = Math.min(Math.max(16, r.left + r.width / 2 - width / 2), window.innerWidth - width - 16);
    setAt({ top: r.bottom + 6, left, width });
  };
  return (
    <span className="info" ref={ref}>
      <button type="button" className="info__btn" aria-label={L.common.info} aria-expanded={!!at} onClick={toggle}>
        <Icon name="info" size={16} />
      </button>
      {at && (
        <span className="info__pop" role="tooltip" style={{ top: at.top, left: at.left, width: at.width }}>
          {children}
        </span>
      )}
    </span>
  );
}

/**
 * Ô nhập số nhỏ (ngày trong tháng, tỉ lệ…). Cho phép xoá trắng rồi gõ lại;
 * chỉ nhận khi số hợp lệ, rời ô mà để trống / sai thì quay về số cũ.
 */
export function NumberInput({
  value,
  onChange,
  min = 0,
  max = 999,
  ...rest
}: { value: number; onChange: (n: number) => void; min?: number; max?: number } & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'min' | 'max' | 'type'
>) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    if (Number(text) !== value) setText(String(value));
  }, [value]);
  return (
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="off"
      value={text}
      onChange={(e) => {
        const t = e.target.value.replace(/\D/g, '').slice(0, String(max).length);
        setText(t);
        const n = Number(t);
        if (t && n >= min && n <= max) onChange(n);
      }}
      onFocus={(e) => e.target.select()}
      onBlur={() => setText(String(value))}
    />
  );
}
