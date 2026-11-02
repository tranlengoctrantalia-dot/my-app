/** Công cụ nhỏ cho câu chữ trong labels.ts. */
import { Fragment } from 'react';

/** Điền giá trị vào chỗ {ten} trong câu: t('Còn {n} ngày', { n: 3 }) → "Còn 3 ngày". */
export function t(text: string, vars: Record<string, string | number> = {}): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** Hiện câu có **chữ đậm** (và {ten} như t()). */
export function Rich({ text, vars }: { text: string; vars?: Record<string, string | number> }) {
  const parts = t(text, vars).split(/\*\*(.+?)\*\*/g);
  return (
    <>
      {parts.map((p, i) => (i % 2 ? <b key={i}>{p}</b> : <Fragment key={i}>{p}</Fragment>))}
    </>
  );
}
