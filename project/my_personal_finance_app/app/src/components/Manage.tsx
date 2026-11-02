import { useState } from 'react';
import { isTouch } from '../viewport';
import { uid } from '../domain/format';
import type { Account, AccountKind, Category, CategoryKind } from '../domain/types';
import { useStore } from '../store';
import { Icon, catColor, catIcon, palette, pickableIcons } from './icons';
import { Sheet } from './ui';
import { L } from '../labels';
import { t } from '../i18n';

const T = L.manage;

export const accountKinds: { id: AccountKind; label: string; icon: string }[] = [
  { id: 'credit', label: T.kindCredit, icon: 'card' },
  { id: 'ewallet', label: T.kindEwallet, icon: 'ewallet' },
  { id: 'bank', label: T.kindBank, icon: 'bank' },
  { id: 'cash', label: T.kindCash, icon: 'money' },
];

export function AccountForm({ account, onClose, onSaved }: { account?: Account; onClose: () => void; onSaved?: (id: string) => void }) {
  const { data, dispatch } = useStore();
  const [name, setName] = useState(account?.name ?? '');
  const [kind, setKind] = useState<AccountKind>(account?.kind ?? 'bank');
  const used = account && data.transactions.some((t) => t.accountId === account.id || t.toAccountId === account.id);

  return (
    <Sheet title={account ? T.accountTitleEdit : T.accountTitleNew} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          const id = account?.id ?? uid();
          dispatch({ type: 'upsertAccount', account: { id, name: name.trim(), kind } });
          onSaved?.(id);
          onClose();
        }}
      >
        <label className="field">
          <span>{T.accountName}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={T.accountNamePlaceholder} autoFocus={!isTouch} required />
        </label>
        <div className="kind-grid" role="radiogroup" aria-label={T.accountKindAria}>
          {accountKinds.map((k) => (
            <button type="button" role="radio" key={k.id} aria-checked={kind === k.id} onClick={() => setKind(k.id)}>
              <Icon name={k.icon} />
              {k.label}
            </button>
          ))}
        </div>
        <button type="submit" className="btn btn--primary btn--block" disabled={!name.trim()}>
          {T.save}
        </button>
        {account && (
          <button
            type="button"
            className="btn btn--danger-ghost btn--block"
            disabled={used}
            title={used ? T.accountInUseTitle : undefined}
            onClick={() => {
              if (confirm(t(T.confirmDeleteAccount, { name: account.name }))) {
                dispatch({ type: 'deleteAccount', id: account.id });
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
            <Icon name={iconName} size={34} />
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
              <Icon name={n} />
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
