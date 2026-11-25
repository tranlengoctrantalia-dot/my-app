import { useMemo, useState } from 'react';
import { INSTALLMENT_TERMS, isSpending, mergeInstallment, shiftPeriod, todayISO, txInPeriod } from '../domain/calc';
import { dayLabel, dm, money, periodLabel, uid } from '../domain/format';
import type { PeriodKey, Transaction } from '../domain/types';
import { useLookups, useStore } from '../store';
import { Empty, MoneyInput, PeriodPicker, Sheet, Info } from '../components/ui';
import { CatBadge, Icon, catColor, catIcon } from '../components/icons';
import { L } from '../labels';
import { splitsOf } from '../domain/split';
import { t as tr } from '../i18n';

/** `date`: hiện thêm ngày (khi danh sách không chia theo ngày). */
export function TxRow({ t, onClick, date, picked, dim }: { t: Transaction; onClick?: () => void; date?: boolean; picked?: boolean; dim?: boolean }) {
  const { category, account } = useLookups();
  const c = category(t.categoryId);
  const shared = splitsOf(t).length > 0 && t.myShare !== t.amount;
  if (t.kind === 'lend' || t.kind === 'borrow') {
    const left = splitsOf(t).reduce((a, x) => a + x.amount - x.paid, 0);
    const lend = t.kind === 'lend';
    return (
      <li>
        <button className="tx" onClick={onClick}>
          <span className="shared-badge">
            <Icon name={lend ? 'call_made' : 'call_received'} size={20} />
          </span>
          <span className="tx__main">
            <span className="tx__title">{t.merchant}</span>
            <span className="tx__meta">{left ? tr(lend ? L.loan.lendMeta : L.loan.borrowMeta, { amount: money(left) }) : L.loan.loanDone}</span>
          </span>
          <span className="tx__amt">
            <span className={lend ? 'muted' : 'pos'}>{(lend ? '−' : '+') + money(t.amount)}</span>
          </span>
        </button>
      </li>
    );
  }
  // Chuyển tiền giữa hai nguồn: không phải chi / thu, hiện màu trung tính.
  if (t.kind === 'transfer')
    return (
      <li>
        <button className="tx" onClick={onClick}>
          <span className="shared-badge">
            <Icon name="swap_horiz" size={20} />
          </span>
          <span className="tx__main">
            <span className="tx__title">{t.merchant}</span>
            <span className="tx__meta">{tr(L.tx.transferMeta, { from: account(t.accountId)?.name ?? '', to: account(t.toAccountId ?? '')?.name ?? '' })}</span>
          </span>
          <span className="tx__amt">
            <span className="muted">{money(t.amount)}</span>
          </span>
        </button>
      </li>
    );
  return (
    <li>
      <button className={`tx${picked ? ' tx--picked' : ''}${dim ? ' tx--dim' : ''}${t.cancelled ? ' tx--cancelled' : ''}`} onClick={onClick} disabled={dim} aria-pressed={picked}>
        {picked !== undefined && !dim && <Icon name={picked ? 'check' : 'add'} size={18} className="tx__pick" />}
        <CatBadge id={t.categoryId} />
        <span className="tx__main">
          <span className="tx__title">{t.merchant}</span>
          {(c?.name !== t.merchant || shared || date || (t.spreadMonths ?? 1) > 1 || t.installmentId || t.cancelled) && (
            <span className="tx__meta">
              {date && dm(t.date)}
              {date && c?.name !== t.merchant && ' · '}
              {c?.name !== t.merchant && c?.name}
              {shared && <span className="tag">{L.tx.sharedTag}</span>}
              {t.installmentId && <span className="tag">{L.tx.instTag}</span>}
              {t.cancelled && <span className="tag tag--cancelled">{L.tx.cancelledTag}</span>}
              {(t.spreadMonths ?? 1) > 1 && <span className="tag">{tr(L.txForm.spreadN, { n: t.spreadMonths! })}</span>}
            </span>
          )}
        </span>
        <span className="tx__amt">
          <span className={t.amount < 0 || t.kind === 'income' ? 'pos' : ''}>
            {t.amount < 0 || t.kind === 'income' ? '+' + money(Math.abs(t.amount)) : money(t.amount)}
          </span>
          {shared && <small>{tr(L.tx.myShare, { amount: money(t.myShare) })}</small>}
        </span>
      </button>
    </li>
  );
}

