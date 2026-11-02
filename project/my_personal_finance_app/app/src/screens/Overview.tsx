/**
 * Màn chính — gọn: một thẻ lớn (còn tiêu được), dải thẻ nhỏ vuốt ngang, và các khoản gần đây.
 * Chi tiết nằm ở màn khác (Báo cáo, Ví, Thẻ, Chia tiền), chạm vào thẻ là mở.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  budgetReport,
  cashCheck,
  incomeIn,
  netWorth,
  nextDuePeriod,
  payables,
  periodInfo,
  monthOf,
  receivables,
  shiftPeriod,
  statement,
  todayISO,
  txInPeriod,
} from '../domain/calc';
import { goalStatus } from '../domain/goals';
import { nextEvent, oddTransactions, type Odd } from '../domain/insights';
import { RecapSheet } from '../components/Recap';
import { eventIcon, eventLabels } from './Calendar';
import { dm, money, periodLabel } from '../domain/format';
import { lastPeriods, trend } from '../domain/report';
import { personName } from '../domain/split';
import type { Transaction } from '../domain/types';
import { useLookups, useStore } from '../store';
import { WalletSheet } from '../components/Wallets';
import { Sheet } from '../components/ui';
import { CatBadge, Icon, type IconName } from '../components/icons';
import type { Tab } from '../App';
import { DriveBanner } from '../sync/DriveCard';
import { TxRow } from './Transactions';
import { L } from '../labels';
import { t as tr, Rich } from '../i18n';

const H = L.home;
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

/** Số chạy từ 0 lên khi mở màn hình (tắt nếu máy bật "giảm chuyển động"). */
function useCountUp(value: number, ms = 700) {
  const [shown, setShown] = useState(value);
  const from = useRef(0);
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return setShown(value);
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - k, 3);
      setShown(Math.round(a + (value - a) * eased));
      if (k < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return shown;
}

/** Vòng tròn % đã tiêu trên thẻ lớn. */
function Ring({ pct }: { pct: number }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, pct));
  return (
    <svg className="ring" viewBox="0 0 72 72" aria-hidden>
      <circle cx="36" cy="36" r={r} className="ring__track" />
      <circle cx="36" cy="36" r={r} className="ring__bar" strokeDasharray={`${p * c} ${c}`} transform="rotate(-90 36 36)" />
      <text x="36" y="40" textAnchor="middle">
        {Math.round(pct * 100)}%
      </text>
    </svg>
  );
}

/** Đường xu hướng nhỏ (6 tháng). */
function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  const w = 100;
  const h = 32;
  const pts = values.map((v, i) => `${(i / Math.max(1, values.length - 1)) * w},${h - (v / max) * (h - 4) - 2}`).join(' ');
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden>
      <polyline points={`0,${h} ${pts} ${w},${h}`} className="spark__fill" />
      <polyline points={pts} className="spark__line" />
    </svg>
  );
}

/** Thẻ nhỏ trong dải vuốt ngang. */
function Tile({
  icon,
  label,
  value,
  sub,
  tone,
  onClick,
  children,
}: {
  icon: IconName;
  label: string;
  value: string;
  sub?: ReactNode;
  tone?: 'neg' | 'pos';
  onClick: () => void;
  children?: ReactNode;
}) {
  return (
    <button className="tile" onClick={onClick}>
      <span className="tile__head">
        <span className="tile__icon">
          <Icon name={icon} size={18} />
        </span>
        {label}
      </span>
      <b className={`tile__value ${tone ?? ''}`}>{value}</b>
      {sub && <small className="tile__sub">{sub}</small>}
      {children}
    </button>
  );
}

/** Nhớ trên máy: các khoản lạ đã bấm "Bỏ qua", các tháng đã xem tổng kết. */
function useSeen(key: string) {
  const read = () => {
    try {
      return new Set<string>(JSON.parse(localStorage.getItem(key) ?? '[]'));
    } catch {
      return new Set<string>();
    }
  };
  const [seen, setSeen] = useState(read);
  const add = (id: string) => {
    const next = new Set(seen).add(id);
    setSeen(next);
    try {
      localStorage.setItem(key, JSON.stringify([...next].slice(-200)));
    } catch {
      /* bỏ qua */
    }
  };
  return [seen, add] as const;
}

