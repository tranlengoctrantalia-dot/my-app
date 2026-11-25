import { isTouch } from '../viewport';
import { useRef, useState, type ReactNode } from 'react';
import { starterData } from '../data/starter';
import { todayISO } from '../domain/calc';
import { money, uid } from '../domain/format';
import { customRatios, peopleOf, personName, presetLabel } from '../domain/split';
import type { Account, Category, Person, SplitPreset } from '../domain/types';
import { isAppData, useStore } from '../store';
import { Card, MoneyInput, NumberInput, Sheet, Info } from '../components/ui';
import { DriveCard } from '../sync/DriveCard';
import { useDriveSync } from '../sync/DriveSync';
import { AccountForm, CategoryForm, accountKinds } from '../components/Manage';
import { Art, CatBadge, Icon, type IconName } from '../components/icons';
import { LookPicker } from '../components/LookPicker';
import { RecurringSection } from './Recurring';
import { MigrateCard } from '../components/MigrateCard';
import { LockSection, RemindSection } from './Security';
import { activeCount } from '../remind';
import { getLock } from '../lock';
import { Guide } from './Guide';
import { DEFAULT_GEMINI_MODEL, GEMINI_MODELS, getApiKey, getGeminiModel, getProvider, setApiKey, setGeminiModel, setProvider } from '../ai/key';
import { forgetGmailAccount, getGmailAccount } from '../sync/gmail';
import { L } from '../labels';
import { t } from '../i18n';

export type Section = 'account' | 'help' | 'look' | 'remind' | 'lock' | 'money' | 'sources' | 'recurring' | 'categories' | 'split' | 'ai' | 'data';

/** Gom 12 mục thành 4 nhóm cho dễ tìm. */
const menuGroups: { title: string; ids: Section[] }[] = [
  { title: L.settings.groups.money, ids: ['money', 'sources', 'recurring', 'categories', 'split'] },
  { title: L.settings.groups.remind, ids: ['remind', 'lock'] },
  { title: L.settings.groups.look, ids: ['look'] },
  { title: L.settings.groups.data, ids: ['account', 'data', 'ai', 'help'] },
];

