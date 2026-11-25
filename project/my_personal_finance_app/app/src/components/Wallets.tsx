/** Ví của bạn: số dư từng nguồn, tổng tài sản, chuyển tiền. */
import { useState } from 'react';
import { accountBalance, accountMoves, netWorth, staleAnchor, type Move } from '../domain/calc';
import { personName } from '../domain/split';
import { NewTip } from './WhatsNew';
import { dm, money } from '../domain/format';
import type { Account } from '../domain/types';
import { useStore } from '../store';
import { L } from '../labels';
import { t } from '../i18n';
import { Art, Icon } from './icons';
import { accountKinds } from './Manage';
import { MoneyInput, Sheet } from './ui';

const W = L.wallet;

/** Bảng "Ví của bạn" (mở từ ô Tài sản ở màn chính): tổng tài sản, số dư từng nguồn, chuyển tiền. */
export function WalletSheet({ onClose, onTransfer }: { onClose: () => void; onTransfer: () => void }) {
  const { data } = useStore();
  const nw = netWorth(data);
  const tracking = nw.rows.length > 0;
  const [editing, setEditing] = useState(!tracking);
  const [viewing, setViewing] = useState<Account | null>(null);
  const kindIcon = (kind: string) => accountKinds.find((k) => k.id === kind)?.icon ?? 'money';
  const stale = data.accounts.filter((a) => staleAnchor(data, a.id));

  if (editing) return <BalancesSheet onClose={tracking ? () => setEditing(false) : onClose} />;
  if (viewing) return <AccountLedger account={viewing} onClose={() => setViewing(null)} />;

  return (
    <Sheet title={W.title} onClose={onClose}>
      <div className="form wallet">
        <div className="wallet__total">
          <small>{W.total}</small>
          <b className={nw.total < 0 ? 'neg' : ''}>{money(nw.total)}</b>
        </div>
        <ul className="wallet__list">
          {data.accounts.map((a) => {
            const set = a.balanceAdjust !== undefined;
            const b = set ? accountBalance(data, a.id) : 0;
            return (
              <li key={a.id}>
                <button className="wallet__row" onClick={() => (set ? setViewing(a) : setEditing(true))}>
                  <span className="mini-icon">
                    <Art name={kindIcon(a.kind)} size={24} />
                  </span>
                  <span className="wallet__name">{a.name}</span>
                  <span className={!set ? 'muted' : b < 0 ? 'neg' : ''}>{!set ? W.notSet : b < 0 ? t(W.debt, { amount: money(-b) }) : money(b)}</span>
                </button>
              </li>
            );
          })}
        </ul>
        {stale.length > 0 && (
          <button className="tip" onClick={() => setEditing(true)}>
            <Icon name="warning" size={22} />
            <span>{t(W.staleAnchor, { names: stale.map((a) => a.name).join(', ') })}</span>
            <Icon name="right" size={18} />
          </button>
        )}
        <button className="btn btn--block" onClick={() => setEditing(true)}>
          {W.edit}
        </button>
        <button className="btn btn--primary btn--block" onClick={onTransfer}>
          <Icon name="swap_horiz" size={18} /> {W.transfer}
        </button>
      </div>
    </Sheet>
  );
}

/** Nhập số dư hiện tại của tất cả nguồn một lượt. Thẻ tín dụng nhập số đang nợ. */
function BalancesSheet({ onClose }: { onClose: () => void }) {
  const { data, dispatch } = useStore();
  const [values, setValues] = useState<Record<string, number | undefined>>(() =>
    Object.fromEntries(
      data.accounts.map((a) => {
        if (a.balanceAdjust === undefined) return [a.id, undefined];
        const b = accountBalance(data, a.id);
        return [a.id, a.kind === 'credit' ? -b : b];
      }),
    ),
  );

  return (
    <Sheet title={W.sheetTitle} info={W.sheetHint} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          for (const a of data.accounts) {
            const v = values[a.id];
            dispatch({ type: 'setBalance', accountId: a.id, balance: v === undefined ? undefined : a.kind === 'credit' ? -v : v });
          }
          onClose();
        }}
      >
        {data.accounts.map((a) => (
          <label key={a.id} className="field">
            <span>
              {a.name} · {a.kind === 'credit' ? W.debtLabel : W.balanceLabel}
            </span>
            <MoneyInput
              value={values[a.id] ?? 0}
              placeholder={W.leaveEmpty}
              onChange={(n) => setValues((v) => ({ ...v, [a.id]: n || n === 0 ? n : undefined }))}
            />
          </label>
        ))}
        <button className="btn btn--primary btn--block" type="submit">
          {W.save}
        </button>
      </form>
    </Sheet>
  );
}

/** Sổ chi tiết 1 ví: số dư lúc nhập + từng khoản sau đó = số dư hiện tại (để so với app ngân hàng / Momo). */
const signed = (n: number) => (n > 0 ? '+' : '−') + money(Math.abs(n));

/** Gộp các dòng tiền trả lại của cùng một lần nhận (cùng người, cùng giờ ghi) thành một nhóm. */
function groupMoves(moves: Move[]): Move[][] {
  const out: Move[][] = [];
  const at = new Map<string, Move[]>();
  for (const m of moves) {
    const key = m.receipt && `${m.receipt.person}:${m.receipt.ts}`;
    const g = key ? at.get(key) : undefined;
    if (g) g.push(m);
    else {
      const ng = [m];
      out.push(ng);
      if (key) at.set(key, ng);
    }
  }
  return out;
}

function AccountLedger({ account, onClose }: { account: Account; onClose: () => void }) {
  const { data } = useStore();
  const since = account.balanceAt;
  const moves = accountMoves(data, account.id, undefined, since);
  const start = since ? since.amount : (account.balanceAdjust ?? 0);
  return (
    <Sheet title={account.name} onClose={onClose}>
      <dl className="ledger ledger--sheet">
        <div className="ledger__subtotal">
          <dt>{since ? t(W.ledgerStart, { date: dm(since.date) }) : W.ledgerStartOld}</dt>
          <dd>{money(start)}</dd>
        </div>
        {groupMoves(moves).map((g, i) =>
          g.length === 1 ? (
            <div key={i}>
              <dt>
                {g[0].label}
                <small className="muted"> · {dm(g[0].date)}</small>
              </dt>
              <dd className={g[0].amount > 0 ? 'pos' : ''}>{signed(g[0].amount)}</dd>
            </div>
          ) : (
            <details key={i} className="ledger__group" data-tour="receipt-group">
              <summary>
                <dt>
                  {t(W.receiptGroup, { name: personName(data.settings, g[0].receipt!.person), n: g.length })}
                  <small className="muted"> · {dm(g[0].date)}</small>
                </dt>
                <dd className="pos">{signed(g.reduce((a, m) => a + m.amount, 0))}</dd>
              </summary>
              {g.map((m, j) => (
                <div key={j} className="ledger__sub">
                  <dt>{m.label.split(' · ').slice(1).join(' · ') || m.label}</dt>
                  <dd>{signed(m.amount)}</dd>
                </div>
              ))}
            </details>
          ),
        )}
        <div className="ledger__total">
          <dt>{W.ledgerNow}</dt>
          <dd>{money(accountBalance(data, account.id))}</dd>
        </div>
      </dl>
      {!moves.length && <p className="hint">{W.ledgerEmpty}</p>}
      <NewTip id="receiptGroup" target=".sheet [data-tour='receipt-group']" />
    </Sheet>
  );
}