/** Các ô ở màn chính người dùng bật / tắt được (nhớ trên máy). */
type Block = 'wealth' | 'card' | 'owed' | 'owe' | 'goals' | 'calendar' | 'recap' | 'trend' | 'recent';
const BLOCKS: Block[] = ['wealth', 'card', 'owed', 'owe', 'goals', 'calendar', 'recap', 'trend', 'recent'];
const HIDDEN_KEY = 'vi-cua-nang/home-hidden';

function useHiddenBlocks() {
  const [hidden, setHidden] = useState<Set<Block>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? '[]'));
    } catch {
      return new Set();
    }
  });
  const toggle = (b: Block) => {
    const next = new Set(hidden);
    if (next.has(b)) next.delete(b);
    else next.add(b);
    setHidden(next);
    try {
      localStorage.setItem(HIDDEN_KEY, JSON.stringify([...next]));
    } catch {
      /* bỏ qua */
    }
  };
  return [hidden, toggle] as const;
}

function CustomizeSheet({ hidden, toggle, onClose }: { hidden: Set<Block>; toggle: (b: Block) => void; onClose: () => void }) {
  return (
    <Sheet title={H.customizeTitle} onClose={onClose}>
      <div className="form">
        <p className="hint">{H.customizeHint}</p>
        {BLOCKS.map((b) => (
          <label key={b} className="switch-row">
            <span>{H.blocks[b]}</span>
            <input type="checkbox" checked={!hidden.has(b)} onChange={() => toggle(b)} />
          </label>
        ))}
      </div>
    </Sheet>
  );
}

const greeting = () => {
  const h = new Date().getHours();
  return h < 11 ? H.greetMorning : h < 14 ? H.greetNoon : h < 18 ? H.greetAfternoon : H.greetEvening;
};

