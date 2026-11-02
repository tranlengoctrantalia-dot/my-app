import { Breakdown } from '../components/Breakdown';
import { useMemo, useState } from 'react';
import { monthOf, shiftPeriod, todayISO } from '../domain/calc';
import { money, periodLabel } from '../domain/format';
import { categoryTrend, insights, lastPeriods, pctChange, periodTotals, savingRate, topCategories, trend, type Insight, type PeriodTotals } from '../domain/report';
import type { PeriodKey } from '../domain/types';
import { useStore } from '../store';
import { chartColor } from '../components/Donut';
import { RecapSheet } from '../components/Recap';
import { Icon } from '../components/icons';
import { t, Rich } from '../i18n';
import { L } from '../labels';

const R = L.report;
import '../report.css';

const N = 6;
const monthShort = (p: PeriodKey) => t(R.monthShort, { m: Number(p.slice(5, 7)) });

/** Biểu đồ cột chi theo kỳ, vạch ngang là khoản thu; chạm cột để chọn kỳ. */
function TrendChart({ rows, selected, onSelect }: { rows: PeriodTotals[]; selected: PeriodKey; onSelect: (p: PeriodKey) => void }) {
  const W = 300;
  const H = 140;
  const col = W / rows.length;
  const barW = col * 0.52;
  const max = Math.max(1, ...rows.map((r) => Math.max(r.spent, r.income))) * 1.08;
  const y = (v: number) => H - (Math.max(0, v) / max) * H;
  const last = rows.length - 1;
  return (
    <div className="rpt-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={R.chartAria}>
        <line x1="0" x2={W} y1={H - 0.5} y2={H - 0.5} className="rpt-axis" />
        {rows.map((r, i) => {
          const cx = col * i + col / 2;
          const top = y(r.spent);
          const cls = ['rpt-bar', r.period === selected && 'is-sel', i === last && 'is-partial'].filter(Boolean).join(' ');
          return (
            <g key={r.period}>
              {r.spent > 0 && (
                <rect className={cls} x={cx - barW / 2} y={top} width={barW} height={H - top} rx="5" style={{ fill: chartColor(0, 1) }} />
              )}
              {r.income > 0 && <line className="rpt-income" x1={cx - col * 0.4} x2={cx + col * 0.4} y1={y(r.income)} y2={y(r.income)} />}
            </g>
          );
        })}
      </svg>
      <div className="rpt-cols">
        {rows.map((r, i) => (
          <button
            key={r.period}
            aria-pressed={r.period === selected}
            aria-label={t(R.barAria, { month: periodLabel(r.period), spent: money(r.spent), income: money(r.income) })}
            onClick={() => onSelect(r.period)}
          >
            <span>{monthShort(r.period)}</span>
            {i === last && <i aria-hidden="true" />}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Biểu đồ nhỏ 6 cột của một danh mục, vạch đứt là trung bình. */
function CategoryChart({ points, avg, color, name }: { points: { period: PeriodKey; value: number }[]; avg: number; color: string; name: string }) {
  const W = 300;
  const H = 72;
  const col = W / points.length;
  const barW = col * 0.46;
  const max = Math.max(1, avg, ...points.map((p) => p.value)) * 1.1;
  const y = (v: number) => H - (Math.max(0, v) / max) * H;
  const last = points.length - 1;
  return (
    <div className="rpt-mini">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t(R.catAria, { name })}>
        <line x1="0" x2={W} y1={H - 0.5} y2={H - 0.5} className="rpt-axis" />
        {points.map((p, i) => {
          const cx = col * i + col / 2;
          const top = y(p.value);
          return p.value > 0 ? (
            <rect key={p.period} className={i === last ? 'rpt-bar is-sel is-partial' : 'rpt-bar is-sel'} x={cx - barW / 2} y={top} width={barW} height={H - top} rx="4" style={{ fill: color }} />
          ) : null;
        })}
        {avg > 0 && <line className="rpt-avg" x1="0" x2={W} y1={y(avg)} y2={y(avg)} />}
      </svg>
      <div className="rpt-labels">
        {points.map((p) => (
          <span key={p.period}>{monthShort(p.period)}</span>
        ))}
      </div>
    </div>
  );
}

export function Report() {
  const { data } = useStore();
  const s = data.settings;
  const today = todayISO();
  const current = monthOf(today);
  const periods = useMemo(() => lastPeriods(today, s, N), [today, s]);
  const rows = useMemo(() => trend(data, periods), [data, periods]);
  const [selected, setSelected] = useState<PeriodKey>(current);
  const top = useMemo(() => topCategories(data, periods, 6), [data, periods]);
  const [catId, setCatId] = useState<string | null>(null);
  const [showRecap, setShowRecap] = useState(false);

  const name = (id: string) => data.categories.find((c) => c.id === id)?.name ?? R.otherCategory;

  if (rows.every((r) => r.spent === 0 && r.income === 0)) {
    return (
      <div className="stack">
        <section className="card rpt-empty">
          <b>{R.emptyTitle}</b>
          <p className="hint">{R.emptyText}</p>
        </section>
      </div>
    );
  }

  const now = rows[rows.length - 1];
  const prev = periodTotals(data, shiftPeriod(current, -1));
  const change = pctChange(now.spent, prev.spent);
  const rate = savingRate(now);
  const sel = rows.find((r) => r.period === selected) ?? now;
  const selPartial = sel.period === current;
  const notes = insights(data, sel.period, { partial: selPartial });
  const cat = catId && top.some((c) => c.categoryId === catId) ? catId : top[0]?.categoryId;
  const catIdx = top.findIndex((c) => c.categoryId === cat);
  const ct = cat ? categoryTrend(data, cat, periods) : null;

  const sentence = (n: Insight): { text: string; vars: Record<string, string | number> } => {
    switch (n.kind) {
      case 'up':
      case 'down': {
        const up = n.kind === 'up';
        const text = n.months > 1 ? (up ? R.insightUp : R.insightDown) : up ? R.insightUpPrev : R.insightDownPrev;
        return { text, vars: { name: name(n.categoryId), pct: Math.abs(n.pct), n: n.months } };
      }
      case 'top':
        return { text: R.insightTop, vars: { name: name(n.categoryId), amount: money(n.value), pct: n.pct } };
      case 'avg':
        return { text: n.months > 1 ? R.insightAvg : R.insightAvgPrev, vars: { amount: money(n.value), n: n.months } };
    }
  };

  return (
    <div className="stack rpt">
      <button className="btn btn--block recap-btn" onClick={() => setShowRecap(true)}>
        <Icon name="celebration" size={20} /> {L.recap.button}
      </button>
      {showRecap && <RecapSheet period={shiftPeriod(current, -1)} onClose={() => setShowRecap(false)} />}
      <section className="card">
        <header className="rpt-head">
          <h2 className="card-title">{R.nowTitle}</h2>
        </header>
        <div className="rpt-big">
          <small>{R.spent}</small>
          <b>{money(now.spent)}</b>
          {change != null && (
            <span className={change > 0 ? 'neg' : change < 0 ? 'pos' : 'hint'}>
              {change > 0 ? t(R.vsPrevMore, { pct: change }) : change < 0 ? t(R.vsPrevLess, { pct: -change }) : R.vsPrevSame}
            </span>
          )}
        </div>
        <div className="rpt-split">
          <div>
            <small>{R.income}</small>
            <b className="pos">{money(now.income)}</b>
          </div>
          <div>
            <small>{now.saving >= 0 ? R.saving : R.overspent}</small>
            <b className={now.saving < 0 ? 'neg' : ''}>{money(Math.abs(now.saving))}</b>
            {rate != null && rate > 0 && <span className="hint">{t(R.savingRate, { pct: rate })}</span>}
          </div>
        </div>
      </section>

      <Breakdown />

      <section className="card">
        <h2 className="card-title">{R.chartTitle}</h2>
        <div className="rpt-readout" aria-live="polite">
          <span>
            <b>{periodLabel(sel.period)}</b>
            {selPartial && <small className="hint"> · {R.partial}</small>}
          </span>
          <span className="rpt-readout__nums">
            <span>
              <i className="rpt-key rpt-key--spent" style={{ background: chartColor(0, 1) }} />
              {money(sel.spent)}
            </span>
            {sel.income > 0 && (
              <span>
                <i className="rpt-key rpt-key--income" />
                {money(sel.income)}
              </span>
            )}
          </span>
        </div>
        <TrendChart rows={rows} selected={sel.period} onSelect={setSelected} />
        <div className="rpt-legend hint">
          <span>
            <i className="rpt-key rpt-key--spent" style={{ background: chartColor(0, 1) }} />
            {R.legendSpent}
          </span>
          <span>
            <i className="rpt-key rpt-key--income" />
            {R.legendIncome}
          </span>
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">{R.insightsTitle}</h2>
        {notes.length ? (
          <ul className="rpt-notes">
            {notes.map((n, i) => {
              const { text, vars } = sentence(n);
              return (
                <li key={i} className={`rpt-note rpt-note--${n.kind}`}>
                  <Rich text={text} vars={vars} />
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="hint">{R.insightsNone}</p>
        )}
      </section>

      {ct && cat && (
        <section className="card">
          <h2 className="card-title">{R.catTitle}</h2>
          <div className="chips rpt-chips">
            {top.map((c) => (
              <button key={c.categoryId} className="chip" aria-pressed={c.categoryId === cat} onClick={() => setCatId(c.categoryId)}>
                {name(c.categoryId)}
              </button>
            ))}
          </div>
          <CategoryChart points={ct.points} avg={ct.avg} color={chartColor(catIdx, top.length)} name={name(cat)} />
          {ct.avg > 0 && <p className="hint rpt-avg-text">{t(R.catAvg, { amount: money(ct.avg) })}</p>}
        </section>
      )}
    </div>
  );
}
