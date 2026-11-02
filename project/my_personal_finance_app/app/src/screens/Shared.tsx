/** Sổ chung: nhiều người cùng ghi, app tự tính ai nợ ai. Tải riêng (Firebase) khi mở màn hình này. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { todayISO } from '../domain/calc';
import { dayLabel, money, uid } from '../domain/format';
import { useStore } from '../store';
import { isTouch } from '../viewport';
import { Card, Empty, MoneyInput, Sheet } from '../components/ui';
import { Icon } from '../components/icons';
import { balances, settlements, splitEqually, totals, type Ledger, type SharedEntry } from '../shared/balance';
import { clearJoinLink, inviteLink } from '../shared/config';
import {
  addEntry,
  createLedger,
  deleteEntry,
  joinLedger,
  leaveLedger,
  renameLedger,
  signIn,
  renderSignInButton,
  hasClientId,
  signOut,
  updateEntry,
  watchEntries,
  watchLedgers,
  watchUser,
  type User,
} from '../shared/firebase';
import { L } from '../labels';
import { Rich, t } from '../i18n';

const CURRENT_KEY = 'vi-cua-nang/ledger';

export default function Shared({ joinId }: { joinId: string | null }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [ledgers, setLedgers] = useState<Ledger[] | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(CURRENT_KEY);
    } catch {
      return null;
    }
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => watchUser(setUser), []);
  useEffect(() => {
    if (!user) return setLedgers(null);
    return watchLedgers(user.uid, setLedgers, (e) => setError(e.message));
  }, [user]);

  // Mở từ link mời: tham gia ngay sau khi đăng nhập.
  useEffect(() => {
    if (!user || !joinId) return;
    joinLedger(joinId, user)
      .then(() => select(joinId))
      .catch((e) => setError(e.message))
      .finally(clearJoinLink);
  }, [user, joinId]);

  function select(id: string | null) {
    setCurrentId(id);
    try {
      if (id) localStorage.setItem(CURRENT_KEY, id);
      else localStorage.removeItem(CURRENT_KEY);
    } catch {
      /* bỏ qua */
    }
  }

  async function login() {
    setBusy(true);
    setError('');
    try {
      await signIn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (user === undefined) return <Empty>{L.shared.loading}</Empty>;

  if (!user)
    return (
      <div className="stack">
        <Card tone="accent">
          <p className="eyebrow">{L.shared.eyebrow}</p>
          <p className="shared-intro">{L.shared.intro}</p>
          {hasClientId ? (
            <GoogleButton onError={(e) => setError(e.message)} />
          ) : (
            <button className="btn btn--on-accent" onClick={login} disabled={busy}>
              {busy ? L.shared.opening : L.shared.login}
            </button>
          )}
        </Card>
        {joinId && <p className="hint hint--center">{L.shared.joinHint}</p>}
        {error && <p className="hint neg">{error}</p>}
        <p className="hint hint--center">{L.shared.privacyHint}</p>
      </div>
    );

  const current = ledgers?.find((l) => l.id === currentId) ?? ledgers?.[0];

  return (
    <div className="stack">
      {error && <p className="hint neg">{error}</p>}
      {ledgers && (
        <div className="chips chips--scroll">
          {ledgers.map((l) => (
            <button key={l.id} className="chip" aria-pressed={l.id === current?.id} onClick={() => select(l.id)}>
              {l.name}
            </button>
          ))}
          <button className="chip" onClick={() => setCreating(true)}>
            <Icon name="plus" size={16} /> {L.shared.newLedgerChip}
          </button>
        </div>
      )}
      {ledgers === null ? (
        <Empty>{L.shared.loading}</Empty>
      ) : !current ? (
        <Card>
          <Empty>{L.shared.noLedger}</Empty>
          <button className="btn btn--primary btn--block" onClick={() => setCreating(true)}>
            {L.shared.createLedger}
          </button>
        </Card>
      ) : (
        <LedgerView key={current.id} ledger={current} me={user} onLeft={() => select(null)} />
      )}
      <button className="link link--center" onClick={() => signOut()}>
        {t(L.shared.logout, { email: user.email ?? '' })}
      </button>
      {creating && (
        <NameSheet
          title={L.shared.newLedgerTitle}
          placeholder={L.shared.newLedgerPlaceholder}
          onClose={() => setCreating(false)}
          onSave={async (name) => select(await createLedger(name, user))}
        />
      )}
    </div>
  );
}

function LedgerView({ ledger, me, onLeft }: { ledger: Ledger; me: User; onLeft: () => void }) {
  const [entries, setEntries] = useState<SharedEntry[] | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<SharedEntry | 'new' | null>(null);
  const [settling, setSettling] = useState<{ from: string; to: string; amount: number } | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [copied, setCopied] = useState(false);
  const today = todayISO();

  useEffect(() => watchEntries(ledger.id, setEntries, (e) => setError(e.message)), [ledger.id]);

  const name = (id: string) => (id === me.uid ? L.shared.you : ledger.people[id]?.name ?? L.shared.formerMember);
  const bal = useMemo(() => balances(entries ?? [], ledger.members), [entries, ledger.members]);
  const plan = useMemo(() => settlements(bal), [bal]);
  const mine = Math.round(bal[me.uid] ?? 0);
  const sum = totals(entries ?? [], me.uid);

  const groups = useMemo(() => {
    const m = new Map<string, SharedEntry[]>();
    for (const e of entries ?? []) m.set(e.date, [...(m.get(e.date) ?? []), e]);
    return [...m.entries()];
  }, [entries]);

  async function invite() {
    const url = inviteLink(ledger.id);
    const text = t(L.shared.inviteText, { name: ledger.name });
    try {
      if (navigator.share) return await navigator.share({ title: ledger.name, text, url });
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* người dùng đóng bảng chia sẻ */
    }
  }

  return (
    <>
      <Card tone="accent">
        <p className="eyebrow">{mine > 0 ? L.shared.youGet : mine < 0 ? L.shared.youOwe : L.shared.settled}</p>
        <p className="hero-amount">{money(Math.abs(mine))}</p>
        <p className="shared-sub">
          {t(L.shared.groupSummary, { group: money(sum.group), mine: money(sum.mine) })}
        </p>
        <button className="btn btn--on-accent" onClick={() => setEditing('new')}>
          <Icon name="plus" size={18} /> {L.shared.addEntry}
        </button>
      </Card>

      {plan.length > 0 && (
        <Card title={L.shared.toPayTitle}>
          <ul className="plain-list">
            {plan.map((p) => (
              <li key={`${p.from}-${p.to}`}>
                <button className="row-btn" onClick={() => setSettling(p)}>
                  <span>
                    <b>
                      {name(p.from)} → {name(p.to)}
                    </b>
                    <small>{L.shared.tapWhenPaid}</small>
                  </span>
                  <b>{money(p.amount)}</b>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card
        title={ledger.name}
        action={
          <button className="link" onClick={() => setRenaming(true)}>
            {L.shared.rename}
          </button>
        }
      >
        <div className="members">
          {ledger.members.map((id) => (
            <span key={id} className="member">
              <MemberDot name={name(id)} photo={ledger.people[id]?.photo} />
              <small>{name(id)}</small>
            </span>
          ))}
          <button className="member member--add" onClick={invite}>
            <span className="member-dot">
              <Icon name="group_add" size={20} />
            </span>
            <small>{copied ? L.shared.linkCopied : L.shared.invite}</small>
          </button>
        </div>
      </Card>

      {error && <p className="hint neg">{error}</p>}
      {entries === null ? (
        <Empty>{L.shared.loading}</Empty>
      ) : groups.length === 0 ? (
        <Empty>{L.shared.noEntries}</Empty>
      ) : (
        groups.map(([date, list]) => (
          <section key={date} className="day">
            <h3 className="day__head">{dayLabel(date, today)}</h3>
            <ul className="tx-list">
              {list.map((e) => (
                <li key={e.id}>
                  <button className="tx" onClick={() => setEditing(e)}>
                    <span className="shared-badge">
                      <Icon name={e.kind === 'settle' ? 'swap_horiz' : 'groups'} size={20} />
                    </span>
                    <span className="tx__main">
                      <span className="tx__title">{e.kind === 'settle' ? t(L.shared.settleLine, { from: name(e.paidBy), to: name(Object.keys(e.shares)[0]) }) : e.title}</span>
                      <span className="tx__meta">{e.kind === 'settle' ? L.shared.settleMeta : t(L.shared.paidBy, { name: name(e.paidBy) })}</span>
                    </span>
                    <span className="tx__amt">
                      <span className={e.kind === 'settle' ? 'pos' : ''}>{money(e.amount)}</span>
                      {e.kind === 'expense' && e.shares[me.uid] !== undefined && <small>{t(L.shared.yourShare, { amount: money(e.shares[me.uid]) })}</small>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <button
        className="link link--center neg"
        onClick={() => {
          if (!confirm(t(L.shared.leaveConfirm, { name: ledger.name }))) return;
          leaveLedger(ledger.id, me.uid).then(onLeft, (e) => setError(e.message));
        }}
      >
        {L.shared.leave}
      </button>

      {editing && <EntryForm ledger={ledger} me={me} entry={editing === 'new' ? undefined : editing} name={name} onClose={() => setEditing(null)} />}
      {settling && <SettleForm ledger={ledger} me={me} plan={settling} name={name} onClose={() => setSettling(null)} />}
      {renaming && (
        <NameSheet title={L.shared.renameTitle} initial={ledger.name} onClose={() => setRenaming(false)} onSave={(n) => renameLedger(ledger.id, n)} />
      )}
    </>
  );
}

function MemberDot({ name, photo }: { name: string; photo?: string }) {
  return (
    <span className="member-dot">
      {photo ? <img src={photo} alt="" referrerPolicy="no-referrer" /> : name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

function EntryForm({
  ledger,
  me,
  entry,
  name,
  onClose,
}: {
  ledger: Ledger;
  me: User;
  entry?: SharedEntry;
  name: (id: string) => string;
  onClose: () => void;
}) {
  const { data, dispatch } = useStore();
  // Người đã rời sổ nhưng còn trong khoản cũ vẫn hiện để sửa cho đúng.
  const people = [...new Set([...ledger.members, ...(entry ? [entry.paidBy, ...Object.keys(entry.shares)] : [])])];
  const [amount, setAmount] = useState(entry?.amount ?? 0);
  const [title, setTitle] = useState(entry?.title ?? '');
  const [date, setDate] = useState(entry?.date ?? todayISO());
  const [paidBy, setPaidBy] = useState(entry?.paidBy ?? me.uid);
  const [included, setIncluded] = useState<string[]>(entry ? Object.keys(entry.shares) : ledger.members);
  const isEqual = (e: SharedEntry) => {
    const eq = splitEqually(e.amount, Object.keys(e.shares));
    return Object.entries(e.shares).every(([k, v]) => Math.abs(eq[k] - v) <= 1);
  };
  const [custom, setCustom] = useState(entry ? !isEqual(entry) : false);
  const [parts, setParts] = useState<Record<string, number>>(entry?.shares ?? {});
  const credit = data.accounts.find((a) => a.kind === 'credit') ?? data.accounts[0];
  const [toWallet, setToWallet] = useState(!entry);
  const [accountId, setAccountId] = useState(credit?.id ?? '');
  const spendCats = data.categories.filter((c) => c.kind === 'spend');
  const [categoryId, setCategoryId] = useState(spendCats.find((c) => c.id === 'food')?.id ?? spendCats[0]?.id ?? 'other');

  const shares = custom ? Object.fromEntries(included.map((p) => [p, parts[p] ?? 0])) : splitEqually(amount, included);
  const left = amount - Object.values(shares).reduce((a, b) => a + b, 0);
  const valid = amount > 0 && title.trim() && included.length > 0 && left === 0;

  function save() {
    if (!valid) return;
    const e = { kind: 'expense' as const, date, title: title.trim(), amount, paidBy, shares };
    if (entry) updateEntry(ledger.id, entry.id, e);
    else {
      addEntry(ledger.id, { ...e, createdBy: me.uid, createdAt: Date.now() });
      // Mình trả bằng thẻ / ví của mình → ghi luôn vào ví riêng (phần của mình tính vào ngân sách).
      if (toWallet && paidBy === me.uid && accountId) {
        dispatch({
          type: 'upsertTx',
          tx: {
            id: uid(),
            date,
            merchant: title.trim(),
            amount,
            myShare: shares[me.uid] ?? 0,
            categoryId,
            accountId,
            reimbursed: 0,
            note: t(L.shared.form.walletNote, { name: ledger.name }),
            source: `shared:${ledger.id}`,
          },
        });
      }
    }
    onClose();
  }

  if (entry?.kind === 'settle')
    return (
      <Sheet title={L.shared.settleSheetTitle} onClose={onClose}>
        <div className="form">
          <p className="muted">
            <Rich
              text={L.shared.settleDetail}
              vars={{ from: name(entry.paidBy), to: name(Object.keys(entry.shares)[0]), amount: money(entry.amount), day: dayLabel(entry.date, todayISO()) }}
            />
          </p>
          <button
            className="btn btn--danger-ghost btn--block"
            onClick={() => {
              if (confirm(L.shared.deleteSettleConfirm)) {
                deleteEntry(ledger.id, entry.id);
                onClose();
              }
            }}
          >
            {L.shared.delete}
          </button>
        </div>
      </Sheet>
    );

  return (
    <Sheet title={entry ? L.shared.form.titleEdit : L.shared.form.titleNew} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="amount-xl">
          <MoneyInput value={amount} onChange={setAmount} autoFocus={!entry && !isTouch} placeholder="0" aria-label={L.shared.form.amountAria} />
        </div>
        <input className="note-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={L.shared.form.titlePlaceholder} />
        <div className="opt-row">
          <label className="opt">
            <Icon name="calendar" size={15} />
            {dayLabel(date, todayISO())}
            <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label={L.shared.form.dateAria} />
          </label>
        </div>

        <div className="field">
          <span>{L.shared.form.whoPaid}</span>
          <div className="chips">
            {people.map((p) => (
              <button type="button" key={p} className="chip" aria-pressed={paidBy === p} onClick={() => setPaidBy(p)}>
                {name(p)}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span>{L.shared.form.splitFor}</span>
          <div className="chips">
            {people.map((p) => (
              <button
                type="button"
                key={p}
                className="chip"
                aria-pressed={included.includes(p)}
                onClick={() => setIncluded((xs) => (xs.includes(p) ? xs.filter((x) => x !== p) : [...xs, p]))}
              >
                {name(p)}
              </button>
            ))}
          </div>
        </div>

        <div className="segmented">
          <button type="button" aria-pressed={!custom} onClick={() => setCustom(false)}>
            {L.shared.form.splitEqual}
          </button>
          <button
            type="button"
            aria-pressed={custom}
            onClick={() => {
              setParts(shares);
              setCustom(true);
            }}
          >
            {L.shared.form.splitCustom}
          </button>
        </div>
        {custom ? (
          <div className="share-list">
            {included.map((p) => (
              <label key={p} className="share-row">
                <span>{name(p)}</span>
                <MoneyInput value={parts[p] ?? 0} onChange={(n) => setParts((x) => ({ ...x, [p]: n }))} />
              </label>
            ))}
            {left !== 0 && <p className={`hint ${left < 0 ? 'neg' : ''}`}>{left > 0 ? t(L.shared.form.left, { amount: money(left) }) : t(L.shared.form.over, { amount: money(-left) })}</p>}
          </div>
        ) : (
          included.length > 0 &&
          amount > 0 && (
            <p className="hint">
              {t(L.shared.form.perPerson, { amount: money(Math.floor(amount / included.length)) })}
              {included.includes(me.uid) && t(L.shared.form.perPersonMine, { amount: money(shares[me.uid]) })}
            </p>
          )
        )}

        {!entry && paidBy === me.uid && (
          <>
            <label className="switch-row">
              <span>
                {L.shared.form.toWallet}
                <small>{L.shared.form.toWalletSub}</small>
              </span>
              <input type="checkbox" checked={toWallet} onChange={(e) => setToWallet(e.target.checked)} />
            </label>
            {toWallet && (
              <div className="opt-row">
                <label className="opt">
                  <Icon name="card" size={15} />
                  <select value={accountId} onChange={(e) => setAccountId(e.target.value)} aria-label={L.shared.form.accountAria}>
                    {data.accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="opt">
                  <Icon name="tag" size={15} />
                  <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} aria-label={L.shared.form.categoryAria}>
                    {spendCats.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </>
        )}

        <button className="btn btn--primary btn--block" type="submit" disabled={!valid}>
          {L.shared.form.save}
        </button>
        {entry && (
          <button
            type="button"
            className="btn btn--danger-ghost btn--block"
            onClick={() => {
              if (confirm(L.shared.form.deleteConfirm)) {
                deleteEntry(ledger.id, entry.id);
                onClose();
              }
            }}
          >
            {L.shared.form.delete}
          </button>
        )}
      </form>
    </Sheet>
  );
}

function SettleForm({
  ledger,
  me,
  plan,
  name,
  onClose,
}: {
  ledger: Ledger;
  me: User;
  plan: { from: string; to: string; amount: number };
  name: (id: string) => string;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState(plan.amount);
  return (
    <Sheet title={`${name(plan.from)} → ${name(plan.to)}`} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (amount <= 0) return;
          addEntry(ledger.id, {
            kind: 'settle',
            date: todayISO(),
            title: L.shared.settleForm.entryTitle,
            amount,
            paidBy: plan.from,
            shares: { [plan.to]: amount },
            createdBy: me.uid,
            createdAt: Date.now(),
          });
          onClose();
        }}
      >
        <label className="field field--big">
          <span>{L.shared.settleForm.sent}</span>
          <MoneyInput value={amount} onChange={setAmount} />
        </label>
        <button className="btn btn--primary btn--block" type="submit">
          {L.shared.settleForm.submit}
        </button>
      </form>
    </Sheet>
  );
}

function NameSheet({
  title,
  initial = '',
  placeholder,
  onSave,
  onClose,
}: {
  title: string;
  initial?: string;
  placeholder?: string;
  onSave: (name: string) => unknown;
  onClose: () => void;
}) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState('');
  return (
    <Sheet title={title} onClose={onClose}>
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!value.trim()) return;
          try {
            await onSave(value.trim());
            onClose();
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
          }
        }}
      >
        <label className="field">
          <span>{L.shared.ledgerName}</span>
          <input value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} autoFocus={!isTouch} />
        </label>
        {error && <p className="hint neg">{error}</p>}
        <button className="btn btn--primary btn--block" type="submit" disabled={!value.trim()}>
          {L.shared.save}
        </button>
      </form>
    </Sheet>
  );
}

/** Nút "Đăng nhập bằng Google" chính chủ (Google tự vẽ). */
function GoogleButton({ onError }: { onError: (e: Error) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) renderSignInButton(ref.current, onError).catch(onError);
  }, []);
  return <div ref={ref} className="gis-btn" />;
}
