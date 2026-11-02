import { useMemo, useState } from 'react';
import { isSpending, todayISO, txInPeriod } from '../domain/calc';
import { dayLabel, dm, money } from '../domain/format';
import type { PeriodKey, Transaction } from '../domain/types';
import { useLookups, useStore } from '../store';
import { Empty, PeriodPicker } from '../components/ui';
import { CatBadge, Icon } from '../components/icons';
import { L } from '../labels';
import { splitsOf } from '../domain/split';
import { t as tr } from '../i18n';

/** `date`: hiện thêm ngày (khi danh sách không chia theo ngày). */
export function TxRow({ t, onClick, date }: { t: Transaction; onClick?: () => void; date?: boolean }) {
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
      <button className="tx" onClick={onClick}>
        <CatBadge id={t.categoryId} />
        <span className="tx__main">
          <span className="tx__title">{t.merchant}</span>
          {(c?.name !== t.merchant || shared || date || (t.spreadMonths ?? 1) > 1) && (
            <span className="tx__meta">
              {date && dm(t.date)}
              {date && c?.name !== t.merchant && ' · '}
              {c?.name !== t.merchant && c?.name}
              {shared && <span className="tag">{L.tx.sharedTag}</span>}
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

export function Transactions({ period, setPeriod, onEdit }: { period: PeriodKey; setPeriod: (p: PeriodKey) => void; onEdit: (t: Transaction) => void }) {
  const { data } = useStore();
  const [q, setQ] = useState('');
  const today = todayISO();

  const txs = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return txInPeriod(data, period)
      .filter((t) => !needle || t.merchant.toLowerCase().includes(needle) || t.note?.toLowerCase().includes(needle))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [data, period, q]);

  const groups = useMemo(() => {
    const m = new Map<string, Transaction[]>();
    for (const t of txs) m.set(t.date, [...(m.get(t.date) ?? []), t]);
    return [...m.entries()];
  }, [txs]);

  const mine = txs.filter(isSpending).reduce((a, t) => a + t.myShare, 0);

  return (
    <div className="stack">
      <PeriodPicker value={period} onChange={setPeriod} />
      <div className="search">
        <Icon name="search" size={18} className="muted" />
        <input type="search" placeholder={L.tx.search} value={q} onChange={(e) => setQ(e.target.value)} aria-label={L.tx.searchAria} />
        <b>{money(mine)}</b>
      </div>
      {groups.length === 0 ? (
        <Empty>{L.tx.empty}</Empty>
      ) : (
        groups.map(([date, list]) => (
          <section key={date} className="day">
            <h3 className="day__head">{dayLabel(date, today)}</h3>
            <ul className="tx-list">
              {list.map((t) => (
                <TxRow key={t.id} t={t} onClick={() => onEdit(t)} />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
