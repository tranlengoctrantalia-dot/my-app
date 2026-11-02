import { useState, type ReactNode } from 'react';
import { isTouch } from '../viewport';
import { todayISO } from '../domain/calc';
import { dayLabel, money, uid } from '../domain/format';
import type { Transaction, TxSplit } from '../domain/types';
import { BUILTIN, CUSTOM, customRatios, findPreset, inferSplit, peopleOf, personName, presetLabel, splitByRatio, splitsOf } from '../domain/split';
import { useStore } from '../store';
import { MoneyInput, Sheet } from './ui';
import { Icon, catColor, catIcon } from './icons';
import { AccountForm, CategoryForm } from './Manage';
import { SplitPresetForm } from '../screens/Settings';
import { Tour, type TourStep } from './Tour';
import { L } from '../labels';
import { fold } from '../ai/redact';
import { CARD_PAY } from '../domain/insights';
import { Rich, t } from '../i18n';

const T = L.txForm;
const formTour: TourStep[] = [
  { target: '.sheet .segmented', ...T.tour.kind },
  { target: '.sheet .amount-xl', ...T.tour.amount },
  { target: '.sheet .cat-grid', ...T.tour.category },
  { target: '.sheet .tx-pair', ...T.tour.dateAccount },
  { target: '.sheet .split-row', ...T.tour.split },
  { target: '.sheet .ai-btn', ...T.tour.ai },
  { target: '.sheet button[type="submit"]', ...T.tour.save },
];

export type Kind = 'expense' | 'income' | 'refund' | 'transfer';

/** Nhãn nhỏ phía trên từng phần của form, kèm nút phụ bên phải (nếu có). */
function Section({ label, action, children }: { label: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="tx-section">
      <div className="tx-section__head">
        <span>{label}</span>
        {action}
      </div>
      {children}
    </div>
  );
}