export function Settings({ initial, theme, toggleTheme, onShared }: { initial?: Section; theme: string; toggleTheme: () => void; onShared?: () => void }) {
  const { data } = useStore();
  const { session } = useDriveSync();
  const [section, setSection] = useState<Section | null>(initial ?? null);
  const s = data.settings;

  const menu: { id: Section; icon: IconName; title: string; sub: string }[] = [
    { id: 'account', icon: 'user', title: L.settings.menu.account, sub: session ? session.email : L.settings.menu.accountNoLogin },
    { id: 'help', icon: 'help', title: L.settings.menu.help, sub: '' },
    { id: 'look', icon: 'palette', title: L.settings.menu.look, sub: '' },
    {
      id: 'remind',
      icon: 'notifications',
      title: L.remind.menu,
      sub: activeCount(data) ? t(L.remind.menuOn, { n: activeCount(data) }) : L.remind.menuOff,
    },
    { id: 'lock', icon: 'lock', title: L.lock.menu, sub: getLock() ? L.lock.menuOn : L.lock.menuOff },
    { id: 'money', icon: 'wallet', title: L.settings.menu.money, sub: t(L.settings.menu.moneySub, { cash: money(s.cashOnHand), day: s.salaryDay }) },
    { id: 'sources', icon: 'card', title: L.settings.menu.sources, sub: t(L.settings.menu.sourcesSub, { n: data.accounts.length }) },
    {
      id: 'recurring',
      icon: 'calendar',
      title: L.recurring.menuTitle,
      sub: data.recurring?.length ? t(L.recurring.menuSub, { n: data.recurring.length }) : L.recurring.menuEmpty,
    },
    {
      id: 'categories',
      icon: 'tag',
      title: L.settings.menu.categories,
      sub: t(L.settings.menu.categoriesSub, { n: data.categories.filter((c) => c.kind !== 'installment').length }),
    },
    {
      id: 'split',
      icon: 'heart',
      title: L.settings.menu.split,
      sub: t(L.settings.menu.splitSub, { n: peopleOf(s).length, k: customRatios(s).length }),
    },
    {
      id: 'ai',
      icon: 'scan',
      title: L.settings.menu.ai,
      sub: getApiKey() ? t(L.settings.menu.aiUsing, { provider: getProvider() === 'gemini' ? 'Gemini' : 'Claude' }) : L.settings.menu.aiNoKey,
    },
    { id: 'data', icon: 'cloud', title: L.settings.menu.data, sub: session ? t(L.settings.menu.dataDrive, { email: session.email }) : L.settings.menu.dataSub },
  ];

  if (section) {
    const item = menu.find((m) => m.id === section)!;
    return (
      <div className="stack">
        <button className="section-back" onClick={() => setSection(null)}>
          <Icon name="left" size={20} />
          {item.title}
        </button>
        {section === 'account' && <AccountSection />}
        {section === 'help' && <Guide />}
        {section === 'look' && (
          <Card>
            <label className="switch-row">
              <span>{L.nav.darkMode}</span>
              <input type="checkbox" checked={theme === 'dark'} onChange={toggleTheme} />
            </label>
            <LookPicker />
          </Card>
        )}
        {section === 'remind' && <RemindSection />}
        {section === 'lock' && <LockSection />}
        {section === 'money' && <MoneySection />}
        {section === 'sources' && <SourcesSection />}
        {section === 'recurring' && <RecurringSection />}
        {section === 'categories' && <CategoriesSection />}
        {section === 'split' && <SplitSection />}
        {section === 'ai' && <AiSection />}
        {section === 'data' && <DataSection />}
      </div>
    );
  }

  const row = (icon: IconName, title: string, sub: string, onClick: () => void) => (
    <li key={title}>
      <button className="menu-row" onClick={onClick}>
        <span className="mini-icon">
          <Art name={icon} size={26} />
        </span>
        <span className="menu-row__text">
          <b>{title}</b>
          {sub && <small>{sub}</small>}
        </span>
        <Icon name="right" size={20} className="muted" />
      </button>
    </li>
  );

  return (
    <div className="stack">
      {menuGroups.map((g) => (
        <section key={g.title}>
          <h2 className="menu-group">{g.title}</h2>
          <ul className="menu-list">
            {g.ids.map((id) => {
              const m = menu.find((x) => x.id === id)!;
              return row(m.icon, m.title, m.sub, () => setSection(id));
            })}
            {g.ids.includes('split') && onShared && row('users', L.nav.shared, '', onShared)}
          </ul>
        </section>
      ))}
    </div>
  );
}

function useSet() {
  const { data, dispatch } = useStore();
  return [data.settings, (patch: Partial<typeof data.settings>) => dispatch({ type: 'settings', patch })] as const;
}

function MoneySection() {
  const [s, set] = useSet();
  return (
    <>
      <Card>
        <div className="form">
          <label className="field">
            <span>{L.settings.money.cashOnHand}</span>
            <MoneyInput value={s.cashOnHand} onChange={(n) => set({ cashOnHand: n })} />
          </label>
        </div>
      </Card>
      <Card title={L.settings.money.daysTitle}>
        <div className="field-row">
          <label className="field">
            <span>{L.settings.money.cutoffDay}</span>
            <NumberInput min={1} max={31} value={s.cutoffDay} onChange={(n) => set({ cutoffDay: n })} />
          </label>
          <label className="field">
            <span>{L.settings.money.dueDay}</span>
            <NumberInput min={1} max={31} value={s.dueDay} onChange={(n) => set({ dueDay: n })} />
          </label>
          <label className="field">
            <span>{L.settings.money.salaryDay}</span>
            <NumberInput min={1} max={31} value={s.salaryDay} onChange={(n) => set({ salaryDay: n })} />
          </label>
        </div>
      </Card>
    </>
  );
}

