import { useState } from 'react';
import { budgetReport, incomeIn, installmentProgress, monthOf, monthRange, shiftPeriod, todayISO, type BudgetRow } from '../domain/calc';
import { BUFFER_GOAL, budgetRoom, bufferGoal, bufferHave, bufferSuggest, fitBudget, nextMonths } from '../domain/coach';
import { money, periodLabel, uid } from '../domain/format';
import type { Budget as BudgetT, CategoryKind, Installment, PeriodKey } from '../domain/types';
import { useLookups, useStore } from '../store';
import { Empty, MoneyInput, PeriodPicker, Sheet, Info } from '../components/ui';
import { InstallmentForm } from './CardStatement';
import { CatBadge, Icon, catColor } from '../components/icons';
import { planBudget } from '../domain/insights';
import { L } from '../labels';
import { NewTip } from '../components/WhatsNew';
import { t, Rich } from '../i18n';

const groups: { kind: CategoryKind; title: string }[] = [
  { kind: 'fixed', title: L.budget.groupFixed },
  { kind: 'spend', title: L.budget.groupSpend },
];

const viewGroups: { kinds: CategoryKind[]; title: string }[] = [
  { kinds: ['spend'], title: L.budget.viewSpend },
  { kinds: ['fixed'], title: L.budget.viewFixed },
  { kinds: ['installment'], title: L.budget.groupInstallment },
];

export function Budget({ period, setPeriod }: { period: PeriodKey; setPeriod: (p: PeriodKey) => void }) {
  const { data, dispatch } = useStore();
  const { category } = useLookups();
  const [editing, setEditing] = useState(false);
  const [line, setLine] = useState<BudgetRow | null>(null);
  const [inst, setInst] = useState<Installment | null>(null);
  const r = budgetReport(data, period);
  const prev = data.budgets.find((b) => b.period === shiftPeriod(period, -1));

  const rowsOf = (kinds: CategoryKind[]) =>
    [...r.rows, ...r.unbudgeted].filter((row) => kinds.includes(category(row.categoryId)?.kind ?? 'spend'));
  // Trả góp chưa tới kỳ góp đầu (vd. quẹt sau ngày chốt → góp từ tháng sau): vẫn hiện để biết là đã ghi.
  const upcoming = data.installments.filter((i) => i.firstPeriod > period);

  // Ngân sách lố: giảm đều các mục ăn tiêu cho vừa, xem trước rồi mới lưu.
  const fit = r.unallocated < 0 ? fitBudget(data, period) : undefined;
  function applyFit() {
    if (!fit) return;
    const lines = fit.changes.map((c) => `${category(c.categoryId)?.name ?? ''}: ${money(c.from)} → ${money(c.to)}`).join('\n');
    if (confirm(t(L.budget.fitConfirm, { lines }))) dispatch({ type: 'upsertBudget', budget: fit.budget });
  }

  return (
    <div className="stack">
      <PeriodPicker value={period} onChange={setPeriod} />

      {!r.budget ? (
        <div className="empty-cta">
          <Empty art="target">{L.budget.empty}</Empty>
          {prev && (
            <button className="btn btn--primary btn--block" onClick={() => dispatch({ type: 'upsertBudget', budget: { ...prev, period } })}>
              {L.budget.reusePrev}
            </button>
          )}
          <button className={`btn btn--block ${prev ? '' : 'btn--primary'}`} onClick={() => setEditing(true)}>
            {L.budget.createNew}
          </button>
        </div>
      ) : (
        <>
          <div className="income-bar">
            <span>
              <Rich text={L.budget.incomeBar} vars={{ amount: r.income ? money(r.income) : '—' }} />
              {r.income > 0 && (
                <small className={r.unallocated < 0 ? 'neg' : r.unallocated === 0 ? 'pos' : 'muted'}>
                  {r.unallocated === 0 ? L.budget.exact : t(r.unallocated > 0 ? L.budget.unallocated : L.budget.overAllocated, { amount: money(Math.abs(r.unallocated)) })}
                </small>
              )}
              {fit && (
                <button className="link" data-tour="fit" onClick={applyFit}>
                  {L.budget.fitBtn}
                </button>
              )}
              {fit && <NewTip id="fit" target="[data-tour='fit']" />}
            </span>
            <button className="btn btn--sm" onClick={() => setEditing(true)}>
              {L.budget.editBudget}
            </button>
          </div>
          {viewGroups.map((g) => {
            const rows = rowsOf(g.kinds);
            const later = g.kinds.includes('installment') ? upcoming : [];
            if (rows.length === 0 && later.length === 0) return null;
            return (
              <section key={g.title} className="card">
                <h2 className="section-title">{g.title}</h2>
                <ul className="budget-list">
                  {rows.map((row) => {
                    const item = data.installments.find((i) => i.categoryId === row.categoryId);
                    return item ? (
                      <InstallmentItem key={row.categoryId} item={item} period={period} onClick={() => setInst(item)} />
                    ) : (
                      <BudgetItem key={row.categoryId} row={row} onClick={() => setLine(row)} />
                    );
                  })}
                  {later.map((item) => (
                    <InstallmentItem key={item.id} item={item} period={period} onClick={() => setInst(item)} />
                  ))}
                </ul>
              </section>
            );
          })}
          <BudgetBalance period={period} />
        </>
      )}
      {editing && <BudgetForm period={period} budget={r.budget ?? prev} onClose={() => setEditing(false)} />}
      {line && r.budget && <BudgetLineSheet row={line} budget={r.budget} onClose={() => setLine(null)} />}
      {inst && <InstallmentForm item={inst} onClose={() => setInst(null)} />}
    </div>
  );
}

