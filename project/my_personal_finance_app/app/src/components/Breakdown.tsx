/** Tháng này chi vào đâu: biểu đồ tròn + thanh từng danh mục (màu theo màu chủ đạo). */
import { budgetReport, monthOf, todayISO } from '../domain/calc';
import { money } from '../domain/format';
import { useLookups, useStore } from '../store';
import { Donut, chartColor } from './Donut';
import { L } from '../labels';

export function Breakdown() {
  const { data } = useStore();
  const { category } = useLookups();
  const period = monthOf(todayISO());
  const report = budgetReport(data, period);
  const byCat = [...report.rows, ...report.unbudgeted]
    .filter((r) => category(r.categoryId)?.kind === 'spend' && r.spent > 0)
    .sort((a, b) => b.spent - a.spent);
  if (!byCat.length) return null;
  const spent = byCat.reduce((a, r) => a + r.spent, 0);
  const max = Math.max(1, ...byCat.map((r) => r.spent));
  return (
    <section className="card">
      <h2 className="card-title">{L.home.breakdownTitle}</h2>
      <div className="breakdown">
        <Donut slices={byCat.map((r, i) => ({ id: r.categoryId, value: r.spent, color: chartColor(i, byCat.length) }))} total={spent} label={L.home.donutTotal} />
        <ul className="bars">
          {byCat.map((r, i) => (
            <li key={r.categoryId}>
              <div className="bars__row">
                <span>
                  <i style={{ background: chartColor(i, byCat.length) }} />
                  {category(r.categoryId)?.name}
                </span>
                <b className={r.remaining < 0 && r.limit > 0 ? 'neg' : ''}>{money(r.spent)}</b>
              </div>
              <div className="bars__track">
                <div style={{ width: `${(r.spent / max) * 100}%`, background: chartColor(i, byCat.length) }} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