function SourcesSection() {
  const { data } = useStore();
  const [edit, setEdit] = useState<Account | 'new' | null>(null);
  return (
    <Card>
      <ul className="plain-list">
        {data.accounts.map((a) => (
          <li key={a.id}>
            <button className="row-btn row-btn--icon" onClick={() => setEdit(a)}>
              <span className="mini-icon">
                <Art name={accountKinds.find((k) => k.id === a.kind)?.icon ?? 'money'} size={26} />
              </span>
              <span>
                <b>{a.name}</b>
                <small>{accountKinds.find((k) => k.id === a.kind)?.label}</small>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <button className="btn btn--block add-btn" onClick={() => setEdit('new')}>
        <Icon name="plus" size={20} /> {L.settings.addSource}
      </button>
      {edit && <AccountForm account={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}
    </Card>
  );
}

function CategoriesSection() {
  const { data } = useStore();
  const [edit, setEdit] = useState<Category | 'new' | null>(null);
  const groups = [
    ['spend', L.settings.groupSpend],
    ['fixed', L.settings.groupFixed],
    ['income', L.settings.groupIncome],
  ] as const;
  return (
    <Card>
      {groups.map(([kind, label]) => (
        <div key={kind} className="cat-group">
          <small className="cat-group__label">{label}</small>
          <div className="cat-chips">
            {data.categories
              .filter((c) => c.kind === kind)
              .map((c) => (
                <button key={c.id} className="cat-chip" onClick={() => setEdit(c)}>
                  <CatBadge id={c.id} size={26} />
                  {c.name}
                </button>
              ))}
          </div>
        </div>
      ))}
      <button className="btn btn--block add-btn" onClick={() => setEdit('new')}>
        <Icon name="plus" size={20} /> {L.settings.addCategory}
      </button>
      {edit && <CategoryForm category={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}
    </Card>
  );
}

/** Danh sách người hay chia tiền cùng: thêm, đổi tên, xoá. */
function PeopleCard() {
  const [s, set] = useSet();
  const P = L.settings.people;
  const people = peopleOf(s);
  const [edit, setEdit] = useState<Person | 'new' | null>(null);
  const [name, setName] = useState('');
  const open = (p: Person | 'new') => {
    setEdit(p);
    setName(p === 'new' ? '' : p.name);
  };
  return (
    <Card title={P.title} info={P.hint}>
      {people.length === 0 ? (
        <p className="empty">{P.empty}</p>
      ) : (
        <div className="chips">
          {people.map((p) => (
            <button key={p.id} className="chip" onClick={() => open(p)}>
              {p.name}
            </button>
          ))}
        </div>
      )}
      <button className="btn btn--block add-btn" onClick={() => open('new')}>
        <Icon name="plus" size={20} /> {P.add}
      </button>
      {edit && (
        <Sheet title={edit === 'new' ? P.formNew : P.formEdit} onClose={() => setEdit(null)}>
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              const n = name.trim();
              if (!n) return;
              set({ people: edit === 'new' ? [...people, { id: `p-${uid()}`, name: n }] : people.map((x) => (x.id === edit.id ? { ...x, name: n } : x)) });
              setEdit(null);
            }}
          >
            <label className="field">
              <span>{P.name}</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder={P.namePlaceholder} autoFocus={!isTouch} />
            </label>
            <button className="btn btn--primary btn--block" type="submit" disabled={!name.trim()}>
              {P.save}
            </button>
            {edit !== 'new' && (
              <button
                type="button"
                className="btn btn--danger-ghost btn--block"
                onClick={() => {
                  if (!confirm(t(P.confirmDelete, { name: edit.name }))) return;
                  set({ people: people.filter((x) => x.id !== edit.id) });
                  setEdit(null);
                }}
              >
                {P.delete}
              </button>
            )}
          </form>
        </Sheet>
      )}
    </Card>
  );
}

function SplitSection() {
  const [s] = useSet();
  const [edit, setEdit] = useState<SplitPreset | 'new' | null>(null);
  const ratios = customRatios(s);
  const describe = (p: SplitPreset) => t(L.settings.split.ratio, { mine: p.mine, otherPart: p.other });
  return (
    <>
      <PeopleCard />
      <Card title={L.settings.ratiosTitle} info={L.settings.ratiosHint}>
        {ratios.length === 0 && <p className="empty">{L.settings.ratiosEmpty}</p>}
        <ul className="plain-list">
          {ratios.map((p) => (
              <li key={p.id}>
                <button className="row-btn" onClick={() => setEdit(p)}>
                  <span>
                    <b>{presetLabel(p)}</b>
                    <small>{describe(p)}</small>
                  </span>
                  <Icon name="right" size={20} className="muted" />
                </button>
              </li>
            ))}
        </ul>
        <button className="btn btn--block add-btn" onClick={() => setEdit('new')}>
          <Icon name="plus" size={20} /> {L.settings.split.add}
        </button>
        {edit && <SplitPresetForm preset={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}
      </Card>
    </>
  );
}

export function SplitPresetForm({ preset, onClose, onSaved }: { preset?: SplitPreset; onClose: () => void; onSaved?: (id: string) => void }) {
  const [s, set] = useSet();
  const [name, setName] = useState(preset ? presetLabel(preset) : '');
  const [mine, setMine] = useState(preset?.mine ?? 1);
  const [other, setOther] = useState(preset?.other ?? 1);
  const list = s.splitPresets ?? [];
  const example = 300_000;
  const myPart = other === 0 ? example : Math.round((example * mine) / (mine + other || 1));
  const otherName = personName(s, preset?.counterparty) || L.settings.split.someone;

  return (
    <Sheet title={preset ? L.settings.splitForm.titleEdit : L.settings.splitForm.titleNew} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim() || mine + other === 0) return;
          // Cách chia chỉ là tỉ lệ; chia với ai thì chọn lúc ghi khoản.
          const p: SplitPreset = { id: preset?.id ?? `p-${uid()}`, name: name.trim(), mine, other, counterparty: other > 0 ? preset?.counterparty : undefined };
          set({ splitPresets: preset ? list.map((x) => (x.id === p.id ? p : x)) : [...list, p] });
          onSaved?.(p.id);
          onClose();
        }}
      >
        <label className="field">
          <span>{L.settings.splitForm.name}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={L.settings.splitForm.namePlaceholder} required />
        </label>
        <div className="ratio">
          <label className="field">
            <span>{L.settings.splitForm.minePart}</span>
            <NumberInput min={0} max={99} value={mine} onChange={setMine} />
          </label>
          <b>:</b>
          <label className="field">
            <span>{t(L.settings.splitForm.otherPart, { other: otherName })}</span>
            <NumberInput min={0} max={99} value={other} onChange={setOther} />
          </label>
        </div>
        <p className="hint">
          {t(L.settings.splitForm.example, { total: money(example), mine: money(myPart), other: otherName, back: money(example - myPart) })}
        </p>
        <button className="btn btn--primary btn--block" type="submit" disabled={!name.trim() || mine + other === 0}>
          {L.settings.splitForm.save}
        </button>
        {preset && (
          <button
            type="button"
            className="btn btn--danger-ghost btn--block"
            onClick={() => {
              set({ splitPresets: list.filter((x) => x.id !== preset.id) });
              onClose();
            }}
          >
            {L.settings.splitForm.delete}
          </button>
        )}
      </form>
    </Sheet>
  );
}

function AiSection() {
  const [s, set] = useSet();
  const [provider, setProv] = useState(getProvider());
  const [apiKey, setKey] = useState(getApiKey());
  const [model, setModel] = useState(getGeminiModel());
  const [gmail, setGmail] = useState(getGmailAccount());
  const [check, setCheck] = useState('');
  const [checking, setChecking] = useState(false);

  return (
    <>
      <Card>
        <div className="form">
          <div className="segmented" aria-label={L.settings.ai.chooseAria}>
            {(['gemini', 'claude'] as const).map((p) => (
              <button
                key={p}
                aria-pressed={provider === p}
                onClick={() => {
                  setProv(p);
                  setProvider(p);
                  setKey(getApiKey(p));
                  setCheck('');
                }}
              >
                {p === 'gemini' ? 'Gemini' : 'Claude'}
              </button>
            ))}
          </div>
          <label className="field">
            <span>{t(L.settings.ai.apiKey, { provider: provider === 'gemini' ? 'Gemini' : 'Claude' })}</span>
            <input
              type="password"
              value={apiKey}
              placeholder={provider === 'gemini' ? 'AIza…' : 'sk-ant-…'}
              autoComplete="off"
              onChange={(e) => {
                setKey(e.target.value);
                setApiKey(e.target.value, provider);
              }}
            />
          </label>
          {provider === 'gemini' && (
            <div className="check-row">
              <button
                className="btn btn--sm"
                disabled={!apiKey || checking}
                onClick={async () => {
                  setChecking(true);
                  setCheck('');
                  const { pingGemini } = await import('../ai/gemini');
                  setCheck(await pingGemini(apiKey.trim(), getGeminiModel()));
                  setChecking(false);
                }}
              >
                {checking ? L.settings.ai.checking : L.settings.ai.check}
              </button>
              {check && <span className={check.startsWith(L.errors.pingOk.split('{')[0]) ? 'pos' : 'neg'}>{check}</span>}
            </div>
          )}
          <p className="hint">
            {L.settings.ai.getKeyAt}{' '}
            {provider === 'gemini' ? (
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
                aistudio.google.com/apikey
              </a>
            ) : (
              <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
                console.anthropic.com
              </a>
            )}
            {L.settings.ai.keyLocal}
          </p>
          {provider === 'gemini' && (
            <div className="field">
              <span>{L.settings.ai.model}</span>
              <div className="chips">
                {GEMINI_MODELS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className="chip"
                    aria-pressed={model === m.id}
                    onClick={() => {
                      setModel(m.id);
                      setGeminiModel(m.id);
                    }}
                  >
                    {m.label} · {m.sub}
                  </button>
                ))}
              </div>
              <input
                value={GEMINI_MODELS.some((m) => m.id === model) ? '' : model}
                placeholder={L.settings.ai.modelOther}
                aria-label={L.settings.ai.modelOther}
                onChange={(e) => {
                  setModel(e.target.value.trim() || DEFAULT_GEMINI_MODEL);
                  setGeminiModel(e.target.value.trim());
                }}
              />
            </div>
          )}
        </div>
      </Card>
      <Card title={L.settings.ai.privacyTitle}>
        <div className="form">
          <label className="switch-row">
            <span>
              <b>{L.settings.ai.redact}</b>
              <Info>{L.settings.ai.redactSub}</Info>
            </span>
            <input type="checkbox" checked={s.aiRedact !== false} onChange={(e) => set({ aiRedact: e.target.checked })} />
          </label>
          <label className="field">
            <span>{L.settings.ai.privacyWords}</span>
            <input
              value={s.privacyWords ?? ''}
              placeholder={L.settings.ai.privacyWordsPlaceholder}
              onChange={(e) => set({ privacyWords: e.target.value || undefined })}
            />
          </label>
          <p className="hint">{L.settings.ai.privacyHint}</p>
        </div>
      </Card>
      <Card title={L.settings.ai.gmailTitle}>
        <div className="form">
          <div className="split-line">
            <span>{gmail || <span className="muted">{L.settings.ai.gmailPick}</span>}</span>
            {gmail && (
              <button
                className="link"
                onClick={() => {
                  forgetGmailAccount();
                  setGmail('');
                }}
              >
                {L.settings.ai.gmailChange}
              </button>
            )}
          </div>
          <label className="field">
            <span>{L.settings.ai.gmailQuery}</span>
            <input
              value={s.gmailQuery ?? ''}
              placeholder={L.settings.ai.gmailQueryPlaceholder}
              onChange={(e) => set({ gmailQuery: e.target.value || undefined })}
            />
          </label>
          <p className="hint">{L.settings.ai.gmailHint}</p>
        </div>
      </Card>
    </>
  );
}