/**
 * Ngân sách là gốc của mọi số "được tiêu bao nhiêu": lương − cố định − trả góp = được chi linh hoạt.
 * Kết luận nằm trên đầu tab; ở đây là cách tính, 3 tháng tới, tiền đệm (một Mục tiêu → tự vào dòng tiết kiệm), bấm mới mở.
 */
function BudgetBalance({ period }: { period: PeriodKey }) {
  const { data, dispatch } = useStore();
  const C = L.coach;
  const r = budgetRoom(data, period);
  if (!r.income) return null;
  const next = nextMonths(data, period);
  const today = todayISO();
  const goal = bufferGoal(data);
  const sug = bufferSuggest(data, period, today);
  const row = (label: string, amount: number, minus = false) => (
    <div key={label}>
      <dt>{label}</dt>
      <dd>
        {minus && amount > 0 ? '− ' : ''}
        {money(amount)}
      </dd>
    </div>
  );
  return (
    <section className="card card--folds">
      <details className="fold">
        <summary>{C.balanceTitle}</summary>
        <dl className="ledger ledger--sheet">
          {row(C.income, r.income)}
          {row(C.fixed, r.fixed, true)}
          {r.installments > 0 && row(C.installments, r.installments, true)}
          <div className="ledger__total">
            <dt>{C.room}</dt>
            <dd>{money(r.room)}</dd>
          </div>
          {row(C.planned, r.flexPlanned)}
        </dl>
      </details>

      <details className="fold">
        <summary>{C.nextTitle}</summary>
        <dl className="ledger ledger--sheet">
          {next.map((m) => (
            <div key={m.month}>
              <dt>{t(C.nextRow, { m: Number(m.month.slice(5, 7)) })}</dt>
              <dd>{money(m.room)}</dd>
            </div>
          ))}
        </dl>
      </details>

      <details className="fold">
        <summary>{C.bufferTitle}</summary>
        {goal ? (
          <p className="hint">{t(C.bufferHave, { have: money(bufferHave(data, today)), target: money(goal.target) })}</p>
        ) : (
          sug.target > 0 && (
            <>
              <p className="hint">{t(C.bufferSuggest, { target: money(sug.target), monthly: money(sug.monthly) })}</p>
              <button
                className="btn btn--block"
                onClick={() => dispatch({ type: 'upsertGoal', goal: { id: BUFFER_GOAL, name: C.bufferName, icon: '🛟', target: sug.target, deadline: sug.deadline, deposits: [] } })}
              >
                {C.bufferCreate}
              </button>
            </>
          )
        )}
      </details>
    </section>
  );
}

/** Dòng trả góp: tới kỳ mấy, còn bao nhiêu; thiếu kỳ hạn thì chạm vào nhập. */
function InstallmentItem({ item, period, onClick }: { item: Installment; period: PeriodKey; onClick: () => void }) {
  const prog = installmentProgress(item, period);
  return (
    <li>
      <button className="budget-item" onClick={onClick}>
        <CatBadge id={item.categoryId} size={36} />
        <div className="budget-item__body">
          <div className="split-line">
            <span>{item.name}</span>
            <span className={prog || period < item.firstPeriod ? 'muted' : 'neg'}>
              {period < item.firstPeriod
                ? t(L.budget.instStarts, { period: periodLabel(item.firstPeriod), amount: money(item.monthly) })
                : prog
                  ? prog.left > 0
                    ? t(L.card.progress, { paid: prog.paid, months: item.months!, amount: money(prog.amountLeft) })
                    : L.budget.instDone
                  : L.budget.instNoTerm}
            </span>
          </div>
          <div className="bars__track">
            <div style={{ width: `${prog ? (prog.paid / item.months!) * 100 : 0}%`, background: 'var(--accent)' }} />
          </div>
        </div>
      </button>
    </li>
  );
}

