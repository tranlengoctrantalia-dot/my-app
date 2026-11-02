import { useMemo, useState } from 'react';
import { periodRange, installmentActive, installmentPayment, installmentProgress, periodInfo, shiftPeriod, statement } from '../domain/calc';
import { dm, money, periodLabel, uid } from '../domain/format';
import type { Installment, PeriodKey, Transaction } from '../domain/types';
import { useLookups, useStore } from '../store';
import { Card, Empty, MoneyInput, PeriodPicker, Sheet } from '../components/ui';
import { CatBadge } from '../components/icons';
import { TxRow } from './Transactions';
import { ReconcileSheet } from '../components/Reconcile';
import { Icon } from '../components/icons';
import { L } from '../labels';
import { t } from '../i18n';

export function CardStatement({
  period,
  setPeriod,
  onEdit,
  onPay,
}: {
  period: PeriodKey;
  setPeriod: (p: PeriodKey) => void;
  onEdit: (t: Transaction) => void;
  /** Ghi trả thẻ: mở form Chuyển, điền sẵn số tiền + thẻ. */
  onPay: (amount: number, cardId: string) => void;
}) {
  const { data } = useStore();
  const { category } = useLookups();
  const credit = data.accounts.filter((a) => a.kind === 'credit');
  const [accountId, setAccountId] = useState(credit[0]?.id ?? '');
  const [editing, setEditing] = useState<Installment | 'new' | null>(null);
  const [showTx, setShowTx] = useState(false);
  // Danh mục đang mở xem từng giao dịch.
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [reconciling, setReconciling] = useState(false);
  const info = periodInfo(period, data.settings);
  const st = statement(data, period, accountId);
  // Chỉ trả góp của thẻ đang chọn (mỗi khoản gắn với 1 thẻ).
  const installments = data.installments.filter((i) => i.accountId === accountId);

  // Tiền trên thẻ theo từng danh mục (tính cả phần người yêu / công ty trả hộ, vì thẻ bị trừ đủ).
  const byCategory = useMemo(() => {
    const m = new Map<string, { total: number; count: number }>();
    for (const t of st.transactions) {
      const cur = m.get(t.categoryId) ?? { total: 0, count: 0 };
      m.set(t.categoryId, { total: cur.total + t.amount, count: cur.count + 1 });
    }
    return [...m.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [st.transactions]);

  return (
    <div className="stack">
      <PeriodPicker value={period} onChange={setPeriod} hint={periodRange(period, data.settings)} />
      {credit.length > 1 && (
        <select value={accountId} onChange={(e) => setAccountId(e.target.value)} aria-label={L.card.chooseCard}>
          {credit.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      )}

      <Card tone="accent">
        <p className="eyebrow">{t(L.card.due, { date: dm(info.due) })}</p>
        <p className="hero-amount">{money(st.total)}</p>
        <dl className="ledger ledger--on-accent">
          <div>
            <dt>{t(L.card.txCount, { count: st.transactions.filter((x) => x.amount > 0).length })}</dt>
            <dd>{money(st.purchases)}</dd>
          </div>
          {st.refunds !== 0 && (
            <div>
              <dt>{L.card.refunds}</dt>
              <dd>{money(st.refunds)}</dd>
            </div>
          )}
          {st.installments.map(({ item, amount }) => (
            <div key={item.id}>
              <dt>{t(L.card.installmentLine, { name: item.name })}</dt>
              <dd>{money(amount)}</dd>
            </div>
          ))}
        </dl>
        {st.total > 0 && (
          <button className="btn btn--on-accent" onClick={() => onPay(st.total, accountId)}>
            {L.card.payButton}
          </button>
        )}
      </Card>

      <button className="btn btn--block recon-btn" onClick={() => setReconciling(true)}>
        <Icon name="fact_check" size={20} /> {L.reconcile.button}
      </button>
      {reconciling && <ReconcileSheet accountId={accountId} onEdit={onEdit} onClose={() => setReconciling(false)} />}

      {byCategory.length > 0 && (
        <Card title={L.card.byCategory}>
          <ul className="plain-list">
            {byCategory.map(([id, v]) => (
              <li key={id}>
                <button className="row-btn row-btn--icon" aria-expanded={openCat === id} onClick={() => setOpenCat(openCat === id ? null : id)}>
                  <CatBadge id={id} size={36} />
                  <span>
                    <b>{category(id)?.name ?? id}</b>
                    <small>{t(L.card.txUnit, { count: v.count })}</small>
                  </span>
                  <b className={v.total < 0 ? 'pos' : ''}>{money(v.total)}</b>
                  <Icon name="right" size={18} className={`muted chevron${openCat === id ? ' chevron--open' : ''}`} />
                </button>
                {openCat === id && (
                  <ul className="tx-list cat-tx">
                    {st.transactions
                      .filter((x) => x.categoryId === id)
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .map((x) => (
                        <TxRow key={x.id} t={x} date onClick={() => onEdit(x)} />
                      ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card
        title={L.card.installments}
        action={
          <button className="link" onClick={() => setEditing('new')}>
            {L.card.add}
          </button>
        }
      >
        {installments.length === 0 ? (
          <Empty>{L.card.empty}</Empty>
        ) : (
          <ul className="plain-list">
            {installments.map((i) => {
              const prog = installmentProgress(i, period);
              return (
                <li key={i.id}>
                  <button className="row-btn" onClick={() => setEditing(i)}>
                    <span>
                      <b>{i.name}</b>
                      <small>
                        {prog
                          ? prog.left > 0
                            ? t(L.card.progress, { paid: prog.paid, months: i.months!, amount: money(prog.amountLeft) })
                            : t(L.card.paidOff, { period: periodLabel(shiftPeriod(i.firstPeriod, i.months! - 1)) })
                          : L.card.tapToSetTerm}
                        {i.ratePerYear ? ` · ${t(L.card.rate, { rate: i.ratePerYear })}` : ''}
                        {!installmentActive(i, period) && prog && prog.paid === 0 && ` · ${L.card.notStarted}`}
                      </small>
                    </span>
                    <b>{money(i.monthly)}</b>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card
        title={t(L.card.txCount, { count: st.transactions.length })}
        action={
          st.transactions.length > 0 && (
            <button className="link" onClick={() => setShowTx((v) => !v)}>
              {showTx ? L.card.hide : L.card.show}
            </button>
          )
        }
      >
        {st.transactions.length === 0 ? (
          <Empty>{L.card.empty}</Empty>
        ) : (
          showTx && (
            <ul className="tx-list">
              {[...st.transactions]
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((t) => (
                  <TxRow key={t.id} t={t} onClick={() => onEdit(t)} />
                ))}
            </ul>
          )
        )}
      </Card>
      {editing && (
        <InstallmentForm item={editing === 'new' ? undefined : editing} defaultPeriod={period} defaultCard={accountId} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

const TERMS = [3, 6, 9, 12, 18, 24, 36];

function InstallmentForm({
  item,
  defaultPeriod,
  defaultCard,
  onClose,
}: {
  item?: Installment;
  defaultPeriod: PeriodKey;
  defaultCard: string;
  onClose: () => void;
}) {
  const { data, dispatch } = useStore();
  const credit = data.accounts.filter((a) => a.kind === 'credit');
  const [name, setName] = useState(item?.name ?? '');
  const [principal, setPrincipal] = useState(item?.principal ?? 0);
  const [months, setMonths] = useState(item?.months ?? 0);
  const [rate, setRate] = useState(item?.ratePerYear?.toString() ?? '0');
  const [fee, setFee] = useState(item?.fee ?? 0);
  const [firstPeriod, setFirstPeriod] = useState(item?.firstPeriod ?? defaultPeriod);
  const [accountId, setAccountId] = useState(item?.accountId ?? (defaultCard || credit[0]?.id) ?? '');
  // Mỗi kỳ: tự tính từ gốc + kỳ hạn + lãi; người dùng sửa tay thì giữ số đã sửa (theo đúng sao kê ngân hàng).
  const [manualMonthly, setManualMonthly] = useState(() =>
    item && item.monthly !== installmentPayment(item.principal ?? 0, item.months ?? 0, item.ratePerYear) ? item.monthly : 0,
  );
  const rateNum = Number(rate.replace(',', '.')) || 0;
  const auto = installmentPayment(principal, months, rateNum);
  const monthly = manualMonthly || auto;
  const total = monthly * months + fee;

  function save() {
    const id = item?.id ?? uid();
    const categoryId = item?.categoryId ?? `inst-${id}`;
    dispatch({
      type: 'upsertInstallment',
      item: {
        id,
        name: name.trim(),
        monthly,
        firstPeriod,
        months: months || null,
        accountId,
        categoryId,
        principal: principal || undefined,
        ratePerYear: rateNum || undefined,
        fee: fee || undefined,
      },
      // Mỗi khoản trả góp có danh mục riêng để đặt ngân sách.
      category: item ? undefined : { id: categoryId, name: t(L.card.categoryName, { name: name.trim() }), icon: '', kind: 'installment' },
    });
    onClose();
  }

  return (
    <Sheet title={item ? L.card.editTitle : L.card.addTitle} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim() && monthly > 0) save();
        }}
      >
        <label className="field">
          <span>{L.card.name}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={L.card.namePlaceholder} required />
        </label>
        <label className="field">
          <span>{L.card.principal}</span>
          <MoneyInput value={principal} onChange={setPrincipal} placeholder={L.card.principalPlaceholder} />
        </label>
        <fieldset className="field">
          <legend>{L.card.term}</legend>
          <div className="chips">
            {TERMS.map((n) => (
              <button type="button" key={n} className="chip" aria-pressed={months === n} onClick={() => setMonths(n)}>
                {n}
              </button>
            ))}
            <input
              className="chip chip--input"
              type="number"
              min={1}
              inputMode="numeric"
              placeholder={L.card.termOther}
              value={TERMS.includes(months) || !months ? '' : months}
              onChange={(e) => setMonths(Number(e.target.value) || 0)}
              aria-label={L.card.termOtherAria}
            />
          </div>
        </fieldset>
        <div className="field-row">
          <label className="field">
            <span>{L.card.ratePerYear}</span>
            <input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="0" />
          </label>
          <label className="field">
            <span>{L.card.fee}</span>
            <MoneyInput value={fee} onChange={setFee} placeholder="0" />
          </label>
        </div>
        <label className="field">
          <span>{L.card.monthly} {manualMonthly ? L.card.monthlyManual : auto ? L.card.monthlyAuto : ''}</span>
          <MoneyInput value={monthly} onChange={setManualMonthly} />
        </label>
        {manualMonthly > 0 && auto > 0 && manualMonthly !== auto && (
          <button type="button" className="link" onClick={() => setManualMonthly(0)}>
            {t(L.card.useAuto, { amount: money(auto) })}
          </button>
        )}
        <div className="field-row">
          <label className="field">
            <span>{L.card.firstPeriod}</span>
            <input type="month" value={firstPeriod} onChange={(e) => setFirstPeriod(e.target.value)} required />
          </label>
          <label className="field">
            <span>{L.card.card}</span>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {credit.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {months > 0 && monthly > 0 && (
          <p className="hint">
            {t(L.card.totalPay, { amount: money(total) })}
            {principal > 0 && total > principal && ` · ${t(L.card.interestFee, { amount: money(total - principal) })}`} ·{' '}
            {t(L.card.paidOffBy, { period: periodLabel(shiftPeriod(firstPeriod, months - 1)) })}
          </p>
        )}
        <button className="btn btn--primary btn--block" type="submit" disabled={!name.trim() || monthly <= 0}>
          {L.card.save}
        </button>
        {item && (
          <button
            type="button"
            className="btn btn--danger-ghost btn--block"
            onClick={() => {
              if (confirm(t(L.card.deleteConfirm, { name: item.name }))) {
                dispatch({ type: 'deleteInstallment', id: item.id });
                onClose();
              }
            }}
          >
            {L.card.delete}
          </button>
        )}
      </form>
    </Sheet>
  );
}