export function Transactions({ period, setPeriod, onEdit, onAdd }: { period: PeriodKey; setPeriod: (p: PeriodKey) => void; onEdit: (t: Transaction) => void; onAdd: () => void }) {
  const { data } = useStore();
  const [q, setQ] = useState('');
  const today = todayISO();

  const txs = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return txInPeriod(data, period, true)
      .filter((t) => !needle || t.merchant.toLowerCase().includes(needle) || t.note?.toLowerCase().includes(needle))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [data, period, q]);

  const groups = useMemo(() => {
    const m = new Map<string, Transaction[]>();
    for (const t of txs) m.set(t.date, [...(m.get(t.date) ?? []), t]);
    return [...m.entries()];
  }, [txs]);

  const mine = txs.filter((t) => isSpending(t) && !t.cancelled).reduce((a, t) => a + t.myShare, 0);

  // Gộp trả góp: chọn nhiều khoản quẹt thẻ (ngân hàng chuyển trả góp một lần, phí một lần).
  const isCard = (id: string) => data.accounts.find((a) => a.id === id)?.kind === 'credit';
  const canPick = (t: Transaction) => isSpending(t) && !t.cancelled && t.amount > 0 && isCard(t.accountId);
  const hasCardTx = txs.some(canPick);
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [merging, setMerging] = useState(false);
  const pickedTxs = data.transactions.filter((t) => picked.includes(t.id));
  const togglePick = (id: string) => setPicked((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id]));
  const stopPicking = () => {
    setPicking(false);
    setPicked([]);
  };

  return (
    <div className="stack">
      <PeriodPicker value={period} onChange={setPeriod} />
      <div className="search">
        <Icon name="search" size={18} className="muted" />
        <input type="search" placeholder={L.tx.search} value={q} onChange={(e) => setQ(e.target.value)} aria-label={L.tx.searchAria} />
        <b>{money(mine)}</b>
      </div>
      {(hasCardTx || picking) && (
        <div className="pick-head">
          {picking ? <Info>{L.tx.mergeHint}</Info> : <span />}
          <button className="link" onClick={() => (picking ? stopPicking() : setPicking(true))}>
            {picking ? L.tx.mergeCancel : L.tx.mergeStart}
          </button>
        </div>
      )}
      {groups.length === 0 ? (
        <Empty
          art="notepad"
          action={
            !q && (
              <button className="btn btn--primary" onClick={onAdd}>
                {L.tx.emptyAdd}
              </button>
            )
          }
        >
          {L.tx.empty}
        </Empty>
      ) : (
        groups.map(([date, list]) => (
          <section key={date} className="day">
            <h3 className="day__head">{dayLabel(date, today)}</h3>
            <ul className="tx-list">
              {list.map((t) => (
                <TxRow
                  key={t.id}
                  t={t}
                  onClick={() => (!picking ? onEdit(t) : canPick(t) && togglePick(t.id))}
                  picked={picking ? picked.includes(t.id) : undefined}
                  dim={picking && !canPick(t)}
                />
              ))}
            </ul>
          </section>
        ))
      )}
      {picking && picked.length > 0 && (
        <div className="pick-bar">
          <span>{tr(L.tx.mergeBar, { n: picked.length, amount: money(pickedTxs.reduce((a, t) => a + t.amount, 0)) })}</span>
          <button className="btn btn--primary btn--sm" onClick={() => setMerging(true)}>
            {L.tx.mergeNext}
          </button>
        </div>
      )}
      {merging && (
        <MergeInstallmentSheet
          txs={pickedTxs}
          onClose={() => setMerging(false)}
          onDone={() => {
            setMerging(false);
            stopPicking();
          }}
        />
      )}
    </div>
  );
}

/** Gộp các khoản đã chọn thành một khoản trả góp: số kỳ + phí chuyển đổi một lần. */
function MergeInstallmentSheet({ txs, onClose, onDone }: { txs: Transaction[]; onClose: () => void; onDone: () => void }) {
  const { data, dispatch } = useStore();
  const T = L.txForm;
  const first = txs[0];
  const cat = data.categories.find((c) => c.id === first?.categoryId);
  const [name, setName] = useState(() => [...new Set(txs.map((t) => t.merchant))].join(', ').slice(0, 60));
  const [term, setTerm] = useState(0);
  const [fee, setFee] = useState(0);
  const oneCard = new Set(txs.map((t) => t.accountId)).size === 1;
  const total = txs.reduce((a, t) => a + t.amount, 0);
  const preview = oneCard && term > 0 ? mergeInstallment(data, txs, { id: '', categoryId: '', name, months: term, fee }).item : undefined;
  const valid = oneCard && term > 0 && name.trim() !== '' && txs.length > 0;

  function save() {
    if (!valid) return;
    const id = uid();
    const category = {
      id: `inst-${id}`,
      name: tr(L.card.categoryName, { name: name.trim() }),
      icon: '',
      kind: 'installment' as const,
      iconName: cat && catIcon(cat.id, cat),
      color: cat && catColor(cat.id, cat),
    };
    const r = mergeInstallment(data, txs, { id, categoryId: category.id, name: name.trim(), months: term, fee });
    dispatch({ type: 'upsertInstallment', item: r.item, category });
    for (const t of r.txs) dispatch({ type: 'upsertTx', tx: t });
    onDone();
  }

  return (
    <Sheet title={L.tx.mergeTitle} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <p className="hint">{tr(L.tx.mergeBar, { n: txs.length, amount: money(total) })}</p>
        {!oneCard && <p className="hint neg">{L.tx.mergeOneCard}</p>}
        <label className="field">
          <span>{L.tx.mergeName}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="field">
          <span>{T.instTerm}</span>
          <div className="chips">
            {INSTALLMENT_TERMS.map((n) => (
              <button type="button" key={n} className="chip" aria-pressed={term === n} onClick={() => setTerm(n)}>
                {n}
              </button>
            ))}
            <input
              className="chip chip--input"
              type="number"
              min={1}
              inputMode="numeric"
              placeholder={L.card.termOther}
              value={INSTALLMENT_TERMS.includes(term) || !term ? '' : term}
              onChange={(e) => setTerm(Number(e.target.value) || 0)}
              aria-label={L.card.termOtherAria}
            />
          </div>
        </div>
        <label className="field">
          <span>{T.instFee}</span>
          <MoneyInput value={fee} onChange={setFee} placeholder="0" />
        </label>
        {preview && (
          <p className="hint advice-hint">
            {tr(T.instResult, { monthly: money(preview.monthly), period: periodLabel(shiftPeriod(preview.firstPeriod, term - 1)) })}
            {fee > 0 && ` · ${tr(T.instFeeFirst, { amount: money(fee), period: periodLabel(preview.firstPeriod) })}`}
          </p>
        )}
        <button className="btn btn--primary btn--block" type="submit" disabled={!valid}>
          {L.tx.mergeSave}
        </button>
      </form>
    </Sheet>
  );
}