function BudgetItem({ row, onClick }: { row: BudgetRow; onClick: () => void }) {
  const { category } = useLookups();
  const c = category(row.categoryId);
  return (
    <li>
     <button className="budget-item" onClick={onClick}>
      <CatBadge id={row.categoryId} size={36} />
      <div className="budget-item__body">
        <div className="split-line">
          <span>{c?.name ?? row.categoryId}</span>
          <span className={row.remaining < 0 ? 'neg' : 'muted'}>
            {row.limit === 0 ? money(row.spent) : row.remaining < 0 ? t(L.budget.over, { amount: money(-row.remaining) }) : t(L.budget.left, { amount: money(row.remaining) })}
          </span>
        </div>
        <div className="bars__track">
          <div
            style={{
              width: `${row.limit > 0 ? Math.min(100, (row.spent / row.limit) * 100) : 100}%`,
              background: row.remaining < 0 ? 'var(--neg)' : catColor(row.categoryId, c),
            }}
          />
        </div>
      </div>
     </button>
    </li>
  );
}

/** Sửa nhanh ngân sách một mục; khoản cố định có nút ghi "đã chi" để trừ vào tiền đang có. */
function BudgetLineSheet({ row, budget, onClose }: { row: BudgetRow; budget: BudgetT; onClose: () => void }) {
  const { data, dispatch } = useStore();
  const { category } = useLookups();
  const c = category(row.categoryId);
  const [limit, setLimit] = useState(row.limit);
  const isFixed = c?.kind === 'fixed';

  function saveLimit(value: number) {
    const others = budget.lines.filter((l) => l.categoryId !== row.categoryId);
    dispatch({
      type: 'upsertBudget',
      budget: { ...budget, lines: value > 0 ? [...others, { categoryId: row.categoryId, limit: value }] : others },
    });
  }

  return (
    <Sheet title={c?.name ?? L.budget.title} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          saveLimit(limit);
          onClose();
        }}
      >
        <div className="line-head">
          <CatBadge id={row.categoryId} size={48} />
          <span>
            <Rich text={L.budget.spent} vars={{ amount: money(row.spent) }} />
            {row.limit > 0 && (
              <small className={row.remaining < 0 ? 'neg' : 'muted'}>
                {row.remaining < 0 ? t(L.budget.over, { amount: money(-row.remaining) }) : t(L.budget.left, { amount: money(row.remaining) })}
              </small>
            )}
          </span>
        </div>
        <label className="field field--big">
          <span>{L.budget.limitThisMonth}</span>
          <MoneyInput value={limit} onChange={setLimit} placeholder="0" />
        </label>
        <button className="btn btn--primary btn--block" type="submit">
          {L.budget.save}
        </button>
        {isFixed && row.remaining > 0 && (
          <button
            type="button"
            className="btn btn--block"
            onClick={() => {
              const account = data.accounts.find((a) => a.kind === 'bank') ?? data.accounts.find((a) => a.kind !== 'credit') ?? data.accounts[0];
              dispatch({
                type: 'upsertTx',
                tx: {
                  id: uid(),
                  // Ghi vào đúng tháng đang xem (xem tháng cũ thì ghi ngày cuối tháng đó).
                  date: monthOf(todayISO()) === budget.period ? todayISO() : monthRange(budget.period).end,
                  merchant: c?.name ?? L.budget.fixedTxName,
                  amount: row.remaining,
                  myShare: row.remaining,
                  categoryId: row.categoryId,
                  accountId: account.id,
                  reimbursed: 0,
                },
              });
              onClose();
            }}
          >
            {t(L.budget.markPaid, { amount: money(row.remaining) })}
          </button>
        )}
        {row.limit > 0 && (
          <button
            type="button"
            className="btn btn--danger-ghost btn--block"
            onClick={() => {
              saveLimit(0);
              onClose();
            }}
          >
            {L.budget.removeLine}
          </button>
        )}
      </form>
    </Sheet>
  );
}

