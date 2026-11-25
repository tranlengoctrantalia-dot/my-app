import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { ChatBot } from './components/ChatBot';
import { NewTip } from './components/WhatsNew';
import { isLoan, nextDuePeriod, monthOf, todayISO } from './domain/calc';
import type { Transaction } from './domain/types';
import { useStore } from './store';
import { TxForm } from './components/TxForm';
import { Overview } from './screens/Overview';
import { Transactions } from './screens/Transactions';
import { CardStatement } from './screens/CardStatement';
import { Budget } from './screens/Budget';
import { Split } from './screens/Split';
import { Goals } from './screens/Goals';
import { Calendar } from './screens/Calendar';
import { LoanForm } from './components/LoanForm';
import { dailyDue, runReminders, saveBackgroundState } from './remind';
import { toggleHidden, useHidden } from './privacy';
import { Settings, type Section } from './screens/Settings';
import { Icon, type IconName } from './components/icons';
import { RippleAvatar } from './components/Avatar';
import { useTheme } from './theme';
import { Welcome } from './screens/Welcome';
import { Tour, tourSeen, type TourStep } from './components/Tour';
import { captureJoinLink, sharedEnabled } from './shared/config';
import { L } from './labels';

// Mở từ link mời vào sổ chung → nhớ mã sổ, vào thẳng màn hình sổ chung.
const joinId = captureJoinLink();

// Phần AI (SDK Claude + zod) khá nặng nên chỉ tải khi mở màn hình nhập tự động.
const Report = lazy(() => import('./screens/Report').then((m) => ({ default: m.Report })));
const Shared = lazy(() => import('./screens/Shared'));
const ImportSheet = lazy(() => import('./components/ImportSheet').then((m) => ({ default: m.ImportSheet })));

export type Tab = 'home' | 'tx' | 'card' | 'budget' | 'split' | 'settings' | 'shared' | 'report' | 'goals' | 'calendar';

const tabs: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'home', label: L.nav.tabs.home, icon: 'home' },
  { id: 'tx', label: L.nav.tabs.tx, icon: 'receipt' },
  { id: 'budget', label: L.nav.tabs.budget, icon: 'target' },
  { id: 'card', label: L.nav.tabs.card, icon: 'card' },
];
// Không có thẻ tín dụng: ô cuối thanh dưới thành "Chia tiền".
const splitTab: (typeof tabs)[number] = { id: 'split', label: L.nav.tabs.split, icon: 'users' };

const titles: Record<Tab, string> = {
  home: '',
  tx: L.nav.titles.tx,
  card: L.nav.titles.card,
  budget: L.nav.titles.budget,
  split: L.nav.titles.split,
  settings: L.nav.titles.settings,
  shared: L.nav.titles.shared,
  report: L.nav.titles.report,
  goals: L.goals.title,
  calendar: L.calendar.title,
};

const homeTour = (hasCard: boolean): TourStep[] => {
  const s = L.tour.home;
  return [
    { target: '.nav__add', ...s.add },
    { target: '.hero2', ...s.hero },
    { target: '.tiles', ...s.pills },
    { target: '[data-tour="tx"]', ...s.tx },
    { target: '[data-tour="budget"]', ...s.budget },
    hasCard ? { target: '[data-tour="card"]', ...s.card } : { target: '[data-tour="split"]', ...s.split },
    { target: '.avatar-btn', ...s.account },
    { target: '[data-tour="settings"]', ...s.settings },
  ];
};

export function App() {
  const { data } = useStore();
  // Màn chào trước; các kỳ / tháng chỉ tính sau khi đã biết ngày chốt thẻ.
  return data.setupPending ? <Welcome /> : <Main />;
}

