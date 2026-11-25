/** Cài đặt → Khoản định kỳ: tiền nhà, Netflix, lương… app tự ghi mỗi tháng. */
import { useState } from 'react';
import { recurringNext, todayISO } from '../domain/calc';
import { dm, money, uid } from '../domain/format';
import { allPresets, peopleOf, personName, presetLabel } from '../domain/split';
import type { Recurring } from '../domain/types';
import { useStore } from '../store';
import { Empty, Card, MoneyInput, NumberInput, Sheet, Info } from '../components/ui';
import { CatBadge, Icon } from '../components/icons';
import { L } from '../labels';
import { t } from '../i18n';

const R = L.recurring;

export function RecurringSection() {
  const { data } = useStore();
  const [edit, setEdit] = useState<Recurring | 'new' | null>(null);
  const list = data.recurring ?? [];
  const today = todayISO();
  return (
    <Card>
      {list.length === 0 ? (
        <Empty art="calendar">{R.empty}</Empty>
      ) : (
        <ul className="plain-list">
          {list.map((r) => (
            <li key={r.id}>
              <button className="row-btn row-btn--icon" onClick={() => setEdit(r)}>
                <CatBadge id={r.categoryId} size={36} />
                <span>
                  <b>{r.merchant}</b>
                  <small>{r.paused ? R.paused : t(R.rowMeta, { day: r.day, next: dm(recurringNext(r, today)) })}</small>
                </span>
                <b className={r.kind === 'income' ? 'pos' : ''}>
                  {r.kind === 'income' ? '+' : ''}
                  {money(r.amount)}
                </b>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button className="btn btn--block add-btn" onClick={() => setEdit('new')}>
        <Icon name="plus" size={20} /> {R.add}
      </button>
      {edit && <RecurringForm item={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}
    </Card>
  );
}

function RecurringForm({ item, onClose }: { item?: Recurring; onClose: () => void }) {
  const { data, dispatch } = useStore();
  const [merchant, setMerchant] = useState(item?.merchant ?? '');
  const [amount, setAmount] = useState(item?.amount ?? 0);
  const [income, setIncome] = useState(item?.kind === 'income');
  const cats = data.categories.filter((c) => (income ? c.kind === 'income' : c.kind === 'spend' || c.kind === 'fixed'));
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? cats[0]?.id ?? '');
  const [accountId, setAccountId] = useState(item?.accountId ?? data.accounts[0]?.id ?? '');
  const [day, setDay] = useState(item?.day ?? Number(todayISO().slice(8, 10)));
  const [splitId, setSplitId] = useState(item?.splitId ?? 'me');
  const people = peopleOf(data.settings);
  const [who, setWho] = useState(item?.people?.[0] ?? item?.counterparty ?? people[0]?.id ?? '');
  const splitWithOther = !income && (allPresets(data.settings).find((p) => p.id === splitId)?.other ?? 0) > 0;
  const [paused, setPaused] = useState(!!item?.paused);
  const catOk = cats.some((c) => c.id === categoryId);
  const valid = merchant.trim() && amount > 0 && catOk;

  function switchKind(inc: boolean) {
    setIncome(inc);
    const next = data.categories.filter((c) => (inc ? c.kind === 'income' : c.kind === 'spend' || c.kind === 'fixed'));
    if (!next.some((c) => c.id === categoryId)) setCategoryId(next[0]?.id ?? '');
  }

  return (
    <Sheet title={item ? R.formEdit : R.formNew} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          const today = todayISO();
          const next: Recurring = {
            id: item?.id ?? uid(),
            merchant: merchant.trim(),
            amount,
            categoryId,
            accountId,
            day,
            kind: income ? 'income' : undefined,
            splitId: !income && splitId !== 'me' ? splitId : undefined,
            people: splitWithOther && who ? (item?.people && item.people.includes(who) ? item.people : [who]) : undefined,
            counterparty: undefined,
            // Khoản mới: bắt đầu từ hôm nay (không tự ghi lùi các tháng trước).
            startDate: item?.startDate ?? today,
            lastDate: item?.lastDate,
            paused: paused || undefined,
          };
          dispatch({ type: 'upsertRecurring', item: next });
          dispatch({ type: 'postRecurring', today });
          onClose();
        }}
      >
        <div className="segmented">
          <button type="button" aria-pressed={!income} onClick={() => switchKind(false)}>
            {R.kindExpense}
          </button>
          <button type="button" aria-pressed={income} onClick={() => switchKind(true)}>
            {R.kindIncome}
          </button>
        </div>
        <label className="field">
          <span>{R.name}</span>
          <input value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder={R.namePlaceholder} />
        </label>
        <label className="field field--big">
          <span>{R.amount}</span>
          <MoneyInput value={amount} onChange={setAmount} />
        </label>
        <div className="field-row">
          <label className="field">
            <span>{R.category}</span>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{R.account}</span>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {data.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="field">
          <span>
            {R.day}
            <Info>{R.dayHint}</Info>
          </span>
          <NumberInput min={1} max={31} value={day} onChange={setDay} />
        </label>
        {!income && (
          <label className="field">
            <span>{R.split}</span>
            <select value={splitId} onChange={(e) => setSplitId(e.target.value)}>
              {allPresets(data.settings).map((p) => (
                <option key={p.id} value={p.id}>
                  {presetLabel(p, personName(data.settings, who))}
                </option>
              ))}
            </select>
          </label>
        )}
        {splitWithOther && people.length > 0 && (
          <label className="field">
            <span>{R.withWho}</span>
            <select value={who} onChange={(e) => setWho(e.target.value)}>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {item && (
          <label className="switch-row">
            <span>
              {R.pause}
              <Info>{R.pauseHint}</Info>
            </span>
            <input type="checkbox" checked={paused} onChange={(e) => setPaused(e.target.checked)} />
          </label>
        )}
        <button className="btn btn--primary btn--block" type="submit" disabled={!valid}>
          {R.save}
        </button>
        {item && (
          <button
            type="button"
            className="btn btn--danger-ghost btn--block"
            onClick={() => {
              if (confirm(t(R.confirmDelete, { name: item.merchant }))) {
                dispatch({ type: 'deleteRecurring', id: item.id });
                onClose();
              }
            }}
          >
            {R.delete}
          </button>
        )}
      </form>
    </Sheet>
  );
}
