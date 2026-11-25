/** Lịch tiền: ngày lương, hạn trả thẻ, khoản định kỳ, hạn mục tiêu trong tháng. */
import { useState } from 'react';
import { budgetReport, parsePeriod, shiftPeriod, sum, todayISO } from '../domain/calc';
import { dm, money, periodLabel } from '../domain/format';
import { moneyEvents, type MoneyEvent } from '../domain/insights';
import { useStore } from '../store';
import { Card, Empty } from '../components/ui';
import { Icon, type IconName } from '../components/icons';
import { L } from '../labels';

const C = L.calendar;
export const eventLabels = { salary: C.salary, card: C.card };
export const eventIcon: Record<MoneyEvent['kind'], IconName> = { salary: 'money', card: 'card', recurring: 'calendar', income: 'trending_up', goal: 'flag' };

export function Calendar() {
  const { data } = useStore();
  const today = todayISO();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [picked, setPicked] = useState<string | null>(null);
  const events = moneyEvents(data, month, eventLabels);

  const [y, m] = parsePeriod(month);
  const first = new Date(y, m - 1, 1);
  const lead = (first.getDay() + 6) % 7; // Thứ 2 đứng đầu tuần
  const last = new Date(y, m, 0).getDate();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: last }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)];
  const byDay = (d: string) => events.filter((e) => e.date === d);
  const shown = picked ? events.filter((e) => e.date === picked) : events;
  // Khoản cố định không có ngày riêng: còn phải chi bao nhiêu trong tháng (cùng số với Khả năng thanh toán).
  const fixedLeft =
    month < today.slice(0, 7) ? 0 : sum(budgetReport(data, month).rows.filter((r) => r.remaining > 0 && data.categories.find((c) => c.id === r.categoryId)?.kind === 'fixed').map((r) => r.remaining));
  const out = fixedLeft + sum(events.filter((e) => !e.incoming).map((e) => e.amount ?? 0));
  const inc = sum(events.filter((e) => e.incoming).map((e) => e.amount ?? 0));

  return (
    <div className="stack">
      <div className="period">
        <button className="icon-btn" aria-label={L.common.prevPeriod} onClick={() => (setMonth(shiftPeriod(month, -1)), setPicked(null))}>
          <Icon name="left" />
        </button>
        <div className="period__label">
          <strong>{periodLabel(month)}</strong>
          <small>{y}</small>
        </div>
        <button className="icon-btn" aria-label={L.common.nextPeriod} onClick={() => (setMonth(shiftPeriod(month, 1)), setPicked(null))}>
          <Icon name="right" />
        </button>
      </div>

      <Card>
        <div className="cal">
          {C.weekdays.split(',').map((w) => (
            <span key={w} className="cal__wd">
              {w}
            </span>
          ))}
          {cells.map((d, i) =>
            d ? (
              <button
                key={d}
                className={`cal__day${d === today ? ' cal__day--today' : ''}`}
                aria-pressed={picked === d}
                onClick={() => setPicked(picked === d ? null : d)}
              >
                {Number(d.slice(8))}
                <span className="cal__dots">
                  {byDay(d)
                    .slice(0, 3)
                    .map((e, j) => (
                      <i key={j} className={`cal__dot cal__dot--${e.kind}`} />
                    ))}
                </span>
              </button>
            ) : (
              <span key={`x${i}`} />
            ),
          )}
        </div>
        {(out > 0 || inc > 0) && (
          <div className="cal__sum">
            <span>
              {C.totalOut} <b>{money(out)}</b>
            </span>
            <span>
              {C.totalIn} <b className="pos">{money(inc)}</b>
            </span>
          </div>
        )}
      </Card>

      <Card title={picked ? dm(picked) : C.listTitle}>
        {shown.length === 0 && !(fixedLeft > 0 && !picked) ? (
          <Empty art="calendar_month">{C.empty}</Empty>
        ) : (
          <ul className="plain-list">
            {fixedLeft > 0 && !picked && (
              <li>
                <div className="row-btn row-btn--icon row-btn--static">
                  <span className="cal__icon cal__icon--recurring">
                    <Icon name="calendar" size={18} />
                  </span>
                  <span>
                    <b>{C.fixedLeft}</b>
                  </span>
                  <b>{money(fixedLeft)}</b>
                </div>
              </li>
            )}
            {shown.map((e, i) => (
              <li key={i}>
                <div className={`row-btn row-btn--icon row-btn--static${e.date < today ? ' cal__past' : ''}`}>
                  <span className={`cal__icon cal__icon--${e.kind}`}>
                    <Icon name={eventIcon[e.kind]} size={18} />
                  </span>
                  <span>
                    <b>{e.title}</b>
                    <small>{e.date === today ? C.today : dm(e.date)}</small>
                  </span>
                  {e.amount ? <b className={e.incoming ? 'pos' : ''}>{(e.incoming ? '+' : '') + money(e.amount)}</b> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
