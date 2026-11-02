import { useState } from 'react';
import { isTouch } from '../viewport';
import { payables, receivables } from '../domain/calc';
import { dm, money } from '../domain/format';
import type { Counterparty, Transaction, TxSplit } from '../domain/types';
import { useStore } from '../store';
import { personName, splitsOf } from '../domain/split';
import { Card, Empty, MoneyInput, Sheet } from '../components/ui';
import { LoanForm } from '../components/LoanForm';
import { Icon } from '../components/icons';
import { L } from '../labels';
import { t, Rich } from '../i18n';

/** Phần của một người trong một khoản. */
const partOf = (tx: Transaction, who: Counterparty) => splitsOf(tx).find((x) => x.person === who);

/** Ghi lại số tiền một người đã trả cho một khoản (lưu luôn ở dạng chia nhiều người). */
function withPaid(tx: Transaction, who: Counterparty, paid: number): Transaction {
  const splits: TxSplit[] = splitsOf(tx).map((x) => (x.person === who ? { ...x, paid: Math.min(Math.max(0, paid), x.amount) } : x));
  return { ...tx, splits, counterparty: undefined, reimbursed: 0 };
}

export function Split() {
  const { data, dispatch } = useStore();
  const rec = receivables(data);
  // Những người từng chia tiền cùng (người đang nợ nhiều nhất lên đầu).
  // Khoản đi vay (mình nợ người ta) nằm riêng ở thẻ "Bạn đang nợ".
  const owedToMe = data.transactions.filter((tx) => tx.kind !== 'borrow');
  const ids = [...new Set([...rec.byPerson.map((p) => p.id), ...owedToMe.flatMap((tx) => splitsOf(tx).map((x) => x.person))])];
  const pay = payables(data);
  const [loan, setLoan] = useState<'lend' | 'borrow' | null>(null);
  const [repaying, setRepaying] = useState<Transaction | null>(null);
  const [picked, setWho] = useState<Counterparty | undefined>(ids[0]);
  const who = picked && ids.includes(picked) ? picked : ids[0];
  const [paying, setPaying] = useState<Transaction | null>(null);
  const [showDone, setShowDone] = useState(false);
  const name = (c?: Counterparty) => personName(data.settings, c);

  const all = owedToMe.filter((tx) => who && partOf(tx, who)).sort((a, b) => b.date.localeCompare(a.date));
  const left = (tx: Transaction) => {
    const p = partOf(tx, who!);
    return p ? p.amount - p.paid : 0;
  };
  const open = all.filter((tx) => left(tx) !== 0);
  const done = all.filter((tx) => left(tx) === 0);
  const total = rec.byPerson.find((p) => p.id === who)?.amount ?? 0;

  const loanButtons = (
    <div className="loan-actions">
      <button className="btn" onClick={() => setLoan('lend')}>
        <Icon name="call_made" size={18} /> {L.loan.lend}
      </button>
      <button className="btn" onClick={() => setLoan('borrow')}>
        <Icon name="call_received" size={18} /> {L.loan.borrow}
      </button>
    </div>
  );
  const iOwe = pay.open.length > 0 && (
    <Card title={L.loan.youOwe} action={<b className="neg">{money(pay.total)}</b>}>
      <ul className="plain-list">
        {pay.open.map((tx) => {
          const p = splitsOf(tx)[0];
          return (
            <li key={tx.id}>
              <button className="row-btn" onClick={() => setRepaying(tx)}>
                <span>
                  <b>{name(p.person)}</b>
                  <small>
                    {t(L.loan.owedLine, { date: dm(tx.date), amount: money(tx.amount) })}
                    {p.paid > 0 && ` · ${t(L.split.paidSoFar, { amount: money(p.paid) })}`}
                  </small>
                </span>
                <b>{money(p.amount - p.paid)}</b>
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
  const sheets = (
    <>
      {loan && <LoanForm initialKind={loan} onClose={() => setLoan(null)} />}
      {repaying && <ReimburseForm tx={repaying} who={splitsOf(repaying)[0].person} onClose={() => setRepaying(null)} />}
    </>
  );

  if (!who)
    return (
      <div className="stack">
        {loanButtons}
        {iOwe}
        {!iOwe && <Empty>{L.split.empty}</Empty>}
        {sheets}
      </div>
    );

  function settleAll() {
    if (!confirm(t(L.split.settleAllConfirm, { name: name(who), amount: money(total) }))) return;
    for (const tx of open) dispatch({ type: 'upsertTx', tx: withPaid(tx, who!, partOf(tx, who!)!.amount) });
  }

  return (
    <div className="stack">
      {loanButtons}
      {/* Mỗi người một nút; chỉ có một người thì khỏi hiện. */}
      {ids.length > 1 && (
        <div className="chips chips--scroll">
          {ids.map((c) => (
            <button key={c} className="chip" aria-pressed={who === c} onClick={() => setWho(c)}>
              {name(c)}
            </button>
          ))}
        </div>
      )}
      <Card tone="accent">
        <p className="eyebrow">{t(L.split.owes, { name: name(who) })}</p>
        <p className="hero-amount">{money(total)}</p>
        {open.length > 0 && (
          <button className="btn btn--on-accent" onClick={settleAll}>
            {L.split.settleAll}
          </button>
        )}
      </Card>
      {iOwe}
      <Card title={t(L.split.pending, { count: open.length })}>
        {open.length === 0 ? (
          <Empty>{L.split.noDebt}</Empty>
        ) : (
          <ul className="plain-list">
            {open.map((tx) => {
              const p = partOf(tx, who)!;
              return (
                <li key={tx.id}>
                  <button className="row-btn" onClick={() => setPaying(tx)}>
                    <span>
                      <b>{tx.merchant}</b>
                      <small>
                        {t(L.split.pendingLine, { date: dm(tx.date), amount: money(tx.amount) })}
                        {splitsOf(tx).length > 1 && ` · ${t(L.split.withOthers, { n: splitsOf(tx).length - 1 })}`}
                        {p.paid > 0 && ` · ${t(L.split.paidSoFar, { amount: money(p.paid) })}`}
                      </small>
                    </span>
                    <b>{money(p.amount - p.paid)}</b>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      {done.length > 0 && (
        <Card
          title={t(L.split.done, { count: done.length })}
          action={
            <button className="link" onClick={() => setShowDone((v) => !v)}>
              {showDone ? L.split.hide : L.split.show}
            </button>
          }
        >
          {showDone && (
            <ul className="plain-list">
              {done.map((tx) => (
                <li key={tx.id}>
                  <button className="row-btn" onClick={() => setPaying(tx)}>
                    <span>
                      <b>{tx.merchant}</b>
                      <small>{dm(tx.date)}</small>
                    </span>
                    <span className="pos">{t(L.split.paidMark, { amount: money(partOf(tx, who)!.paid) })}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
      {paying && <ReimburseForm tx={paying} who={who} onClose={() => setPaying(null)} />}
      {sheets}
    </div>
  );
}

function ReimburseForm({ tx, who, onClose }: { tx: Transaction; who: Counterparty; onClose: () => void }) {
  const { dispatch } = useStore();
  const part = partOf(tx, who);
  const owed = part?.amount ?? 0;
  const [value, setValue] = useState(part?.paid ?? 0);
  return (
    <Sheet title={tx.merchant} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          dispatch({ type: 'upsertTx', tx: withPaid(tx, who, value) });
          onClose();
        }}
      >
        <p className="muted">
          <Rich text={L.split.owed} vars={{ amount: money(owed) }} />
        </p>
        <label className="field field--big">
          <span>{L.split.paid}</span>
          <MoneyInput value={value} onChange={setValue} autoFocus={!isTouch} />
        </label>
        <div className="chips">
          <button type="button" className="chip" onClick={() => setValue(owed)}>
            {L.split.payFull}
          </button>
          <button type="button" className="chip" onClick={() => setValue(0)}>
            {L.split.notPaid}
          </button>
        </div>
        <div className="form__actions">
          <button className="btn btn--primary" type="submit">
            {L.split.save}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