function Main() {
  const { data, dispatch } = useStore();
  const dataRef = useRef(data);
  // Bật / tắt "Ẩn số tiền" thì vẽ lại cả app.
  const hidden = useHidden();
  dataRef.current = data;
  // Mở app (hoặc quay lại app) → tự ghi các khoản định kỳ đã tới ngày.
  useEffect(() => {
    const post = () => dispatch({ type: 'postRecurring', today: todayISO() });
    post();
    const onShow = () => document.visibilityState === 'visible' && post();
    document.addEventListener('visibilitychange', onShow);
    return () => document.removeEventListener('visibilitychange', onShow);
  }, [dispatch]);
  const [tab, setTab] = useState<Tab>(joinId && sharedEnabled ? 'shared' : 'home');
  const [spendPeriod, setSpendPeriod] = useState(() => monthOf(todayISO()));
  const [cardPeriod, setCardPeriod] = useState(() => nextDuePeriod(todayISO(), data.settings));
  // Bấm thông báo "nhắc ghi chi tiêu" → mở thẳng bảng ghi khoản.
  const [form, setForm] = useState<Transaction | 'new' | 'transfer' | null>(() => (new URLSearchParams(location.search).has('add') ? 'new' : null));
  useEffect(() => {
    if (location.search.includes('add')) history.replaceState(null, '', location.pathname);
  }, []);
  // Nhắc nhở: kiểm tra mỗi khi dữ liệu đổi / quay lại app, và hẹn giờ cho lời nhắc buổi tối nếu app đang mở.
  useEffect(() => {
    void runReminders(data);
    void saveBackgroundState(data);
    const h = data.settings.reminders?.dailyHour;
    if (h === undefined) return;
    const at = new Date();
    at.setHours(h, 0, 5, 0);
    const wait = at.getTime() - Date.now();
    if (wait <= 0) return;
    const id = setTimeout(() => void runReminders(data), wait);
    return () => clearTimeout(id);
  }, [data]);
  useEffect(() => {
    const onShow = () => document.visibilityState === 'visible' && void runReminders(dataRef.current);
    document.addEventListener('visibilitychange', onShow);
    return () => document.removeEventListener('visibilitychange', onShow);
  }, []);
  const [instCard, setInstCard] = useState<string | null>(null);
  const [loan, setLoan] = useState<Transaction | null>(null);
  const [newLoan, setNewLoan] = useState(false);
  const [payCard, setPayCard] = useState<{ amount: number; cardId: string; period: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const [settingsSection, setSettingsSection] = useState<Section>();
  const openSettings = (section?: Section) => {
    setSettingsSection(section);
    setTab('settings');
  };
  const [theme, toggleTheme] = useTheme();
  // Hướng dẫn nhanh: tự hiện cho người mới; "Xem lại" trong Hướng dẫn sử dụng thì hiện lại từ đầu.
  const [tourRun, setTourRun] = useState(data.transactions.length < 5 ? 1 : 0);
  useEffect(() => {
    const again = () => {
      setTab('home');
      setTourRun((n) => n + 1);
    };
    window.addEventListener('vg-tour-reset', again);
    return () => window.removeEventListener('vg-tour-reset', again);
  }, []);
  const edit = (t: Transaction) => (isLoan(t) ? setLoan(t) : setForm(t));
  const hasCard = data.accounts.some((a) => a.kind === 'credit');
  const isSub = (tab === 'split' && hasCard) || tab === 'settings' || tab === 'shared' || tab === 'report' || tab === 'goals' || tab === 'calendar';

  const navItem = (t: (typeof tabs)[number]) => (
    <button key={t.id} data-tour={t.id} className="nav__item" aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
      <Icon name={t.icon} size={22} />
      <span>{t.label}</span>
    </button>
  );

  return (
    <div className="shell">
      <nav className="nav" aria-label={L.nav.navAria}>
        <div className="nav__brand">
          <img src="/icon.svg" alt="" width={32} height={32} />
          <span>{L.nav.brand}</span>
        </div>
        {navItem(tabs[0])}
        {navItem(tabs[1])}
        <button className="nav__add" aria-label={L.nav.add} onClick={() => setForm('new')}>
          <Icon name="plus" size={30} />
          <span className="nav__add-label">{L.nav.add}</span>
        </button>
        {navItem(tabs[2])}
        {navItem(hasCard ? tabs[3] : splitTab)}
      </nav>
      <ChatBot />
      <main className="main">
        <header className="topbar">
          {isSub ? (
            <button className="back" onClick={() => setTab('home')}>
              <Icon name="left" size={22} />
              {titles[tab]}
            </button>
          ) : (
            <div className="topbar__title">
              <button className="avatar-btn" aria-label={L.nav.account} onClick={() => openSettings('account')}>
                <RippleAvatar size={44} />
              </button>
              {titles[tab] && <h1>{titles[tab]}</h1>}
            </div>
          )}
          <div className="topbar__actions">
            <button className="icon-btn" aria-label={hidden ? L.privacy.show : L.privacy.hide} aria-pressed={hidden} onClick={toggleHidden}>
              <Icon name={hidden ? 'visibility_off' : 'visibility'} />
            </button>
            {!isSub && (
              <button className="icon-btn" data-tour="settings" aria-label={L.nav.settings} onClick={() => openSettings()}>
                <Icon name="settings" />
              </button>
            )}
          </div>
        </header>
        {tab === 'home' && (
          <Overview
            go={(t) => (t === 'settings' ? openSettings('data') : setTab(t))}
            onEdit={edit}
            onHelp={() => openSettings('help')}
            onTransfer={() => setForm('transfer')}
            onAdd={() => setForm('new')}
            remindToday={dailyDue(data)}
          />
        )}
        {tab === 'tx' && <Transactions period={spendPeriod} setPeriod={setSpendPeriod} onEdit={edit} onAdd={() => setForm('new')} />}
        {tab === 'card' && hasCard && (
          <CardStatement
            period={cardPeriod}
            setPeriod={setCardPeriod}
            onEdit={edit}
            onPay={(amount, cardId) => setPayCard({ amount, cardId, period: cardPeriod })}
            onAddInstallment={setInstCard}
          />
        )}
        {tab === 'budget' && <Budget period={spendPeriod} setPeriod={setSpendPeriod} />}
        {tab === 'split' && <Split />}
        {tab === 'goals' && <Goals />}
        {tab === 'calendar' && <Calendar />}
        {tab === 'report' && (
          <Suspense fallback={<p className="empty">{L.common.loading}</p>}>
            <Report />
          </Suspense>
        )}
        {tab === 'shared' && (
          <Suspense fallback={<p className="empty">{L.common.loading}</p>}>
            <Shared joinId={joinId} />
          </Suspense>
        )}
        {tab === 'settings' && (
          <Settings key={settingsSection ?? 'menu'} initial={settingsSection} theme={theme} toggleTheme={toggleTheme} onShared={sharedEnabled ? () => setTab('shared') : undefined} />
        )}
      </main>
      {tab === 'home' && tourRun > 0 && !form && <Tour key={tourRun} id="home" steps={homeTour(hasCard)} />}
      {tab === 'home' && !form && tourSeen('home') && <NewTip id="bot" target=".bot" />}
      {form && (
        <TxForm
          tx={form === 'new' || form === 'transfer' ? undefined : form}
          initialKind={form === 'transfer' ? 'transfer' : undefined}
          onClose={() => setForm(null)}
          onLoan={() => {
            setForm(null);
            setNewLoan(true);
          }}
          onImport={() => {
            setForm(null);
            setImporting(true);
          }}
        />
      )}
      {instCard && <TxForm initialInstallment={instCard} onClose={() => setInstCard(null)} />}
      {loan && <LoanForm tx={loan} onClose={() => setLoan(null)} />}
      {newLoan && <LoanForm onClose={() => setNewLoan(false)} />}
      {payCard && (
        <TxForm
          initialKind="transfer"
          fill={{ amount: payCard.amount, merchant: L.txForm.cardPayName, toAccountId: payCard.cardId, source: `cardpay:${payCard.period}` }}
          onClose={() => setPayCard(null)}
        />
      )}
      {importing && (
        <Suspense fallback={null}>
          <ImportSheet
            onClose={() => setImporting(false)}
            onOpenSettings={() => {
              setImporting(false);
              openSettings('ai');
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
