/** Cài đặt → Nhắc nhở và Cài đặt → Khoá app. */
import { useEffect, useState } from 'react';
import type { Reminders } from '../domain/types';
import { useStore } from '../store';
import { Card } from '../components/ui';
import { askPermission, isIOS, isStandalone, notify, permission, registerBackground, type Perm } from '../remind';
import { bioAvailable, disableBio, disableLock, enableBio, setPin, useLockConfig } from '../lock';
import { L } from '../labels';
import { Rich, t } from '../i18n';

const R = L.remind;
const K = L.lock;

const HOURS = [8, 12, 19, 20, 21, 22];
const CARD_DAYS = [1, 2, 3, 5, 7];
const PCTS = [80, 90, 100];
/** Bật lần đầu thì dùng các mốc này. */
const DEFAULTS: Required<Reminders> = { dailyHour: 21, cardDays: 3, budgetPct: 90 };

export function RemindSection() {
  const { data, dispatch } = useStore();
  const r = data.settings.reminders ?? {};
  const [perm, setPerm] = useState<Perm>(permission);
  const hasCard = data.accounts.some((a) => a.kind === 'credit');

  const set = (patch: Partial<Reminders>) => dispatch({ type: 'settings', patch: { reminders: { ...r, ...patch } } });
  async function toggle(key: keyof Reminders, on: boolean) {
    set({ [key]: on ? DEFAULTS[key] : undefined });
    if (on && perm === 'default') setPerm(await askPermission());
    else if (on && perm === 'granted') void registerBackground();
  }

  const row = (key: keyof Reminders, title: string, sub: string, options: number[], label: (n: number) => string) => (
    <div className="remind-row">
      <label className="switch-row">
        <span>
          {title}
          <small>{sub}</small>
        </span>
        <input type="checkbox" checked={r[key] !== undefined} onChange={(e) => void toggle(key, e.target.checked)} />
      </label>
      {r[key] !== undefined && (
        <div className="chips">
          {options.map((n) => (
            <button key={n} type="button" className="chip" aria-pressed={r[key] === n} onClick={() => set({ [key]: n })}>
              {label(n)}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <>
      <Card title={R.permTitle}>
        {perm === 'granted' ? (
          <p className="pos">{R.permOn}</p>
        ) : perm === 'denied' ? (
          <p className="hint">{R.permDenied}</p>
        ) : perm === 'unsupported' || (isIOS() && !isStandalone()) ? (
          <p className="hint">{isIOS() ? <Rich text={R.iosHint} /> : R.permUnsupported}</p>
        ) : (
          <button className="btn btn--primary btn--block" onClick={async () => setPerm(await askPermission())}>
            {R.permAsk}
          </button>
        )}
        {perm === 'granted' && (
          <button className="btn btn--block" onClick={() => void notify(R.testTitle, R.testBody, 'test')}>
            {R.test}
          </button>
        )}
      </Card>
      <Card>
        {row('dailyHour', R.daily, R.dailySub, HOURS, (h) => t(R.hour, { h }))}
        {hasCard && row('cardDays', R.card, R.cardSub, CARD_DAYS, (n) => t(R.cardDays, { n }))}
        {row('budgetPct', R.budget, R.budgetSub, PCTS, (n) => `${n}%`)}
      </Card>
      <Card title={R.howTitle}>
        <p className="hint">
          <Rich text={R.how} />
        </p>
      </Card>
    </>
  );
}

export function LockSection() {
  const lock = useLockConfig();
  const [bio, setBio] = useState<boolean | null>(null);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    void bioAvailable().then(setBio);
  }, []);

  return (
    <>
      <Card>
        <label className="switch-row">
          <span>
            {K.enable}
            <small>{K.enableSub}</small>
          </span>
          <input
            type="checkbox"
            checked={!!lock || editing}
            onChange={(e) => {
              if (e.target.checked) setEditing(true);
              else {
                disableLock();
                setEditing(false);
              }
            }}
          />
        </label>
        {(editing || (!lock && editing)) && <PinForm onDone={() => setEditing(false)} />}
        {lock && !editing && (
          <>
            {bio ? (
              <label className="switch-row">
                <span>
                  {K.bio}
                  <small>{K.bioSub}</small>
                </span>
                <input
                  type="checkbox"
                  checked={!!lock.credId}
                  onChange={async (e) => {
                    if (!e.target.checked) return disableBio();
                    if (!(await enableBio())) alert(K.bioFailed);
                  }}
                />
              </label>
            ) : (
              bio === false && <p className="hint">{K.bioUnavailable}</p>
            )}
            <button className="btn btn--block" onClick={() => setEditing(true)}>
              {K.changePin}
            </button>
          </>
        )}
      </Card>
      <p className="hint">{K.note}</p>
    </>
  );
}

function PinForm({ onDone }: { onDone: () => void }) {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [err, setErr] = useState('');
  const digits = (v: string) => v.replace(/\D/g, '').slice(0, 6);
  return (
    <form
      className="form pin-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (a.length < 4) return setErr(K.pinShort);
        if (a !== b) return setErr(K.pinMismatch);
        await setPin(a);
        onDone();
      }}
    >
      <label className="field">
        <span>{K.setPin}</span>
        <input type="password" inputMode="numeric" autoComplete="new-password" value={a} onChange={(e) => (setA(digits(e.target.value)), setErr(''))} />
      </label>
      <label className="field">
        <span>{K.confirmPin}</span>
        <input type="password" inputMode="numeric" autoComplete="new-password" value={b} onChange={(e) => (setB(digits(e.target.value)), setErr(''))} />
      </label>
      {err && <p className="neg">{err}</p>}
      <button className="btn btn--primary btn--block" type="submit">
        {K.savePin}
      </button>
    </form>
  );
}