function BudgetForm({ period, budget, onClose }: { period: PeriodKey; budget?: BudgetT; onClose: () => void }) {
  const { data, dispatch } = useStore();
  // Chưa lập thì gợi ý sẵn số tiền đã thu trong tháng.
  const [income, setIncome] = useState(budget?.income ?? incomeIn(data, period));
  const [limits, setLimits] = useState<Record<string, number>>(() =>
    Object.fromEntries(data.categories.map((c) => [c.id, budget?.lines.find((l) => l.categoryId === c.id)?.limit ?? 0])),
  );
  // Đã chia gồm cả trả góp thật của tháng (ô trả góp nếu có nhập thì không cộng, tránh trừ 2 lần).
  const total = budgetRoom(data, period).installments + data.categories.filter((c) => c.kind !== 'installment').reduce((a, c) => a + (limits[c.id] ?? 0), 0);
  const [savePct, setSavePct] = useState(20);
  const plan = planBudget(data, period, income, savePct, limits);
  const [applied, setApplied] = useState(false);

  return (
    <Sheet title={L.budget.title} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          dispatch({
            type: 'upsertBudget',
            budget: {
              period,
              income,
              lines: data.categories.filter((c) => limits[c.id] > 0).map((c) => ({ categoryId: c.id, limit: limits[c.id] })),
            },
          });
          onClose();
        }}
      >
        <label className="field field--big">
          <span>{L.budget.incomeThisMonth}</span>
          <MoneyInput value={income} onChange={setIncome} />
        </label>
        <section className="plan">
          <b className="plan__title">
            <Icon name="star" size={18} /> {L.suggest.title}
          </b>
          {income <= 0 ? (
            <p className="hint">{L.suggest.needIncome}</p>
          ) : (
            <>
              <div className="chips">
                <span className="muted">{L.suggest.savePct}</span>
                {[10, 20, 30].map((p) => (
                  <button type="button" key={p} className="chip" aria-pressed={savePct === p} onClick={() => setSavePct(p)}>
                    {p}%
                  </button>
                ))}
              </div>
              <dl className="plan__rows">
                <div>
                  <dt>{L.suggest.income}</dt>
                  <dd>{money(plan.income)}</dd>
                </div>
                {plan.fixed > 0 && (
                  <div>
                    <dt>− {L.suggest.fixed}</dt>
                    <dd>{money(plan.fixed)}</dd>
                  </div>
                )}
                {plan.installments > 0 && (
                  <div>
                    <dt>− {L.suggest.installments}</dt>
                    <dd>{money(plan.installments)}</dd>
                  </div>
                )}
                <div>
                  <dt>− {plan.goalsMonthly > 0 ? t(L.suggest.savingGoals, { amount: money(plan.goalsMonthly) }) : L.suggest.saving}</dt>
                  <dd>{money(plan.saving)}</dd>
                </div>
                <div className="plan__total">
                  <dt>
                    = {L.suggest.flexible}
                    <Info>{plan.flexible <= 0 ? L.suggest.short : plan.byHabit ? L.suggest.byHabit : L.suggest.even}</Info>
                  </dt>
                  <dd>{money(plan.flexible)}</dd>
                </div>
              </dl>
              <button
                type="button"
                className="btn btn--block"
                disabled={plan.flexible <= 0}
                onClick={() => {
                  setLimits((l) => ({ ...l, ...plan.limits }));
                  setApplied(true);
                }}
              >
                {L.suggest.apply}
              </button>
              {applied && <p className="hint pos">{L.suggest.applied}</p>}
            </>
          )}
        </section>
        {groups
          .filter((g) => data.categories.some((c) => c.kind === g.kind))
          .map((g) => (
          <fieldset key={g.kind} className="field">
            <legend>{g.title}</legend>
            {data.categories
              .filter((c) => c.kind === g.kind)
              .map((c) => (
                <label key={c.id} className="limit-row">
                  <CatBadge id={c.id} size={32} />
                  <span className="limit-row__name">{c.name}</span>
                  <MoneyInput value={limits[c.id]} onChange={(n) => setLimits((l) => ({ ...l, [c.id]: n }))} placeholder="0" />
                </label>
              ))}
          </fieldset>
        ))}
        <p className={`hint ${income && total > income ? 'neg' : ''}`}>
          {t(L.budget.allocated, { amount: money(total) })}
          {income > 0 && ` · ${t(total <= income ? L.budget.allocatedLeft : L.budget.allocatedOver, { amount: money(Math.abs(income - total)) })}`}
        </p>
        <button className="btn btn--primary btn--block" type="submit">
          {L.budget.save}
        </button>
      </form>
    </Sheet>
  );
}
