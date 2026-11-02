import { money } from '../domain/format';

export interface Slice {
  id: string;
  value: number;
  color: string;
}

/**
 * Màu biểu đồ theo màu chủ đạo: phần lớn nhất đậm nhất, các phần sau nhạt dần
 * (pha với màu nền nên hợp cả giao diện sáng lẫn tối).
 */
export function chartColor(i: number, n: number) {
  const pct = n <= 1 ? 100 : Math.round(100 - (i * 65) / (n - 1));
  return `color-mix(in oklab, var(--accent) ${pct}%, var(--chart-mix))`;
}

/** Biểu đồ tròn rỗng giữa, vẽ bằng SVG (không cần thư viện). */
export function Donut({ slices, total, label }: { slices: Slice[]; total: number; label: string }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const sum = slices.reduce((a, s) => a + s.value, 0);
  let offset = 0;
  const gap = slices.length > 1 ? 1.5 : 0;
  return (
    <div className="donut">
      <svg viewBox="0 0 100 100" role="img" aria-label={`${label} ${money(total)}`}>
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="11" />
        {sum > 0 &&
          slices.map((s) => {
            const len = (s.value / sum) * c;
            const el = (
              <circle
                key={s.id}
                cx="50"
                cy="50"
                r={r}
                fill="none"
                style={{ stroke: s.color }}
                strokeWidth="11"
                strokeDasharray={`${Math.max(0, len - gap)} ${c}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 50 50)"
              />
            );
            offset += len;
            return el;
          })}
      </svg>
      <div className="donut__center">
        <small>{label}</small>
        <b>{money(total)}</b>
      </div>
    </div>
  );
}
