/** Ghi khoản cho vay / đi vay: không tính là chi hay thu, chỉ cộng trừ vào số dư ví và theo dõi ai nợ ai. */
import { useState } from 'react';
import { isTouch } from '../viewport';
import { todayISO } from '../domain/calc';
import { uid } from '../domain/format';
import { peopleOf, personName, received, setPaid as withPaid, splitsOf } from '../domain/split';
import type { Transaction } from '../domain/types';
import { useStore } from '../store';
import { MoneyInput, Sheet } from './ui';
import { L } from '../labels';
import { t } from '../i18n';

const T = L.loan;

export function LoanForm({ tx, initialKind = 'lend', onClose }: { tx?: Transaction; initialKind?: 'lend' | 'borrow'; onClose: () => void }) {
  const { data, dispatch } = useStore();
  const part = tx ? splitsOf(tx)[0] : undefined;
  const [kind, setKind] = useState<'lend' | 'borrow'>(tx?.kind === 'borrow' ? 'borrow' : tx?.kind === 'lend' ? 'lend' : initialKind);
  const people = peopleOf(data.settings);
  const [who, setWho] = useState(part?.person ?? '');
  const [amount, setAmount] = useState(tx?.amount ?? 0);
  const [paid, setPaid] = useState(part ? received(part) : 0);
  const [accountId, setAccountId] = useState(tx?.accountId ?? data.accounts.find((a) => a.kind !== 'credit')?.id ?? data.accounts[0]?.id ?? '');
  const [date, setDate] = useState(tx?.date ?? todayISO());
  const [note, setNote] = useState(tx && tx.merchant !== autoName(tx.kind, personName(data.settings, part?.person)) ? tx.merchant : '');
  const valid = who && amount > 0 && accountId;

  function addPerson() {
    const name = prompt(T.newPersonPrompt)?.trim();
    if (!name) return;
    const existing = people.find((p) => p.name.toLowerCase() === name.toLowerCase());
    if (existing) return setWho(existing.id);
    const id = uid();
    dispatch({ type: 'settings', patch: { people: [...people, { id, name }] } });
    setWho(id);
  }

  return (
    <Sheet title={tx ? (kind === 'lend' ? T.editLend : T.editBorrow) : kind === 'lend' ? T.lend : T.borrow} info={T.hint} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          const next: Transaction = {
            id: tx?.id ?? uid(),
            date,
            merchant: note.trim() || autoName(kind, personName(data.settings, who)),
            amount,
            myShare: 0,
            categoryId: kind,
            accountId,
            // Giữ lịch sử trả của người cũ; số "đã trả" đổi thì ghi phần chênh vào hôm nay.
            splits: [withPaid({ person: who, amount, paid: part?.person === who ? part.paid : 0, log: part?.person === who ? part.log : undefined }, paid, todayISO())],
            reimbursed: 0,
            kind,
          };
          dispatch({ type: 'upsertTx', tx: next });
          onClose();
        }}
      >
        <div className="segmented">
          <button type="button" aria-pressed={kind === 'lend'} onClick={() => setKind('lend')}>
            {T.lend}
          </button>
          <button type="button" aria-pressed={kind === 'borrow'} onClick={() => setKind('borrow')}>
            {T.borrow}
          </button>
        </div>
        <label className="field field--big">
          <span>{T.amount}</span>
          <MoneyInput value={amount} onChange={setAmount} autoFocus={!tx && !isTouch} />
        </label>
        <div className="field">
          <span>{kind === 'lend' ? T.whoLend : T.whoBorrow}</span>
          <div className="chips">
            {people.map((p) => (
              <button type="button" key={p.id} className="chip" aria-pressed={who === p.id} onClick={() => setWho(p.id)}>
                {p.name}
              </button>
            ))}
            <button type="button" className="chip chip--ghost" onClick={addPerson}>
              {T.newPerson}
            </button>
          </div>
        </div>
        <div className="field-row">
          <label className="field">
            <span>{kind === 'lend' ? T.account : T.accountBorrow}</span>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {data.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{T.date}</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>
        <label className="field">
          <span>{T.note}</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={T.notePlaceholder} />
        </label>
        {tx && (
          <label className="field">
            <span>{T.paidBack}</span>
            <MoneyInput value={paid} onChange={setPaid} />
          </label>
        )}
        <button className="btn btn--primary btn--block" type="submit" disabled={!valid}>
          {T.save}
        </button>
        {tx && (
          <button
            type="button"
            className="btn btn--danger-ghost btn--block"
            onClick={() => {
              if (confirm(T.confirmDelete)) {
                dispatch({ type: 'deleteTx', id: tx.id });
                onClose();
              }
            }}
          >
            {T.delete}
          </button>
        )}
      </form>
    </Sheet>
  );
}

const autoName = (kind: Transaction['kind'], name: string) => t(kind === 'borrow' ? T.borrowMerchant : T.lendMerchant, { name });