export function Overview({
  go,
  onEdit,
  onHelp,
  onTransfer,
  onAdd,
  remindToday,
}: {
  go: (t: Tab) => void;
  onEdit: (t: Transaction) => void;
  onHelp: () => void;
  onTransfer: () => void;
  onAdd: () => void;
  remindToday: boolean;
}) {
  const { data } = useStore();
  const { category } = useLookups();
  const [wallet, setWallet] = useState(false);
  const [recapOpen, setRecapOpen] = useState(false);
  const [hidden, toggleBlock] = useHiddenBlocks();
  const show = (b: Block) => !hidden.has(b);
  const [customizing, setCustomizing] = useState(false);
  const [oddSeen, dismissOdd] = useSeen('vi-cua-nang/odd-seen');
  const [recapSeen, markRecap] = useSeen('vi-cua-nang/recap-seen');
  const today = todayISO();
  const s = data.settings;

  const period = monthOf(today);
  const report = budgetReport(data, period);
  const flex = [...report.rows, ...report.unbudgeted].filter((r) => category(r.categoryId)?.kind === 'spend');
  const limit = flex.reduce((a, r) => a + r.limit, 0);
  const spent = flex.reduce((a, r) => a + r.spent, 0);
  const left = limit - spent;
  const earned = incomeIn(data, period);
  const hero = useCountUp(limit > 0 ? Math.abs(left) : spent);

  const hasCard = data.accounts.some((a) => a.kind === 'credit');
  const duePeriod = nextDuePeriod(today, s);
  const due = periodInfo(duePeriod, s);
  const st = statement(data, duePeriod);
  const check = cashCheck(data, duePeriod);
  const daysLeft = daysBetween(today, due.due);

  const rec = receivables(data);
  const owe = payables(data);
  const goals = (data.goals ?? []).map((g) => ({ g, st: goalStatus(g, today) }));
  // Mục tiêu đang làm dở, gần xong nhất lên trước.
  const topGoal = goals.filter((x) => !x.st.done).sort((a, b) => b.st.pct - a.st.pct)[0] ?? goals[0];
  const nw = netWorth(data);
  const spark = trend(data, lastPeriods(today, s, 6)).map((x) => x.spent);
  // Tổng kết tháng trước: nhắc trên màn chính cho tới khi xem.
  const lastPeriod = shiftPeriod(period, -1);
  const hasLast = txInPeriod(data, lastPeriod).length > 0;
  const showRecapBanner = !recapSeen.has(lastPeriod) && hasLast;
  const openRecap = () => {
    markRecap(lastPeriod);
    setRecapOpen(true);
  };
  const odd = oddTransactions(data, period).filter((o) => !oddSeen.has(o.tx.id));
  const next = nextEvent(data, today, eventLabels);
  const oddText = (o: Odd) =>
    o.kind === 'duplicate'
      ? tr(L.odd.duplicate, { date: dm(o.other.date) })
      : o.kind === 'twice'
        ? L.odd.twice
        : o.kind === 'big'
          ? tr(L.odd.big, { n: o.times, category: category(o.tx.categoryId)?.name ?? '' })
          : L.odd[o.kind];
  // Chỉ 3 khoản mới nhất: xem nhanh vừa ghi đúng chưa; muốn xem hết thì vào Sổ chi.
  const recent = [...txInPeriod(data, period)].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);

  return (
    <div className="stack home">
      <DriveBanner onOpen={() => go('settings')} />
      {data.transactions.length < 5 && (
        <button className="tip" onClick={onHelp}>
          <Icon name="help" size={22} />
          <span>
            <Rich text={H.newTip} />
          </span>
          <Icon name="right" size={18} />
        </button>
      )}

      {remindToday && (
        <button className="tip tip--remind" onClick={onAdd}>
          <Icon name="notifications" size={22} />
          <span>{L.remind.bannerDaily}</span>
          <b>{L.remind.bannerAdd}</b>
        </button>
      )}

      {showRecapBanner && (
        <button className="tip tip--recap" onClick={openRecap}>
          <Icon name="celebration" size={22} />
          <span>{tr(L.recap.banner, { month: periodLabel(lastPeriod) })}</span>
          <Icon name="right" size={18} />
        </button>
      )}

      {/* Thẻ lớn: còn tiêu được (hoặc đã tiêu nếu chưa đặt ngân sách) */}
      <button className="hero2" onClick={() => go('budget')}>
        <span className="hero2__text">
          <small>{greeting()}</small>
          <span className="hero2__label">{limit > 0 ? (left >= 0 ? H.heroLeft : H.heroOver) : H.heroSpent}</span>
          <b className="hero2__amount">{money(hero)}</b>
          <span className="hero2__stats">
            <span>
              {H.spent} <b>{money(spent)}</b>
            </span>
            <span>
              {H.earned} <b>{money(earned)}</b>
            </span>
          </span>
          {limit === 0 && <span className="hero2__hint">{H.heroHint}</span>}
        </span>
        {limit > 0 && <Ring pct={spent / limit} />}
      </button>

      {/* Lưới ô nhỏ 2 cột (bật / tắt được từng ô) */}
      <div className="tiles">
        {show('wealth') && (
          <Tile
            icon="wallet"
            label={H.tileWealth}
            value={nw.rows.length ? money(nw.total) : H.tileWealthEmpty}
            sub={nw.rows.length ? tr(H.tileWealthSub, { n: nw.rows.length }) : H.tileWealthHint}
            tone={nw.total < 0 ? 'neg' : undefined}
            onClick={() => setWallet(true)}
          />
        )}
        {hasCard && show('card') && (
          <Tile
            icon="card"
            label={tr(H.cardDue, { date: dm(due.due) })}
            value={money(st.total)}
            sub={
              <>
                {daysLeft >= 0 ? tr(H.cardDaysLeft, { n: daysLeft }) : H.cardOverdue} ·{' '}
                <span className={check.surplus >= 0 ? 'pos' : 'neg'}>
                  {check.surplus >= 0 ? tr(H.cardSurplus, { amount: money(check.surplus) }) : tr(H.cardShort, { amount: money(-check.surplus) })}
                </span>
              </>
            }
            onClick={() => go('card')}
          />
        )}
        {rec.total > 0 && show('owed') && (
          <Tile
            icon="heart"
            label={rec.byPerson.length === 1 ? tr(H.partnerOwes, { name: personName(s, rec.byPerson[0].id) }) : H.manyOwe}
            value={money(rec.total)}
            sub={rec.byPerson.length === 1 ? tr(H.owedCount, { n: rec.open.length }) : tr(H.manyOweSub, { n: rec.byPerson.length, k: rec.open.length })}
            onClick={() => go('split')}
          />
        )}
        {owe.total > 0 && show('owe') && (
          <Tile
            icon="call_received"
            label={L.loan.tileOwe}
            value={money(owe.total)}
            sub={tr(L.loan.tileOweSub, { n: owe.byPerson.length })}
            tone="neg"
            onClick={() => go('split')}
          />
        )}
        {/* Chưa ai nợ ai: vẫn chừa lối vào để ghi cho vay / đi vay. */}
        {rec.total === 0 && owe.total === 0 && show('owed') && (
          <Tile icon="call_made" label={L.loan.tileEmpty} value={money(0)} sub={L.loan.tileEmptySub} onClick={() => go('split')} />
        )}
        {show('goals') && (
          <Tile
            icon="flag"
            label={L.goals.tile}
            value={topGoal ? money(topGoal.st.saved) : L.goals.tileEmpty}
            sub={topGoal ? tr(L.goals.tileSub, { pct: Math.round(topGoal.st.pct * 100), name: topGoal.g.name }) : L.goals.tileEmptySub}
            onClick={() => go('goals')}
          >
            {topGoal && (
              <span className="tile__bar">
                <span style={{ width: `${Math.round(topGoal.st.pct * 100)}%` }} />
              </span>
            )}
          </Tile>
        )}
        {show('calendar') && (
          <Tile
            icon={next ? eventIcon[next.kind] : 'calendar_month'}
            label={L.calendar.tile}
            value={next ? (next.amount ? money(next.amount) : next.title) : L.calendar.tileEmpty}
            sub={next ? tr(L.calendar.tileSub, { date: dm(next.date), name: next.title }) : L.calendar.tileEmptySub}
            onClick={() => go('calendar')}
          />
        )}
        {hasLast && show('recap') && <Tile icon="celebration" label={L.recap.button} value={periodLabel(lastPeriod)} sub={H.recapSub} onClick={openRecap} />}
        {show('trend') && (
          <Tile icon="target" label={H.tileTrend} value={money(spark[spark.length - 1] ?? 0)} sub={H.reportLink} onClick={() => go('report')}>
            <Sparkline values={spark} />
          </Tile>
        )}
      </div>
      <button className="link customize-link" onClick={() => setCustomizing(true)}>
        <Icon name="edit" size={16} /> {H.customize}
      </button>

      {odd.length > 0 && (
        <section className="card card--flush odd-card">
          <header className="card__head card__head--pad">
            <h2 className="card-title">
              <Icon name="warning" size={18} /> {L.odd.title}
            </h2>
          </header>
          <ul className="plain-list">
            {odd.slice(0, 5).map((o) => (
              <li key={o.tx.id} className="odd-row">
                <button className="row-btn row-btn--icon" onClick={() => onEdit(o.tx)}>
                  <CatBadge id={o.tx.categoryId} size={36} />
                  <span>
                    <b>
                      {o.tx.merchant} · {money(o.tx.amount)}
                    </b>
                    <small>{oddText(o)}</small>
                  </span>
                </button>
                <button className="link" onClick={() => dismissOdd(o.tx.id)}>
                  {L.odd.dismiss}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {recent.length > 0 && show('recent') && (
        <section className="card card--flush">
          <header className="card__head card__head--pad">
            <h2 className="card-title">{H.recentTitle}</h2>
            <button className="link" onClick={() => go('tx')}>
              {H.seeAll}
            </button>
          </header>
          <ul className="tx-list">
            {recent.map((t) => (
              <TxRow key={t.id} t={t} onClick={() => onEdit(t)} />
            ))}
          </ul>
        </section>
      )}

      {customizing && <CustomizeSheet hidden={hidden} toggle={toggleBlock} onClose={() => setCustomizing(false)} />}
      {recapOpen && <RecapSheet period={lastPeriod} onClose={() => setRecapOpen(false)} />}
      {wallet && (
        <WalletSheet
          onClose={() => setWallet(false)}
          onTransfer={() => {
            setWallet(false);
            onTransfer();
          }}
        />
      )}
    </div>
  );
}
