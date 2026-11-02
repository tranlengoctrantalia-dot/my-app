/** Tổng kết một tháng: tiêu bao nhiêu, so với tháng trước, mục nào nhiều nhất, vài con số vui. */
import { useState } from 'react';
import { shiftPeriod } from '../domain/calc';
import { money, periodLabel } from '../domain/format';
import { recap } from '../domain/insights';
import type { PeriodKey } from '../domain/types';
import { useLookups, useStore } from '../store';
import { Sheet } from './ui';
import { CatBadge, Icon } from './icons';
import { chartColor } from './Donut';
import { L } from '../labels';
import { Rich, t } from '../i18n';

const R = L.recap;

export function RecapSheet({ period: initial, onClose }: { period: PeriodKey; onClose: () => void }) {
  const { data } = useStore();
  const { category } = useLookups();
  const [period, setPeriod] = useState(initial);
  const r = recap(data, period);
  const month = periodLabel(period);

  return (
    <Sheet title={t(R.title, { month })} onClose={onClose}>
      <div className="recap">
        <div className="period recap__nav">
          <button className="icon-btn" aria-label={R.prev} onClick={() => setPeriod(shiftPeriod(period, -1))}>
            <Icon name="left" />
          </button>
          <div className="period__label">
            <strong>{month}</strong>
          </div>
          <button className="icon-btn" aria-label={R.next} disabled={period >= initial} onClick={() => setPeriod(shiftPeriod(period, 1))}>
            <Icon name="right" />
          </button>
        </div>

        {r.count === 0 ? (
          <p className="empty">{R.empty}</p>
        ) : (
          <>
            <section className="recap__hero">
              <small>{R.spent}</small>
              <b>{money(r.spent)}</b>
              {r.vsPrev !== null && (
                <span>{r.vsPrev > 0 ? t(R.vsMore, { pct: r.vsPrev }) : r.vsPrev < 0 ? t(R.vsLess, { pct: -r.vsPrev }) : R.vsSame}</span>
              )}
              {r.income > 0 && (
                <span className="recap__pills">
                  <span>
                    {R.income} <b>{money(r.income)}</b>
                  </span>
                  <span>
                    {r.saving >= 0 ? R.saving : R.overspent} <b>{money(Math.abs(r.saving))}</b>
                  </span>
                </span>
              )}
            </section>

            {r.top.length > 0 && (
              <section className="card">
                <h2 className="card-title">{R.topTitle}</h2>
                <ul className="recap__top">
                  {r.top.map((x, i) => (
                    <li key={x.categoryId}>
                      <span className="recap__rank">{i + 1}</span>
                      <CatBadge id={x.categoryId} size={36} />
                      <span className="recap__name">
                        <b>{category(x.categoryId)?.name ?? x.categoryId}</b>
                        <span className="recap__bar">
                          <span style={{ width: `${x.pct}%`, background: chartColor(i, 3) }} />
                        </span>
                      </span>
                      <span className="recap__amt">
                        <b>{money(x.amount)}</b>
                        <small>{x.pct}%</small>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="card">
              <h2 className="card-title">{R.statsTitle}</h2>
              <ul className="recap__stats">
                <li>
                  <Icon name="receipt" size={20} />
                  <span><Rich text={R.count} vars={{ n: r.count }} /></span>
                </li>
                <li>
                  <Icon name="star" size={20} />
                  <span><Rich text={R.noSpend} vars={{ n: r.noSpendDays, total: r.totalDays }} /></span>
                </li>
                {r.biggest && (
                  <li>
                    <Icon name="trending_up" size={20} />
                    <span><Rich text={R.biggest} vars={{ name: r.biggest.merchant, amount: money(r.biggest.amount) }} /></span>
                  </li>
                )}
                {r.budget.total > 0 && (
                  <li>
                    <Icon name="target" size={20} />
                    <span><Rich text={R.budgetKept} vars={{ kept: r.budget.kept, total: r.budget.total }} /></span>
                  </li>
                )}
                {r.goalsSaved > 0 && (
                  <li>
                    <Icon name="flag" size={20} />
                    <span><Rich text={R.goals} vars={{ amount: money(r.goalsSaved) }} /></span>
                  </li>
                )}
              </ul>
            </section>
          </>
        )}
      </div>
    </Sheet>
  );
}
