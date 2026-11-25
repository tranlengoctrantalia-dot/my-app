import { Fragment, useState } from 'react';
import { sum, todayISO } from '../domain/calc';
import { buildPlan, check, type Incoming } from '../domain/advice';
import { bufferHave } from '../domain/coach';
import { dm, money } from '../domain/format';
import { personName } from '../domain/split';
import { useLookups, useStore } from '../store';
import { L } from '../labels';
import { t } from '../i18n';
import { Sheet } from './ui';
import { Piggy } from './Piggy';

const P = L.plan;
/** Thanh kéo ăn tiêu mỗi ngày: 0 → 500k, bước 5k. */
const MAX_PER_DAY = 500_000;
const STEP = 5_000;

/** Gom tiền sắp nhận theo người: tổng, ngày cần nhận sớm nhất, có trễ hẹn không. */
function byPerson(list: Incoming[]) {
  const m = new Map<string, { amount: number; date: string; late: boolean }>();
  for (const i of list) {
    const cur = m.get(i.person);
    m.set(i.person, cur ? { ...cur, amount: cur.amount + i.amount, date: i.date < cur.date ? i.date : cur.date } : { amount: i.amount, date: i.date, late: i.late });
  }
  return [...m.entries()].sort((a, b) => a[1].date.localeCompare(b[1].date));
}

/**
 * "Khả năng thanh toán": Tiền có − Tiền phải trả = Dư / Thiếu, viết cho người không làm tài chính.
 * Kéo thanh "ăn tiêu mỗi ngày" để xem kết quả đổi theo.
 */