/** Đăng nhập / đăng xuất các tài khoản Google, và dọn sạch máy khi dùng máy mượn. */
function AccountSection() {
  const { dispatch } = useStore();
  const drive = useDriveSync();
  const [gmail, setGmail] = useState(getGmailAccount());

  function signOutEverywhere() {
    if (!confirm(L.settings.account.wipeConfirm + (drive.session ? L.settings.account.wipeHasDrive : L.settings.account.wipeNoDrive))) return;
    drive.disconnect();
    forgetGmailAccount();
    try {
      // Xoá key AI, mật khẩu PDF, giao diện… mọi thứ app lưu trên máy này.
      Object.keys(localStorage)
        .filter((k) => k.startsWith('vi-cua-nang/'))
        .forEach((k) => localStorage.removeItem(k));
    } catch {
      /* bỏ qua */
    }
    dispatch({ type: 'replace', data: starterData() });
  }

  return (
    <>
      <Card title={L.settings.account.driveTitle}>
        <div className="split-line">
          <span>{drive.session ? drive.session.email : <span className="muted">{L.settings.account.notLoggedIn}</span>}</span>
          {drive.session ? (
            <button className="link neg" onClick={() => confirm(L.settings.account.driveLogoutConfirm) && drive.disconnect()}>
              {L.settings.account.logout}
            </button>
          ) : (
            drive.enabled && (
              <button className="link" onClick={drive.connect}>
                {L.settings.account.login}
              </button>
            )
          )}
        </div>
      </Card>
      <Card title={L.settings.account.gmailTitle}>
        <div className="split-line">
          <span>{gmail || <span className="muted">{L.settings.account.notLoggedIn}</span>}</span>
          {gmail && (
            <button
              className="link neg"
              onClick={() => {
                forgetGmailAccount();
                setGmail('');
              }}
            >
              {L.settings.account.logout}
            </button>
          )}
        </div>
      </Card>
      <Card title={L.settings.account.borrowedTitle} info={L.settings.account.borrowedHint}>
        <button className="btn btn--danger-ghost btn--block" onClick={signOutEverywhere}>
          {L.settings.account.wipeButton}
        </button>
      </Card>
    </>
  );
}

