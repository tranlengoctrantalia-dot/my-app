import { useMemo, useState } from 'react';
import { cardSettings, INSTALLMENT_TERMS, otherShare, sum, statementPaid, periodRange, installmentActive, installmentPayment, installmentProgress, periodInfo, shiftPeriod, statement } from '../domain/calc';
import { dm, money, periodLabel } from '../domain/format';
import type { Account, Installment, PeriodKey, Transaction } from '../domain/types';
import { useLookups, useStore } from '../store';
import { Card, Empty, MoneyInput, PeriodPicker, Sheet } from '../components/ui';
import { TxRow } from './Transactions';
import { ReconcileSheet } from '../components/Reconcile';
import { Art, CatBadge, Icon } from '../components/icons';
import { AccountForm } from '../components/Manage';
import { L } from '../labels';
import { t } from '../i18n';
import { budgetRoom } from '../domain/coach';
import { personName, splitsOf } from '../domain/split';

export function CardStatement({
  period,
  setPeriod,
  onEdit,
  onPay,
  onAddInstallment,
}: {
  period: PeriodKey;
  setPeriod: (p: PeriodKey) => void;
  onEdit: (t: Transaction) => void;
  /** Ghi trả thẻ: mở form Chuyển, điền sẵn số tiền + thẻ. */
  onPay: (amount: number, cardId: string) => void;
  /** Thêm trả góp: mở form ghi chi, bật sẵn công tắc Trả góp với thẻ này. */
  onAddInstallment: (cardId: string) => void;
}) {
  const { data, dispatch } = useStore();
  const { category } = useLookups();
  const credit = data.accounts.filter((a) => a.kind === 'credit');
  // '' = tất cả thẻ. Thẻ vừa bị xoá thì tự về mặc định.
  const [picked, setPicked] = useState('');
  const accountId = credit.some((a) => a.id === picked) ? picked : credit.length > 1 ? '' : credit[0]?.id ?? '';
  const all = !accountId;
  const [editing, setEditing] = useState<Installment | null>(null);
  const [cardForm, setCardForm] = useState<Account | 'new' | null>(null);
  const [details, setDetails] = useState(false);
  // Danh mục đang mở xem từng giao dịch.
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [reconciling, setReconciling] = useState(false);
  // Thẻ có ngày chốt / hạn trả riêng thì kỳ tính theo thẻ đó.
  const cs = cardSettings(data, accountId || undefined);
  const info = periodInfo(period, cs);
  const st = statement(data, period, accountId);
  // Đã chuyển trả thẻ cho kỳ này → số to là số CÒN phải trả.
  const paid = statementPaid(data, period, accountId);
  const toPay = Math.max(0, st.total - paid);
  const settleKey = `${accountId}:${period}`;
  // Chỉ đánh dấu bằng tay (bản cũ) mới có nút bỏ; trả bằng nút "Đã trả thẻ" thì xóa khoản trả ở Sổ chi.
  const settled = !!data.settings.cardSettled?.includes(settleKey);
  const setSettled = (on: boolean) => {
    const rest = (data.settings.cardSettled ?? []).filter((k) => k !== settleKey);
    dispatch({ type: 'settings', patch: { cardSettled: on ? [...rest, settleKey] : rest } });
  };
  // Phần người khác chịu trong các khoản trên thẻ (ngân hàng vẫn đòi đủ, nhưng không phải tiền mình tiêu).
  const others = sum(st.transactions.map(otherShare));
  // Từng người: phần của họ trên thẻ kỳ này, còn nợ bao nhiêu.
  const byPerson = useMemo(() => {
    const m = new Map<string, { share: number; owed: number }>();
    for (const x of st.transactions)
      for (const sp of splitsOf(x)) {
        const cur = m.get(sp.person) ?? { share: 0, owed: 0 };
        m.set(sp.person, { share: cur.share + sp.amount, owed: cur.owed + Math.max(0, sp.amount - sp.paid) });
      }
    return [...m.entries()].filter(([, v]) => v.share > 0).sort((a, b) => b[1].owed - a[1].owed);
  }, [st.transactions]);
  // Chỉ trả góp của thẻ đang chọn (mỗi khoản gắn với 1 thẻ).
  const installments = data.installments.filter((i) => all || i.accountId === accountId);

  // Tiền trên thẻ theo từng danh mục (tính cả phần người yêu / công ty trả hộ, vì thẻ bị trừ đủ).
  const byCategory = useMemo(() => {
    const m = new Map<string, { total: number; count: number }>();
    for (const t of st.transactions) {
      const key = groupOf(t);
      const cur = m.get(key) ?? { total: 0, count: 0 };
      m.set(key, { total: cur.total + t.amount, count: cur.count + 1 });
    }
    return [...m.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [st.transactions]);

  return (
    <div className="stack">
      <PeriodPicker
        value={period}
        onChange={setPeriod}
        label={(p) => t(L.card.cycleLabel, { date: dm(periodInfo(p, cs).due) })}
        hint={t(L.card.cycleRange, { range: periodRange(period, cs) ?? periodLabel(period) })}
      />
      <div className="card-picker">
        <div className="segmented" aria-label={L.card.chooseCard}>
          {credit.length > 1 && (
            <button type="button" aria-pressed={all} onClick={() => setPicked('')}>
              {L.card.allCards}
            </button>
          )}
          {credit.map((a) => (
            <button key={a.id} type="button" aria-pressed={accountId === a.id} onClick={() => setPicked(a.id)}>
              {a.name.replace(/^thẻ\s+/i, '')}
            </button>
          ))}
        </div>
        {!all && (
          <button className="icon-btn" aria-label={L.card.editCard} onClick={() => setCardForm(credit.find((a) => a.id === accountId)!)}>
            <Icon name="edit" size={20} />
          </button>
        )}
        <button className="icon-btn" aria-label={L.card.addCard} onClick={() => setCardForm('new')}>
          <Icon name="plus" />
        </button>
      </div>

      <Card tone="accent">
        <p className="eyebrow">{t(L.card.due, { date: dm(info.due) })}</p>
        <p className="hero-amount">{money(toPay)}</p>
        {all && (
          <dl className="ledger ledger--on-accent">
            {credit.map((a) => {
              const left = Math.max(0, statement(data, period, a.id).total - statementPaid(data, period, a.id));
              return (
                <div key={a.id}>
                  <dt>{a.name}</dt>
                  <dd>{money(left)}</dd>
                </div>
              );
            })}
          </dl>
        )}
        {all ? null : toPay > 0 ? (
          <div className="card-pay">
            <button className="btn btn--on-accent" onClick={() => onPay(toPay, accountId)}>
              {L.card.payButton}
            </button>
          </div>
        ) : (
          st.total > 0 && (
            <p className="eyebrow">
              {L.home.cardPaid}
              {settled && (
                <>
                  {' · '}
                  <button className="link link--on-accent" onClick={() => setSettled(false)}>
                    {L.card.unsettle}
                  </button>
                </>
              )}
            </p>
          )
        )}
        <button className="link link--on-accent card-more" aria-expanded={details} onClick={() => setDetails((v) => !v)}>
          {L.card.details}
          <Icon name="right" size={16} className={`chevron${details ? ' chevron--open' : ''}`} />
        </button>
        {details && (
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
            {others > 0 && (
              <>
                {byPerson.map(([id, v]) => (
                  <div key={id}>
                    <dt>{t(v.owed > 0 ? L.card.personOwes : L.card.personPaid, { name: personName(data.settings, id) })}</dt>
                    <dd>{money(v.owed > 0 ? v.owed : v.share)}</dd>
                  </div>
                ))}
                <div>
                  <dt>{L.card.mineLine}</dt>
                  <dd>{money(st.total - others)}</dd>
                </div>
              </>
            )}
            {st.refundsAfter > 0 && (
              <div>
                <dt>{L.card.refundsAfter}</dt>
                <dd>− {money(st.refundsAfter)}</dd>
              </div>
            )}
            {paid - st.refundsAfter > 0 && (
              <div>
                <dt>{L.card.paidLine}</dt>
                <dd>− {money(Math.min(paid, st.total) - st.refundsAfter)}</dd>
              </div>
            )}
          </dl>
        )}
      </Card>

      {reconciling && <ReconcileSheet accountId={accountId} period={period} onEdit={onEdit} onClose={() => setReconciling(false)} />}

      {byCategory.length > 0 && (
        <Card title={t(L.card.txCount, { count: st.transactions.length })}>
          <ul className="plain-list">
            {byCategory.map(([id, v]) => (
              <li key={id}>
                <button className="row-btn row-btn--icon" aria-expanded={openCat === id} onClick={() => setOpenCat(openCat === id ? null : id)}>
                  <CatBadge id={id} size={36} />
                  <span>
                    <b>{id === LEND ? L.loan.lend : (category(id)?.name ?? id)}</b>
                    <small>{t(L.card.txUnit, { count: v.count })}</small>
                  </span>
                  <b className={v.total < 0 ? 'pos' : ''}>{money(v.total)}</b>
                  <Icon name="right" size={18} className={`muted chevron${openCat === id ? ' chevron--open' : ''}`} />
                </button>
                {openCat === id && (
                  <ul className="tx-list cat-tx">
                    {st.transactions
                      .filter((x) => groupOf(x) === id)
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
          <button className="link" onClick={() => onAddInstallment(accountId || credit[0].id)}>
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
                  <button className="row-btn row-btn--icon" onClick={() => setEditing(i)}>
                    <CatBadge id={i.categoryId} size={36} />
                    <span>
                      <b>{i.name}</b>
                      <small>
                        {prog
                          ? prog.left > 0
                            ? t(L.card.progress, { paid: prog.paid, months: i.months!, amount: money(prog.amountLeft) })
                            : t(L.card.paidOff, { period: periodLabel(shiftPeriod(i.firstPeriod, i.months! - 1)) })
                          : <span className="neg">{L.card.tapToSetTerm}</span>}
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

      {!all && (
        <button className="link recon-link" onClick={() => setReconciling(true)}>
          <Art name="fact_check" size={20} /> {L.reconcile.button}
        </button>
      )}
      {cardForm && <AccountForm cardOnly account={cardForm === 'new' ? undefined : cardForm} onClose={() => setCardForm(null)} onSaved={setPicked} />}
      {editing && <InstallmentForm item={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

/** Nhóm "Cho vay" riêng trong danh mục của thẻ (khoản cho bạn bè vay bằng thẻ). */
const LEND = '__lend';
const groupOf = (t: Transaction) => (t.kind === 'lend' ? LEND : t.categoryId);

/** Sửa khoản trả góp (kỳ hạn, lãi, phí…). Tạo mới ở form ghi chi, công tắc Trả góp. */
export function InstallmentForm({ item, onClose }: { item: Installment; onClose: () => void }) {
  const { data, dispatch } = useStore();
  const credit = data.accounts.filter((a) => a.kind === 'credit');
  const [name, setName] = useState(item.name);
  const [principal, setPrincipal] = useState(item.principal ?? 0);
  const [months, setMonths] = useState(item.months ?? 0);
  const [rate, setRate] = useState(item.ratePerYear?.toString() ?? '0');
  const [fee, setFee] = useState(item.fee ?? 0);
  const [firstPeriod, setFirstPeriod] = useState(item.firstPeriod);
  const [accountId, setAccountId] = useState(item.accountId);
  // Mỗi kỳ: tự tính từ gốc + kỳ hạn + lãi; người dùng sửa tay thì giữ số đã sửa (theo đúng sao kê ngân hàng).
  const [manualMonthly, setManualMonthly] = useState(() =>
    item.monthly !== installmentPayment(item.principal ?? 0, item.months ?? 0, item.ratePerYear) ? item.monthly : 0,
  );
  const rateNum = Number(rate.replace(',', '.')) || 0;
  const auto = installmentPayment(principal, months, rateNum);
  const monthly = manualMonthly || auto;
  const total = monthly * months + fee;
  // Cố vấn theo Ngân sách: thêm trả góp này thì tháng đầu còn được chi linh hoạt bao nhiêu (sửa khoản cũ thì cộng lại phần cũ).
  const room = budgetRoom(data, firstPeriod);
  const roomAfter = room.income > 0 ? room.room + (installmentActive(item, firstPeriod) ? item.monthly : 0) - monthly : undefined;

  function save() {
    dispatch({
      type: 'upsertInstallment',
      item: {
        ...item,
        name: name.trim(),
        monthly,
        firstPeriod,
        months: months || null,
        accountId,
        principal: principal || undefined,
        ratePerYear: rateNum || undefined,
        fee: fee || undefined,
      },
    });
    onClose();
  }

  return (
    <Sheet title={L.card.editTitle} onClose={onClose}>
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
            {INSTALLMENT_TERMS.map((n) => (
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
              value={INSTALLMENT_TERMS.includes(months) || !months ? '' : months}
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
        {roomAfter !== undefined && monthly > 0 && (
          <p className={`hint advice-hint ${roomAfter < room.flexPlanned ? 'neg' : ''}`}>
            {roomAfter < 0
              ? t(L.coach.instOver, { monthly: money(monthly), amount: money(-roomAfter) })
              : t(roomAfter < room.flexPlanned ? L.coach.instTight : L.coach.instOk, { monthly: money(monthly), room: money(roomAfter), planned: money(room.flexPlanned) })}
          </p>
        )}
        <button className="btn btn--primary btn--block" type="submit" disabled={!name.trim() || monthly <= 0}>
          {L.card.save}
        </button>
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
      </form>
    </Sheet>
  );
}