export function TxForm({
  tx,
  draft,
  onClose,
  onImport,
  onSave,
  onLoan,
  initialKind,
  fill,
}: {
  /** Điền sẵn khi mở từ nút "Ghi đã trả thẻ". */
  fill?: { amount: number; merchant: string; toAccountId?: string };
  /** Mở bảng cho vay / đi vay thay cho bảng này. */
  onLoan?: () => void;
  tx?: Transaction;
  /** Mở sẵn ở loại này (vd. "Chuyển tiền" từ thẻ Ví của bạn). */
  initialKind?: Kind;
  /** Đang sửa khoản AI vừa đọc (chưa lưu vào sổ): không có nút Xóa, lưu thì trả về qua onSave. */
  draft?: boolean;
  onClose: () => void;
  onImport?: () => void;
  onSave?: (tx: Transaction) => void;
}) {
  const { data, dispatch } = useStore();
  const people = peopleOf(data.settings);
  const today = todayISO();
  const [kind, setKind] = useState<Kind>(
    tx?.kind === 'income' ? 'income' : tx?.kind === 'transfer' ? 'transfer' : tx && tx.amount < 0 ? 'refund' : (initialKind ?? 'expense'),
  );
  const income = kind === 'income';
  const refund = kind === 'refund';
  const transfer = kind === 'transfer';
  const cats = data.categories.filter((c) => (income ? c.kind === 'income' : c.kind === 'spend' || c.kind === 'fixed'));
  const [adding, setAdding] = useState<'category' | 'account' | 'split' | null>(null);

  const [amount, setAmount] = useState(tx ? Math.abs(tx.amount) : (fill?.amount ?? 0));
  const [categoryId, setCategoryId] = useState(tx?.categoryId ?? '');
  // Bỏ trống ghi chú thì app lưu tên danh mục làm tên khoản — mở lại sửa thì không hiện sẵn chữ đó.
  const [merchant, setMerchant] = useState(
    tx && tx.merchant !== data.categories.find((c) => c.id === tx.categoryId)?.name ? tx.merchant : (fill?.merchant ?? ''),
  );
  const [date, setDate] = useState(tx?.date ?? today);
  const [accountId, setAccountId] = useState(
    tx?.accountId ?? (initialKind === 'transfer' ? data.accounts.find((a) => a.kind === 'bank') : undefined)?.id ?? data.accounts[0]?.id ?? '',
  );
  const [toAccountId, setToAccountId] = useState(
    tx?.toAccountId ?? fill?.toAccountId ?? (data.accounts.find((a) => a.kind === 'credit') ?? data.accounts.find((a) => a.id !== accountId))?.id ?? '',
  );
  // Lặp lại hàng tháng: chỉ khi thêm khoản chi / thu mới.
  const [repeat, setRepeat] = useState(false);
  const canRepeat = !tx && !draft && (kind === 'expense' || income);
  // Đóng trước cho mấy tháng (chỉ khoản chi): ngân sách chia đều.
  const [spread, setSpread] = useState(tx?.spreadMonths ?? 1);
  // Cách chia + chia với những ai (nhiều người được).
  const initSplit = tx ? inferSplit(tx, data.settings) : undefined;
  const [mode, setModeState] = useState<string>(initSplit?.mode ?? 'me');
  const [modeTouched, setModeTouched] = useState(false);
  // Mặc định: nhóm người của lần chia gần nhất.
  const lastShared = [...data.transactions].filter((x) => splitsOf(x).length).sort((a, b) => b.date.localeCompare(a.date))[0];
  const [chosen, setChosenState] = useState<string[]>(
    initSplit?.people.length ? initSplit.people : lastShared ? splitsOf(lastShared).map((x) => x.person) : people[0] ? [people[0].id] : [],
  );
  const [whoTouched, setWhoTouched] = useState(false);
  const toggleWho = (id: string) => {
    setChosenState((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id]));
    setWhoTouched(true);
  };
  const [customAmounts, setCustomAmounts] = useState<Record<string, number>>(initSplit?.amounts ?? {});
  const [newPerson, setNewPerson] = useState<string | null>(null);
  const setMode = (m: string) => {
    // Chuyển sang "Tự nhập": điền sẵn số đang chia để chỉ cần sửa người nào khác.
    if (m === CUSTOM && mode !== CUSTOM) setCustomAmounts(Object.fromEntries(splits.map((x) => [x.person, x.amount])));
    setModeState(m);
    setModeTouched(true);
    // Cách chia có gắn sẵn người (vd. "Công ty trả") → chọn luôn người đó nếu chưa tự chọn.
    const p = findPreset(data.settings, m);
    if (!whoTouched && p?.counterparty && people.some((x) => x.id === p.counterparty)) setChosenState([p.counterparty]);
  };
  /** Cách chia của khoản gần nhất cùng danh mục (cách đó đã bị xoá thì về "Mình trả"). */
  const lastSplit = (categoryId: string) => {
    const last = [...data.transactions]
      .filter((t) => t.categoryId === categoryId && t.amount > 0 && !t.kind)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    if (!last) return 'me';
    const inf = inferSplit(last, data.settings);
    if (inf.people.length && !whoTouched) setChosenState(inf.people);
    return inf.mode === CUSTOM ? 'me' : inf.mode;
  };

  const plain = refund || income || transfer;
  const preset = findPreset(data.settings, mode);
  // Có phần của người khác (chia đều, tỉ lệ, trả hộ, tự nhập…) thì phải chọn chia với ai.
  const needsPerson = !plain && mode !== 'me' && (mode === CUSTOM || (preset?.other ?? 0) > 0);
  const prevPaid = (person: string) => (tx ? (splitsOf(tx).find((x) => x.person === person)?.paid ?? 0) : 0);
  const result: { myShare: number; splits: TxSplit[] } = !needsPerson
    ? { myShare: amount, splits: [] }
    : mode === CUSTOM
      ? (() => {
          const splits = chosen.map((person) => ({ person, amount: customAmounts[person] ?? 0, paid: 0 }));
          return { myShare: amount - splits.reduce((a, x) => a + x.amount, 0), splits };
        })()
      : splitByRatio(amount, preset!.mine, preset!.other, chosen);
  // Giữ lại số tiền người đó đã trả (khi sửa khoản cũ).
  const splits = result.splits.filter((x) => x.amount > 0).map((x) => ({ ...x, paid: Math.min(prevPaid(x.person), x.amount) }));
  const myShare = result.myShare;
  const nameOf = (id: string) => personName(data.settings, id);
  const oneName = chosen.length === 1 ? nameOf(chosen[0]) : undefined;
  const valid = transfer
    ? amount > 0 && !!toAccountId && toAccountId !== accountId
    : amount > 0 && cats.some((c) => c.id === categoryId) && (!needsPerson || (chosen.length > 0 && myShare >= 0));

  function addPerson(name: string) {
    const n = name.trim();
    if (!n) return;
    const existing = people.find((x) => x.name.toLowerCase() === n.toLowerCase());
    const id = existing?.id ?? `p-${uid()}`;
    if (!existing) dispatch({ type: 'settings', patch: { people: [...people, { id, name: n }] } });
    if (!chosen.includes(id)) toggleWho(id);
    setNewPerson(null);
  }

  function switchKind(k: Kind) {
    setKind(k);
    const cat = data.categories.find((c) => c.id === categoryId);
    if (k === 'income') {
      // Chọn sẵn "Lương" cho nhanh; tiền thu thường vào tài khoản/ví, không vào thẻ tín dụng.
      if (cat?.kind !== 'income') setCategoryId(data.categories.find((c) => c.kind === 'income')?.id ?? '');
      if (data.accounts.find((a) => a.id === accountId)?.kind === 'credit') {
        setAccountId(data.accounts.find((a) => a.kind !== 'credit')?.id ?? accountId);
      }
    } else if (cat?.kind === 'income') setCategoryId('');
  }

  // Ghi chú / danh mục giống "trả thẻ" mà đang ghi là Chi → nhắc đổi sang Chuyển (không thì bị tính là tiêu 2 lần).
  const looksLikeCardPay =
    kind === 'expense' &&
    data.accounts.some((a) => a.kind === 'credit') &&
    CARD_PAY.test(fold(`${merchant} ${data.categories.find((c) => c.id === categoryId)?.name ?? ''}`));
  function toCardTransfer() {
    switchKind('transfer');
    const card = data.accounts.find((a) => a.kind === 'credit');
    if (card) setToAccountId(card.id);
    // Trả thẻ thường từ tài khoản ngân hàng.
    const from = data.accounts.find((a) => a.kind === 'bank') ?? data.accounts.find((a) => a.kind !== 'credit');
    if (from && data.accounts.find((a) => a.id === accountId)?.kind !== 'bank') setAccountId(from.id);
  }

  function save() {
    if (!valid) return;
    if (transfer) {
      const next: Transaction = {
        id: tx?.id ?? uid(),
        date,
        merchant: merchant.trim() || T.defaultNameTransfer,
        amount,
        categoryId: '',
        accountId,
        toAccountId,
        myShare: 0,
        reimbursed: 0,
        note: tx?.note,
        kind: 'transfer',
        source: tx?.source,
      };
      if (onSave) onSave(next);
      else dispatch({ type: 'upsertTx', tx: next });
      onClose();
      return;
    }
    const sign = refund ? -1 : 1;
    const recurringId = canRepeat && repeat ? uid() : undefined;
    const next: Transaction = {
      id: tx?.id ?? uid(),
      date,
      merchant:
        merchant.trim() || cats.find((c) => c.id === categoryId)?.name || (income ? T.defaultNameIncome : refund ? T.defaultNameRefund : T.defaultNameExpense),
      amount: sign * amount,
      categoryId,
      accountId,
      myShare: sign * myShare,
      splits: !plain && splits.length ? splits : undefined,
      reimbursed: 0,
      note: tx?.note,
      kind: income ? 'income' : undefined,
      spreadMonths: kind === 'expense' && spread > 1 ? spread : undefined,
      source: recurringId ? `recurring:${recurringId}:${date}` : tx?.source,
    };
    if (onSave) onSave(next);
    else dispatch({ type: 'upsertTx', tx: next });
    if (recurringId) {
      // Khoản này là lần đầu; các tháng sau app tự ghi vào cùng ngày.
      dispatch({
        type: 'upsertRecurring',
        item: {
          id: recurringId,
          merchant: next.merchant,
          amount,
          categoryId,
          accountId,
          day: Number(date.slice(8, 10)),
          kind: income ? 'income' : undefined,
          splitId: !plain && mode !== CUSTOM ? mode : undefined,
          people: needsPerson && mode !== CUSTOM ? chosen : undefined,
          startDate: date,
          lastDate: date,
        },
      });
      dispatch({ type: 'postRecurring', today: todayISO() });
    }
    onClose();
  }

  // Giải thích ngắn cho lựa chọn chia tiền đang chọn.
  const splitHint = () => {
    if (amount <= 0) return null;
    if (needsPerson && !chosen.length) return T.needPerson;
    if (!needsPerson || !splits.length) return T.hintAllMine;
    if (myShare < 0) return t(T.customOver, { amount: money(-myShare) });
    const others = splits.map((x) => t(T.hintPerson, { name: nameOf(x.person), amount: money(x.amount) })).join(', ');
    if (myShare === 0) return t(T.hintAllTheirsMulti, { others });
    return t(T.hintMulti, { mine: money(myShare), others });
  };

  return (
    <Sheet title={tx ? T.titleEdit : transfer ? T.titleTransfer : income ? T.titleIncome : refund ? T.titleRefund : T.titleExpense} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="form-top">
          <div className="segmented">
            <button type="button" aria-pressed={kind === 'expense'} onClick={() => switchKind('expense')}>
              {T.kindExpense}
            </button>
            <button type="button" aria-pressed={income} onClick={() => switchKind('income')}>
              {T.kindIncome}
            </button>
            <button type="button" aria-pressed={refund} onClick={() => switchKind('refund')}>
              {T.kindRefund}
            </button>
            <button type="button" aria-pressed={transfer} onClick={() => switchKind('transfer')}>
              {T.kindTransfer}
            </button>
          </div>
          {!tx && onImport && (
            <button type="button" className="ai-btn" onClick={onImport} aria-label={T.aiScan}>
              <Icon name="scan" size={18} />
              <span className="ai-btn__text">{T.aiScan}</span>
            </button>
          )}
        </div>
        {refund && <p className="hint">{T.refundHint}</p>}
        {transfer && <p className="hint">{T.transferHint}</p>}
        {transfer && !tx && onLoan && (
          <button type="button" className="link" onClick={onLoan}>
            {L.loan.fromTransfer}
          </button>
        )}

        <div className={`amount-xl ${plain ? 'amount-xl--refund' : ''}`}>
          <MoneyInput value={amount} onChange={setAmount} autoFocus={!tx && !isTouch} placeholder={T.amountPlaceholder} aria-label={T.amountAria} />
        </div>

        {!transfer && (
          <Section label={refund ? T.categoryLabelRefund : T.categoryLabel}>
            <div className="cat-grid" role="radiogroup" aria-label={T.categoryAria}>
              {cats.map((c) => (
                <button
                  type="button"
                  role="radio"
                  key={c.id}
                  aria-checked={categoryId === c.id}
                  onClick={() => {
                    setCategoryId(c.id);
                    // Khoản mới: chọn sẵn cách chia đã dùng lần gần nhất cho danh mục này (nếu chưa tự chọn).
                    if (!tx && !modeTouched) setModeState(lastSplit(c.id));
                  }}
                  style={{ '--c': catColor(c.id, c) } as React.CSSProperties}
                >
                  <span className="cat-grid__icon">
                    <Icon name={catIcon(c.id, c)} size={20} />
                  </span>
                  {c.name}
                </button>
              ))}
              <button type="button" className="cat-grid__add" onClick={() => setAdding('category')}>
                <span className="cat-grid__icon">
                  <Icon name="plus" size={22} />
                </span>
                {T.addCategory}
              </button>
            </div>
          </Section>
        )}

        <Section label={T.noteLabel}>
          <input
            className="note-input"
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            placeholder={transfer ? T.notePlaceholderTransfer : income ? T.notePlaceholderIncome : refund ? T.notePlaceholderRefund : T.notePlaceholderExpense}
            list="merchants"
          />
          {looksLikeCardPay && (
            <div className="banner banner--stack">
              <span>
                <Rich text={T.cardPayWarn} />
              </span>
              <button type="button" className="btn btn--primary" onClick={toCardTransfer}>
                {T.cardPaySwitch}
              </button>
            </div>
          )}
          <datalist id="merchants">
            {[...new Set(data.transactions.map((t) => t.merchant))].map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </Section>

        <div className="tx-pair">
          <Section label={T.dateLabel}>
            <label className="opt opt--field">
              <Icon name="calendar" size={16} />
              {dayLabel(date, today)}
              <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label={T.dateAria} />
            </label>
          </Section>
          <Section label={transfer ? T.fromLabel : income ? T.accountLabelIncome : refund ? T.accountLabelRefund : T.accountLabelExpense}>
            <label className="opt opt--field">
              <Icon name="card" size={16} />
              <select
                value={accountId}
                onChange={(e) => (e.target.value === '__new' ? setAdding('account') : setAccountId(e.target.value))}
                aria-label={T.accountAria}
              >
                {data.accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
                <option value="__new">{T.addAccount}</option>
              </select>
            </label>
          </Section>
        </div>

        {transfer && (
          <Section label={T.toLabel}>
            <label className="opt opt--field">
              <Icon name="card" size={16} />
              <select value={toAccountId} onChange={(e) => setToAccountId(e.target.value)} aria-label={T.toLabel}>
                {data.accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            {toAccountId === accountId && <p className="hint neg">{T.sameAccount}</p>}
          </Section>
        )}

        {!plain && (
          <Section
            label={T.splitLabel}
            action={
              <button type="button" className="link" onClick={() => setAdding('split')}>
                {T.addSplit}
              </button>
            }
          >
            <div className="split-row" role="radiogroup" aria-label={T.splitAria}>
              {[...BUILTIN, 'custom' as const, ...customRatios(data.settings)].map((p) =>
                p === 'custom' ? (
                  <button type="button" role="radio" key="custom" aria-checked={mode === CUSTOM} className="chip" onClick={() => setMode(CUSTOM)}>
                    {T.splitCustom}
                  </button>
                ) : (
                  <button type="button" role="radio" key={p.id} aria-checked={mode === p.id} className="chip" onClick={() => setMode(p.id)}>
                    {presetLabel(p, oneName)}
                  </button>
                ),
              )}
            </div>
            {needsPerson && (
              <div className="who">
                <span className="who__label">{T.withWho}</span>
                <div className="chips">
                  {people.map((x) => (
                    <button type="button" key={x.id} className="chip" aria-pressed={chosen.includes(x.id)} onClick={() => toggleWho(x.id)}>
                      {x.name}
                    </button>
                  ))}
                  {newPerson === null ? (
                    <button type="button" className="chip chip--add" onClick={() => setNewPerson('')}>
                      {T.addPerson}
                    </button>
                  ) : (
                    <span className="who__new">
                      <input
                        value={newPerson}
                        autoFocus
                        placeholder={T.personPlaceholder}
                        onChange={(e) => setNewPerson(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addPerson(newPerson);
                          }
                        }}
                      />
                      <button type="button" className="chip" onClick={() => addPerson(newPerson)}>
                        {T.addPersonOk}
                      </button>
                    </span>
                  )}
                </div>
              </div>
            )}
            {mode === CUSTOM && chosen.length > 0 && (
              <div className="share-list">
                {chosen.map((id) => (
                  <label key={id} className="share-row">
                    <span>{t(T.theirPart, { name: nameOf(id) })}</span>
                    <MoneyInput value={customAmounts[id] ?? 0} onChange={(n) => setCustomAmounts((x) => ({ ...x, [id]: n }))} />
                  </label>
                ))}
                <div className="share-row share-row--mine">
                  <span>{T.myPart}</span>
                  <b className={myShare < 0 ? 'neg' : ''}>{money(myShare)}</b>
                </div>
              </div>
            )}
            {splitHint() && <p className="hint">{splitHint()}</p>}
          </Section>
        )}

        {kind === 'expense' && !repeat && (
          <div className="field">
            {/* Mặc định tắt: chỉ ai đóng trước (quỹ, học phí, bảo hiểm…) mới cần. */}
            <label className="switch-row">
              <span>
                {T.spreadLabel}
                <small>{spread > 1 && amount > 0 ? t(T.spreadHint, { n: spread, amount: money(Math.round(myShare / spread)) }) : T.spreadExample}</small>
              </span>
              <input type="checkbox" checked={spread > 1} onChange={(e) => setSpread(e.target.checked ? 2 : 1)} />
            </label>
            {spread > 1 && (
              <div className="chips">
                {[2, 3, 6, 12].map((n) => (
                  <button type="button" key={n} className="chip" aria-pressed={spread === n} onClick={() => setSpread(n)}>
                    {t(T.spreadN, { n })}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {canRepeat && (
          <label className="switch-row">
            <span>
              {T.repeatLabel}
              {repeat && <small>{t(T.repeatHint, { day: Number(date.slice(8, 10)) })}</small>}
            </span>
            <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} />
          </label>
        )}

        <button type="submit" className="btn btn--primary btn--block" disabled={!valid}>
          {valid ? T.save : amount > 0 ? (transfer ? T.sameAccount : !cats.some((c) => c.id === categoryId) ? T.pickCategory : T.needPerson) : T.enterAmount}
        </button>
        {tx && !draft && (
          <button
            type="button"
            className="btn btn--danger-ghost btn--block"
            onClick={() => {
              if (confirm(T.confirmDelete)) {
                dispatch({ type: 'deleteTx', id: tx.id });
                onClose();
              }
            }}
          >
            {T.delete}
          </button>
        )}
      </form>
      {!tx && !draft && <Tour id="tx-form" steps={formTour} delay={500} />}
      {adding === 'category' && <CategoryForm defaultKind={income ? 'income' : 'spend'} onClose={() => setAdding(null)} onSaved={setCategoryId} />}
      {adding === 'account' && <AccountForm onClose={() => setAdding(null)} onSaved={setAccountId} />}
      {adding === 'split' && <SplitPresetForm onClose={() => setAdding(null)} onSaved={setMode} />}
    </Sheet>
  );
}