function DataSection() {
  const { data, dispatch } = useStore();
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  function exportJson() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vi-gon-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importJson(f: File) {
    try {
      const parsed = JSON.parse(await f.text());
      if (!isAppData(parsed)) throw new Error();
      if (confirm(L.settings.data.restoreConfirm)) dispatch({ type: 'replace', data: parsed });
    } catch {
      alert(L.settings.data.badFile);
    }
  }

  return (
    <>
      <DriveCard />
      <MigrateCard />
      <Card title={L.settings.data.viewTitle} info={L.settings.data.viewHint}>
        <button
          className="btn btn--primary btn--block add-btn"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              (await import('../exportExcel')).exportExcel(data);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? L.settings.data.exporting : L.settings.data.exportExcel}
        </button>
      </Card>
      <Card title={L.settings.data.jsonTitle} info={L.settings.data.jsonHint}>
        <Row>
          <button className="btn" onClick={exportJson}>
            {L.settings.data.download}
          </button>
          <button className="btn" onClick={() => file.current?.click()}>
            {L.settings.data.restore}
          </button>
        </Row>
        <input
          ref={file}
          type="file"
          accept="application/json"
          hidden
          onChange={(e) => {
            if (e.target.files?.[0]) importJson(e.target.files[0]);
            e.target.value = '';
          }}
        />
      </Card>
      <Card title={L.settings.data.resetTitle}>
        <Row>
          <button
            className="btn btn--danger-ghost"
            onClick={() => confirm(L.settings.data.resetAllConfirm) && dispatch({ type: 'replace', data: starterData() })}
          >
            {L.settings.data.resetAll}
          </button>
          <button
            className="btn btn--danger-ghost"
            onClick={() =>
              confirm(L.settings.data.clearConfirm) && dispatch({ type: 'replace', data: { ...data, transactions: [], installments: [], budgets: [] } })
            }
          >
            {L.settings.data.clear}
          </button>
        </Row>
      </Card>
    </>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className="form__actions form__actions--start row-gap">{children}</div>;
}
