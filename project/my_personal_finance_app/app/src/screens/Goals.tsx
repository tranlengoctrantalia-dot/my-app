/** Mục tiêu tiết kiệm: đặt số tiền + hạn, bỏ thêm dần, xem còn thiếu và mỗi tháng cần bỏ bao nhiêu. */
import { useState } from 'react';
import { isTouch } from '../viewport';
import { todayISO } from '../domain/calc';
import { dm, money, uid } from '../domain/format';
import { goalStatus } from '../domain/goals';
import type { Goal } from '../domain/types';
import { useStore } from '../store';
import { Card, Empty, MoneyInput, Progress, Sheet, Info } from '../components/ui';
import { Icon } from '../components/icons';
import { NewTip } from '../components/WhatsNew';
import { L } from '../labels';
import { t } from '../i18n';

const G = L.goals;
export const goalIcons = ['flag', 'flight_takeoff', 'beach_access', 'phone', 'laptop_mac', 'directions_car', 'home_repair_service', 'school', 'diamond', 'emergency', 'gift', 'heart'];

export function Goals() {
  const { data } = useStore();
  const [edit, setEdit] = useState<Goal | 'new' | null>(null);
  const [move, setMove] = useState<{ goal: Goal; sign: 1 | -1 } | null>(null);
  const goals = data.goals ?? [];
  const today = todayISO();

  return (
    <div className="stack">
      {goals.length === 0 && (
        <Card>
          <Empty art="bullseye">{G.empty}</Empty>
        </Card>
      )}
      {goals.map((g) => {
        const st = goalStatus(g, today);
        return (
          <section key={g.id} className={`card goal${st.done ? ' goal--done' : ''}`}>
            <button className="goal__head" onClick={() => setEdit(g)}>
              <span className="goal__icon">
                <Icon name={g.icon ?? 'flag'} size={22} />
              </span>
              <span className="goal__name">
                <b>{g.name}</b>
                <small>
                  {st.done
                    ? G.done
                    : st.late
                      ? t(G.late, { date: dm(g.deadline!), amount: money(st.left) })
                      : st.monthly
                        ? t(G.monthly, { amount: money(st.monthly), date: dm(g.deadline!) })
                        : t(G.noDeadline, { amount: money(st.left) })}
                </small>
              </span>
              <span className="goal__pct">{Math.round(st.pct * 100)}%</span>
            </button>
            <Progress value={st.saved} max={g.target} />
            <div className="goal__foot">
              <span>
                <b>{money(st.saved)}</b> <span className="muted">/ {money(g.target)}</span>
              </span>
              <span className="goal__actions">
                {st.saved > 0 && (
                  <button className="chip" onClick={() => setMove({ goal: g, sign: -1 })}>
                    {G.withdraw}
                  </button>
                )}
                <button className="chip chip--accent" onClick={() => setMove({ goal: g, sign: 1 })}>
                  <Icon name="plus" size={16} /> {G.deposit}
                </button>
              </span>
            </div>
          </section>
        );
      })}
      <button className="btn btn--block add-btn" onClick={() => setEdit('new')}>
        <Icon name="plus" size={20} /> {G.add}
      </button>
      {edit && <GoalForm goal={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}
      {move && <DepositForm goal={move.goal} sign={move.sign} onClose={() => setMove(null)} />}
    </div>
  );
}

function GoalForm({ goal, onClose }: { goal?: Goal; onClose: () => void }) {
  const { dispatch } = useStore();
  const [name, setName] = useState(goal?.name ?? '');
  const [target, setTarget] = useState(goal?.target ?? 0);
  const [deadline, setDeadline] = useState(goal?.deadline ?? '');
  const [icon, setIcon] = useState(goal?.icon ?? 'flag');
  const [start, setStart] = useState(0);
  const [deps, setDeps] = useState(goal?.deposits ?? []);
  const valid = name.trim() && target > 0;
  return (
    <Sheet title={goal ? G.formEdit : G.formNew} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          // Ô "Đã có sẵn" lúc tạo mới là tiền có từ trước: không tính vào tháng này.
          const deposits = goal ? deps : start > 0 ? [{ date: todayISO(), amount: start, opening: true }] : [];
          dispatch({ type: 'upsertGoal', goal: { id: goal?.id ?? uid(), name: name.trim(), target, deadline: deadline || undefined, icon, deposits } });
          onClose();
        }}
      >
        <label className="field">
          <span>{G.name}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={G.namePlaceholder} autoFocus={!goal && !isTouch} />
        </label>
        <label className="field field--big">
          <span>{G.target}</span>
          <MoneyInput value={target} onChange={setTarget} />
        </label>
        {!goal && (
          <label className="field">
            <span>{G.startSaved}</span>
            <MoneyInput value={start} onChange={setStart} />
          </label>
        )}
        {goal && deps.length > 0 && (
          <div className="field">
            <span>{G.history}</span>
            <ul className="plain-list deposit-list">
              {deps.map((d, i) => (
                <li key={i} className="deposit-row">
                  <span>
                    <b className={d.amount < 0 ? 'neg' : ''}>{money(d.amount)}</b>
                    <small>{dm(d.date)}</small>
                  </span>
                  {d.amount > 0 && (
                    <label className="deposit-row__opening">
                      <small>{G.openingShort}</small>
                      <input
                        type="checkbox"
                        checked={!!d.opening}
                        onChange={(e) => setDeps((xs) => xs.map((x, j) => (j === i ? { ...x, opening: e.target.checked || undefined } : x)))}
                      />
                    </label>
                  )}
                  <button type="button" className="link" onClick={() => setDeps((xs) => xs.filter((_, j) => j !== i))}>
                    {G.historyDelete}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <label className="field">
          <span>{G.deadline}</span>
          <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </label>
        <div className="field">
          <span>{G.icon}</span>
          <div className="icon-grid">
            {goalIcons.map((i) => (
              <button type="button" key={i} className="icon-pick" aria-pressed={icon === i} onClick={() => setIcon(i)}>
                <Icon name={i} size={22} />
              </button>
            ))}
          </div>
        </div>
        <button className="btn btn--primary btn--block" type="submit" disabled={!valid}>
          {G.save}
        </button>
        {goal && (
          <button
            type="button"
            className="btn btn--danger-ghost btn--block"
            onClick={() => {
              if (confirm(t(G.confirmDelete, { name: goal.name }))) {
                dispatch({ type: 'deleteGoal', id: goal.id });
                onClose();
              }
            }}
          >
            {G.delete}
          </button>
        )}
      </form>
    </Sheet>
  );
}

function DepositForm({ goal, sign, onClose }: { goal: Goal; sign: 1 | -1; onClose: () => void }) {
  const { dispatch } = useStore();
  const st = goalStatus(goal, todayISO());
  const [amount, setAmount] = useState(0);
  const [opening, setOpening] = useState(false);
  const quick = sign > 0 ? [st.monthly, st.left].filter((x, i, a) => x > 0 && a.indexOf(x) === i) : [st.saved];
  const max = sign < 0 ? st.saved : Infinity;
  return (
    <Sheet title={t(sign > 0 ? G.depositTitle : G.withdrawTitle, { name: goal.name })} info={G.depositHint} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (amount <= 0) return;
          const n = Math.min(amount, max) * sign;
          const opened = sign > 0 && opening ? { opening: true } : {};
          dispatch({ type: 'upsertGoal', goal: { ...goal, deposits: [...goal.deposits, { date: todayISO(), amount: n, ...opened }] } });
          onClose();
        }}
      >
        <label className="field field--big">
          <span>{G.amount}</span>
          <MoneyInput value={amount} onChange={setAmount} autoFocus={!isTouch} />
        </label>
        {quick.length > 0 && (
          <div className="chips">
            {quick.map((q) => (
              <button type="button" key={q} className="chip" onClick={() => setAmount(q)}>
                {money(q)}
              </button>
            ))}
          </div>
        )}
        {sign > 0 && (
          <label className="switch-row" data-tour="opening">
            <span>
              {G.opening}
              <Info>{G.openingHint}</Info>
            </span>
            <input type="checkbox" checked={opening} onChange={(e) => setOpening(e.target.checked)} />
          </label>
        )}
        {sign > 0 && <NewTip id="opening" target=".sheet [data-tour='opening']" />}
        <button className="btn btn--primary btn--block" type="submit" disabled={amount <= 0}>
          {sign > 0 ? G.deposit : G.withdraw}
        </button>
      </form>
    </Sheet>
  );
}
