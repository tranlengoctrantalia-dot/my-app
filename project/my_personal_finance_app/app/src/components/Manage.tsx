import { useState } from 'react';
import { isTouch } from '../viewport';
import { uid } from '../domain/format';
import type { Account, AccountKind, Category, CategoryKind } from '../domain/types';
import { useStore } from '../store';
import { Art, catColor, catIcon, palette, pickableIcons } from './icons';
import { NumberInput, Sheet } from './ui';
import { L } from '../labels';
import { t } from '../i18n';

const T = L.manage;

export const accountKinds: { id: AccountKind; label: string; icon: string }[] = [
  { id: 'credit', label: T.kindCredit, icon: 'card' },
  { id: 'ewallet', label: T.kindEwallet, icon: 'ewallet' },
  { id: 'bank', label: T.kindBank, icon: 'bank' },
  { id: 'cash', label: T.kindCash, icon: 'cash' },
];

/** `cardOnly`: thêm / sửa thẻ ngay ở tab Thẻ, chỉ còn tên và 2 ngày. */
export function AccountForm({ account, cardOnly, onClose, onSaved }: { account?: Account; cardOnly?: boolean; onClose: () => void; onSaved?: (id: string) => void }) {
  const { data, dispatch } = useStore();
  const [name, setName] = useState(account?.name ?? '');
  const [kind, setKind] = useState<AccountKind>(account?.kind ?? (cardOnly ? 'credit' : 'bank'));
  // Thẻ tín dụng: ngày chốt / hạn trả riêng (0 = dùng ngày chung).
  const [cutoffDay, setCutoffDay] = useState(account?.cutoffDay ?? data.settings.cutoffDay);
  const [dueDay, setDueDay] = useState(account?.dueDay ?? data.settings.dueDay);
  const used = account && data.transactions.some((t) => t.accountId === account.id || t.toAccountId === account.id);
  // Nguồn đang có giao dịch: xoá thì chuyển giao dịch sang nguồn khác.
  const others = data.accounts.filter((a) => a.id !== account?.id);
  const [moveTo, setMoveTo] = useState(others.find((a) => a.kind !== 'credit')?.id ?? others[0]?.id ?? '');

  return (
    <Sheet title={cardOnly ? (account ? L.card.editCard : L.card.addCard) : account ? T.accountTitleEdit : T.accountTitleNew} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          const id = account?.id ?? uid();
          // Giữ số dư đã nhập khi đổi tên / loại.
          const days = kind === 'credit' ? { cutoffDay, dueDay } : { cutoffDay: undefined, dueDay: undefined };
          dispatch({ type: 'upsertAccount', account: { ...account, id, name: name.trim(), kind, ...days } });
          onSaved?.(id);
          onClose();
        }}
      >
        <label className="field">
          <span>{T.accountName}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={T.accountNamePlaceholder} autoFocus={!isTouch} required />
        </label>
        {!cardOnly && (
          <div className="kind-grid" role="radiogroup" aria-label={T.accountKindAria}>
            {accountKinds.map((k) => (
              <button type="button" role="radio" key={k.id} aria-checked={kind === k.id} onClick={() => setKind(k.id)}>
                <Art name={k.icon} />
                {k.label}
              </button>
            ))}
          </div>
        )}
        {kind === 'credit' && (
          <div className="field-row">
            <label className="field">
              <span>{T.cardCutoff}</span>
              <NumberInput min={1} max={31} value={cutoffDay} onChange={setCutoffDay} />
            </label>
            <label className="field">
              <span>{T.cardDue}</span>
              <NumberInput min={1} max={31} value={dueDay} onChange={setDueDay} />
            </label>
          </div>
        )}
        <button type="submit" className="btn btn--primary btn--block" disabled={!name.trim()}>
          {T.save}
        </button>
        {account && used && others.length > 0 && (
          <label className="field">
            <span>{T.moveTo}</span>
            <select value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
              {others.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {account && (
          <button
            type="button"
            className="btn btn--danger-ghost btn--block"
            disabled={used && !others.length}
            onClick={() => {
              const target = others.find((a) => a.id === moveTo);
              if (used && target) {
                if (confirm(t(T.confirmMergeAccount, { name: account.name, to: target.name }))) {
                  dispatch({ type: 'mergeAccount', from: account.id, to: target.id });
                  onClose();
                }
              } else if (confirm(t(T.confirmDeleteAccount, { name: account.name }))) {
                dispatch({ type: 'deleteAccount', id: account.id });
                onClose();
              }
            }}
          >
            {used ? T.deleteAndMove : T.delete}
          </button>
        )}
      </form>
    </Sheet>
  );
}

const categoryKinds: { id: CategoryKind; label: string }[] = [
  { id: 'spend', label: T.catKindSpend },
  { id: 'fixed', label: T.catKindFixed },
  { id: 'income', label: T.catKindIncome },
];

export function CategoryForm({
  category,
  defaultKind = 'spend',
  onClose,
  onSaved,
}: {
  category?: Category;
  defaultKind?: CategoryKind;
  onClose: () => void;
  onSaved?: (id: string) => void;
}) {
  const { data, dispatch } = useStore();
  const [name, setName] = useState(category?.name ?? '');
  const [kind, setKind] = useState<CategoryKind>(category?.kind ?? defaultKind);
  const [iconName, setIconName] = useState(category ? catIcon(category.id, category) : 'bag');
  const [color, setColor] = useState(category ? catColor(category.id, category) : palette[0]);
  const used = category && data.transactions.some((t) => t.categoryId === category.id);

  return (
    <Sheet title={category ? T.categoryTitleEdit : T.categoryTitleNew} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          const id = category?.id ?? uid();
          dispatch({ type: 'upsertCategory', category: { id, name: name.trim(), icon: '', kind, iconName, color } });
          onSaved?.(id);
          onClose();
        }}
      >
        <div className="cat-preview">
          <span className="cat-badge" style={{ width: 64, height: 64, color, background: `${color}26` }}>
            <Art name={iconName} size={44} />
          </span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={T.categoryNamePlaceholder} autoFocus={!isTouch} required className="note-input" />
        </div>
        {category?.kind !== 'installment' && (
          <div className="segmented">
            {categoryKinds.map((k) => (
              <button type="button" key={k.id} aria-pressed={kind === k.id} onClick={() => setKind(k.id)}>
                {k.label}
              </button>
            ))}
          </div>
        )}
        <div className="swatches" role="radiogroup" aria-label={T.colorAria}>
          {palette.map((c) => (
            <button type="button" role="radio" key={c} aria-checked={color === c} aria-label={c} style={{ background: c }} onClick={() => setColor(c)} />
          ))}
        </div>
        <div className="icon-grid" role="radiogroup" aria-label={T.iconAria}>
          {pickableIcons.map((n) => (
            <button
              type="button"
              role="radio"
              key={n}
              aria-checked={iconName === n}
              aria-label={n}
              style={iconName === n ? { color, background: `${color}26`, borderColor: color } : undefined}
              onClick={() => setIconName(n)}
            >
              <Art name={n} />
            </button>
          ))}
        </div>
        <button type="submit" className="btn btn--primary btn--block" disabled={!name.trim()}>
          {T.save}
        </button>
        {category && category.kind !== 'installment' && (
          <button
            type="button"
            className="btn btn--danger-ghost btn--block"
            disabled={used}
            onClick={() => {
              if (confirm(t(T.confirmDeleteCategory, { name: category.name }))) {
                dispatch({ type: 'deleteCategory', id: category.id });
                onClose();
              }
            }}
          >
            {used ? T.inUseCannotDelete : T.delete}
          </button>
        )}
      </form>
    </Sheet>
  );
}
