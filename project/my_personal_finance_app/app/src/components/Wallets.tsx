/** Ví của bạn: số dư từng nguồn, tổng tài sản, chuyển tiền. */
import { useState } from 'react';
import { accountBalance, netWorth } from '../domain/calc';
import { money } from '../domain/format';
import { useStore } from '../store';
import { L } from '../labels';
import { t } from '../i18n';
import { Icon } from './icons';
import { accountKinds } from './Manage';
import { MoneyInput, Sheet } from './ui';

const W = L.wallet;

/** Bảng "Ví của bạn" (mở từ ô Tài sản ở màn chính): tổng tài sản, số dư từng nguồn, chuyển tiền. */
export function WalletSheet({ onClose, onTransfer }: { onClose: () => void; onTransfer: () => void }) {
  const { data } = useStore();
  const nw = netWorth(data);
  const tracking = nw.rows.length > 0;
  const [editing, setEditing] = useState(!tracking);
  const kindIcon = (kind: string) => accountKinds.find((k) => k.id === kind)?.icon ?? 'money';

  if (editing) return <BalancesSheet onClose={tracking ? () => setEditing(false) : onClose} />;

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
                <button className="wallet__row" onClick={() => setEditing(true)}>
                  <span className="mini-icon">
                    <Icon name={kindIcon(a.kind)} size={18} />
                  </span>
                  <span className="wallet__name">{a.name}</span>
                  <span className={!set ? 'muted' : b < 0 ? 'neg' : ''}>{!set ? W.notSet : b < 0 ? t(W.debt, { amount: money(-b) }) : money(b)}</span>
                </button>
              </li>
            );
          })}
        </ul>
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
    <Sheet title={W.sheetTitle} onClose={onClose}>
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
        <p className="hint">{W.sheetHint}</p>
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