export function PayPlanSheet({ onClose, onCards }: { onClose: () => void; onCards: () => void }) {
  const { data, dispatch } = useStore();
  const { category } = useLookups();
  const plan = buildPlan(data, todayISO());
  // Mặc định theo Ngân sách (chi linh hoạt còn lại ÷ số ngày còn lại); kéo để thử mức khác.
  const [perDay, setPerDay] = useState(Math.min(MAX_PER_DAY, Math.round(plan.flexPerDay / STEP) * STEP));
  // Người đang sửa ngày hẹn trả.
  const [editing, setEditing] = useState<string | null>(null);
  const r = check(plan, perDay);
  const buffer = bufferHave(data, plan.today);
  // Tiền nhận lại cho hóa đơn tháng sau: không tính tháng này (thẻ đó cũng chưa phải trả).
  const people = byPerson(plan.incoming.filter((i) => i.date <= plan.monthEnd));
  const setPromise = (id: string, date: string) => {
    const rest = { ...(data.settings.promises ?? {}) };
    if (date) rest[id] = date;
    else delete rest[id];
    dispatch({ type: 'settings', patch: { promises: rest } });
  };
  const row = (label: string, amount: number, hint?: string, key = label, onClick?: () => void) => (
    <div key={key} onClick={onClick} className={onClick ? 'payplan__tap' : undefined}>
      <dt>
        {label}
        {hint && <small className="payplan__hint">{hint}</small>}
      </dt>
      <dd>{money(amount)}</dd>
    </div>
  );
  const total = (label: string, amount: number) => (
    <div className="ledger__total">
      <dt>{label}</dt>
      <dd>{money(amount)}</dd>
    </div>
  );

  return (
    <Sheet title={t(P.title, { month: Number(plan.month.slice(5, 7)) })} onClose={onClose}>
      <div className="payplan">
        {/* Kết quả + thanh kéo ăn tiêu: nhìn 5 giây là biết đủ hay thiếu. */}
        <div className="payplan__stick">
          <div className="payplan__head">
            <Piggy mood={r.left < 0 ? 'sad' : 'happy'} size={68} />
            <div>
              <p className={`payplan__big ${r.left < 0 ? 'neg' : 'pos'}`}>{t(r.left < 0 ? P.short : P.surplus, { amount: money(Math.abs(r.left)) })}</p>
              {r.left < 0 && r.savings > 0 && (
                <p className={`payplan__alt ${r.leftNoSaving < 0 ? 'neg' : 'pos'}`}>
                  {t(r.leftNoSaving < 0 ? P.noSavingShort : P.noSavingOk, { saving: money(r.savings), amount: money(Math.abs(r.leftNoSaving)) })}
                </p>
              )}
            </div>
          </div>
          <h4>{t(P.perDay, { amount: money(perDay) })}</h4>
          <input type="range" min={0} max={MAX_PER_DAY} step={STEP} value={perDay} onChange={(e) => setPerDay(Number(e.target.value))} aria-label={P.perDayAria} className="payplan__range" />
          <p className="payplan__note">
            {plan.flexOver > 0 && (
              <>
                {t(P.flexOver, { amount: money(plan.flexOver) })}
                {' · '}
              </>
            )}
            {r.maxPerDay > 0 ? t(P.maxPerDay, { amount: money(r.maxPerDay) }) : P.noRoom}
            {plan.flexPerDay > 0 && perDay !== plan.flexPerDay && (
              <>
                {' · '}
                <button type="button" className="link" onClick={() => setPerDay(plan.flexPerDay)}>
                  {t(P.backToBudget, { amount: money(plan.flexPerDay) })}
                </button>
              </>
            )}
          </p>
        </div>

        <section>
          <h4>{P.have}</h4>
          <dl className="ledger ledger--sheet">
            {row(P.cash, plan.cash)}
            {plan.salary && row(t(P.salary, { date: dm(plan.salary.date) }), plan.salary.amount)}
            {people.map(([id, v]) => (
              <Fragment key={id}>
                {row(
                  t(P.paysBack, { name: personName(data.settings, id) }),
                  v.amount,
                  v.late ? t(P.late, { date: dm(v.date) }) : t(P.needBy, { date: dm(v.date) }),
                  id,
                  () => setEditing(editing === id ? null : id),
                )}
                {editing === id && (
                  <div className="payplan__promise">
                    <label>
                      <span>{P.promiseLabel}</span>
                      <input type="date" value={data.settings.promises?.[id] ?? ''} onChange={(e) => setPromise(id, e.target.value)} />
                    </label>
                  </div>
                )}
              </Fragment>
            ))}
            {total(P.haveTotal, r.have)}
          </dl>
        </section>

        <section>
          <h4>{P.pay}</h4>
          <dl className="ledger ledger--sheet">
            {plan.fixed.map((f) => row(category(f.categoryId)?.name ?? '', f.amount, undefined, f.categoryId))}
            {plan.cards.map((c) => row(t(P.card, { card: c.name, date: dm(c.due) }), c.amount, undefined, c.id))}
            {r.spend > 0 && row(t(P.spend, { perDay: money(perDay), days: plan.days }), r.spend)}
            {total(P.payTotal, r.pay)}
          </dl>
        </section>

        {/* Điều kiện: tiền người khác trả lại phải về đúng hạn thì kết quả trên mới đúng. */}
        {(people.some(([, v]) => !v.late) || r.dip) && (
          <section>
            <h4>{P.conditions}</h4>
            <ul className="payplan__list">
              {people
                .filter(([, v]) => !v.late)
                .map(([id, v]) => (
                  <li key={id}>{t(P.remind, { name: personName(data.settings, id), amount: money(v.amount), date: dm(v.date) })}</li>
                ))}
              {r.dip && <li>{t(P.dip, { date: dm(r.dip.date), card: r.dip.card, amount: money(r.dip.amount) })}</li>}
            </ul>
            {sum(plan.incoming.filter((i) => i.late).map((i) => i.amount)) > 0 && <p className="payplan__note">{P.lateNote}</p>}
          </section>
        )}

        {r.leftNoSaving < 0 && buffer > 0 && <p className="payplan__note">{t(P.useBuffer, { amount: money(buffer) })}</p>}
        {r.leftNoSaving < 0 && <p className="payplan__note">{t(P.stillShort, { amount: money(-r.leftNoSaving) })}</p>}

        <button className="btn btn--block" onClick={onCards}>
          {L.card.enough.seeCards}
        </button>
      </div>
    </Sheet>
  );
}
