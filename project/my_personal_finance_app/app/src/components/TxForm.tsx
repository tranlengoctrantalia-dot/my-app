import { useState, type ReactNode } from 'react';
import { isTouch } from '../viewport';
import { cardSettings, installmentPayment, INSTALLMENT_TERMS, periodOf, shiftPeriod, todayISO } from '../domain/calc';
import { dayLabel, money, periodLabel, uid } from '../domain/format';
import type { Transaction, TxSplit } from '../domain/types';
import { BUILTIN, CUSTOM, customRatios, findPreset, inferSplit, peopleOf, personName, presetLabel, received, setPaid, splitByRatio, splitsOf } from '../domain/split';
import { useStore } from '../store';
import { Info, MoneyInput, Sheet } from './ui';
import { Art, Icon, catColor, catIcon } from './icons';
import { AccountForm, CategoryForm } from './Manage';
import { SplitPresetForm } from '../screens/Settings';
import { Tour, tourSeen, type TourStep } from './Tour';
import { NewTip } from './WhatsNew';
import { L } from '../labels';
import { fold } from '../ai/redact';
import { CARD_PAY, INSTALLMENT, installmentMatch } from '../domain/insights';
import { Rich, t } from '../i18n';
import { budgetImpact, budgetRoom } from '../domain/coach';

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


/** Ví / thẻ dùng ở khoản ghi gần nhất: khoản mới chọn sẵn ví này. */
const LAST_ACCOUNT = 'vi-cua-nang/last-account';
function lastAccount() {
  try {
    return localStorage.getItem(LAST_ACCOUNT);
  } catch {
    return null;
  }
}
function rememberAccount(id: string) {
  try {
    localStorage.setItem(LAST_ACCOUNT, id);
  } catch {
    /* bỏ qua */
  }
}

export function TxForm({
  tx,
  draft,
  onClose,
  onImport,
  onSave,
  onLoan,
  initialKind,
  initialInstallment,
  fill,
}: {
  /** Điền sẵn khi mở từ nút "Ghi đã trả thẻ". */
  fill?: { amount: number; merchant: string; toAccountId?: string; source?: string };
  /** Mở bảng cho vay / đi vay thay cho bảng này. */
  onLoan?: () => void;
  tx?: Transaction;
  /** Mở sẵn ở loại này (vd. "Chuyển tiền" từ thẻ Ví của bạn). */
  initialKind?: Kind;
  /** Mở sẵn công tắc Trả góp với thẻ này (nút Thêm ở tab Thẻ). */
  initialInstallment?: string;
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
  // Danh mục hay dùng lên đầu (đếm lúc mở form, để nút không nhảy chỗ khi đang chọn).
  const [uses] = useState(() => {
    const m = new Map<string, number>();
    for (const x of data.transactions) m.set(x.categoryId, (m.get(x.categoryId) ?? 0) + 1);
    return m;
  });
  const cats = data.categories
    .filter((c) => (income ? c.kind === 'income' : c.kind === 'spend' || c.kind === 'fixed'))
    .sort((a, b) => (uses.get(b.id) ?? 0) - (uses.get(a.id) ?? 0));
  const [adding, setAdding] = useState<'category' | 'account' | 'split' | null>(null);

  const [amount, setAmount] = useState(tx ? Math.abs(tx.amount) : (fill?.amount ?? 0));
  const [categoryId, setCategoryId] = useState(tx?.categoryId ?? '');
  // Bỏ trống ghi chú thì app lưu tên danh mục làm tên khoản — mở lại sửa thì không hiện sẵn chữ đó.
  const [merchant, setMerchant] = useState(
    tx && tx.merchant !== data.categories.find((c) => c.id === tx.categoryId)?.name ? tx.merchant : (fill?.merchant ?? ''),
  );
  const [date, setDate] = useState(tx?.date ?? today);
  const [accountId, setAccountId] = useState(
    tx?.accountId ??
      initialInstallment ??
      (initialKind === 'transfer' ? data.accounts.find((a) => a.kind === 'bank') : data.accounts.find((a) => a.id === lastAccount()))?.id ??
      data.accounts[0]?.id ??
      '',
  );
  const [toAccountId, setToAccountId] = useState(
    tx?.toAccountId ?? fill?.toAccountId ?? (data.accounts.find((a) => a.kind === 'credit') ?? data.accounts.find((a) => a.id !== accountId))?.id ?? '',
  );
  // Lặp lại hàng tháng: chỉ khi thêm khoản chi / thu mới.
  const [repeat, setRepeat] = useState(false);
  const canRepeat = !tx && !draft && (kind === 'expense' || income);
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
  const [cancelled, setCancelled] = useState(!!tx?.cancelled);
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
  const splitOn = !plain && mode !== 'me' && (mode === CUSTOM || (preset?.other ?? 0) > 0);
  // Trả góp: công tắc luôn hiện với khoản chi; không quẹt thẻ thì mờ đi kèm lý do. Có chia tiền vẫn được (giữ phần người khác nợ).
  const isCard = data.accounts.find((a) => a.id === accountId)?.kind === 'credit';
  const canInst = kind === 'expense' && !draft && !fill && (!tx || (!tx.kind && !tx.installmentId));
  const instBlock = !isCard ? T.instNeedCard : undefined;
  const [instOn, setInstOn] = useState(!!initialInstallment);
  const [term, setTerm] = useState(0);
  const [fee, setFee] = useState(0);
  const inst = canInst && !instBlock && instOn;
  const instMonthly = installmentPayment(amount, term);
  const firstPeriod = periodOf(date, cardSettings(data, accountId).cutoffDay);
  const room = budgetRoom(data, firstPeriod);
  const needsPerson = splitOn;
  const prevPart = (person: string) => (tx ? splitsOf(tx).find((x) => x.person === person) : undefined);
  const result: { myShare: number; splits: TxSplit[] } = !needsPerson
    ? { myShare: amount, splits: [] }
    : mode === CUSTOM
      ? (() => {
          const splits = chosen.map((person) => ({ person, amount: customAmounts[person] ?? 0, paid: 0 }));
          return { myShare: amount - splits.reduce((a, x) => a + x.amount, 0), splits };
        })()
      : splitByRatio(amount, preset!.mine, preset!.other, chosen);
  // Giữ lại số tiền người đó đã trả + lịch sử trả (khi sửa khoản cũ); phần mới nhỏ hơn số đã trả thì ghi bớt vào hôm nay.
  const splits = result.splits
    .filter((x) => x.amount > 0)
    .map((x) => {
      const prev = prevPart(x.person);
      return prev ? setPaid({ ...x, paid: prev.paid, log: prev.log }, received(prev), todayISO()) : x;
    });
  const myShare = result.myShare;
  /** "Tự nhập": gõ phần mình → phần còn lại chia đều cho những người đang chọn, tiền lẻ dồn vào người đầu. */
  const setMyPart = (mine: number) => {
    if (!chosen.length) return;
    const rest = Math.max(0, amount - Math.min(Math.max(0, mine), amount));
    const each = Math.floor(rest / chosen.length);
    setCustomAmounts((x) => ({ ...x, ...Object.fromEntries(chosen.map((id, i) => [id, each + (i === 0 ? rest - each * chosen.length : 0)])) }));
  };
  // Ngân sách chỉ trừ phần mình của mỗi kỳ góp (khoản có chia tiền).
  const instMine = amount > 0 ? Math.round((instMonthly * myShare) / amount) : instMonthly;
  const roomAfter = room.income > 0 ? room.room - instMine : undefined;
  // Cố vấn theo Ngân sách: danh mục còn bao nhiêu, chi linh hoạt cả tháng còn bao nhiêu sau khoản này.
  const effect = kind === 'expense' && !inst && amount > 0 && categoryId ? budgetImpact(data, categoryId, myShare, date, tx) : undefined;
  const effectNeg = (effect?.catLeft ?? 0) < 0 || (effect?.flexLeft ?? 0) < 0;
  const nameOf = (id: string) => personName(data.settings, id);
  const oneName = chosen.length === 1 ? nameOf(chosen[0]) : undefined;
  const valid = transfer
    ? amount > 0 && !!toAccountId && toAccountId !== accountId
    : amount > 0 && cats.some((c) => c.id === categoryId) && (!inst || term > 0) && (!needsPerson || (chosen.length > 0 && myShare >= 0));
  // Ghi tay trùng khoản trả góp đang chạy, hoặc ghi chú có chữ "trả góp" mà chưa bật công tắc.
  const dup = kind === 'expense' && !inst && amount > 0 ? installmentMatch(data, merchant, amount, date) : undefined;
  const looksInst = !dup && canInst && !instBlock && !inst && INSTALLMENT.test(fold(merchant));

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

  /**
   * Tạo khoản trả góp: app tự cộng vào sao kê (đủ tiền) và ngân sách (phần mình) mỗi tháng tới hết kỳ.
   * Không chia tiền: bỏ giao dịch gốc để không tính 2 lần. Có chia tiền: giữ giao dịch gốc, gắn nhãn đã chuyển
   * trả góp (không tính chi tiêu / sao kê nữa), chỉ để theo dõi người khác còn nợ.
   */
  function saveInstallment(base: Transaction) {
    const cat = cats.find((c) => c.id === categoryId);
    const name = merchant.trim() || cat?.name || '';
    const id = uid();
    const newCat = { id: `inst-${id}`, name: t(L.card.categoryName, { name }), icon: '', kind: 'installment' as const, iconName: cat && catIcon(cat.id, cat), color: cat && catColor(cat.id, cat) };
    const shared = splits.length > 0 && amount > 0;
    dispatch({
      type: 'upsertInstallment',
      item: { id, name, monthly: instMonthly, firstPeriod, months: term, accountId, categoryId: newCat.id, principal: amount, fee: fee || undefined, share: shared ? myShare / amount : undefined },
      category: newCat,
    });
    if (shared) dispatch({ type: 'upsertTx', tx: { ...base, installmentId: id } });
    else if (tx) dispatch({ type: 'deleteTx', id: tx.id });
    rememberAccount(accountId);
    onClose();
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
        // Trả thẻ từ nút "Ghi đã trả thẻ": nhớ là trả cho kỳ nào (đổi thẻ nhận thì bỏ).
        source: tx?.source ?? (fill?.source && toAccountId === fill.toAccountId ? fill.source : undefined),
      };
      if (onSave) onSave(next);
      else dispatch({ type: 'upsertTx', tx: next });
      onClose();
      return;
    }
    const sign = refund ? -1 : 1;
    const recurringId = canRepeat && repeat && !inst ? uid() : undefined;
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
      // Giữ cách chia nhiều tháng của khoản cũ (đã bỏ nút chọn).
      spreadMonths: kind === 'expense' ? tx?.spreadMonths : undefined,
      source: recurringId ? `recurring:${recurringId}:${date}` : tx?.source,
      // Sửa khoản đã chuyển trả góp: vẫn giữ là trả góp.
      installmentId: tx?.installmentId,
      cancelled: tx && cancelled ? true : undefined,
    };
    if (inst) return saveInstallment(next);
    if (onSave) onSave(next);
    else dispatch({ type: 'upsertTx', tx: next });
    // Vừa huỷ khoản mua mà đã có khoản hoàn cùng số tiền, cùng nguồn: huỷ luôn khoản hoàn, kẻo bị trừ tiền 2 lần.
    if (next.cancelled && !tx?.cancelled && next.amount > 0) {
      const back = data.transactions.find(
        (x) => !x.cancelled && !x.kind && x.accountId === next.accountId && x.amount === -next.amount && x.date >= next.date,
      );
      if (back && confirm(t(T.cancelRefundConfirm, { amount: money(next.amount), date: `${back.date.slice(8, 10)}/${back.date.slice(5, 7)}` })))
        dispatch({ type: 'upsertTx', tx: { ...back, cancelled: true } });
    }
    if (!tx) rememberAccount(accountId);
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
    <Sheet
      title={tx ? T.titleEdit : transfer ? T.titleTransfer : income ? T.titleIncome : refund ? T.titleRefund : T.titleExpense}
      info={refund ? T.refundHint : transfer ? T.transferHint : undefined}
      onClose={onClose}
    >
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
        {transfer && !tx && onLoan && (
          <button type="button" className="link" onClick={onLoan}>
            {L.loan.fromTransfer}
          </button>
        )}

        <div className={`amount-xl ${plain ? 'amount-xl--refund' : ''}`}>
          <MoneyInput value={amount} onChange={setAmount} autoFocus={!tx && !isTouch} placeholder={T.amountPlaceholder} aria-label={T.amountAria} />
        </div>

        {effect && (effect.catLeft !== undefined || effect.flexLeft !== undefined) && (
          <p className={`hint advice-hint ${effectNeg ? 'neg' : ''}`}>
            {[
              effect.catLeft !== undefined &&
                t(effect.catLeft < 0 ? L.coach.txCatOver : L.coach.txCatLeft, { name: cats.find((c) => c.id === categoryId)?.name ?? '', amount: money(Math.abs(effect.catLeft)) }),
              effect.flexLeft !== undefined &&
                t(effect.flexLeft < 0 ? L.coach.txFlexOver : L.coach.txFlexLeft, { m: Number(effect.month.slice(5, 7)), amount: money(Math.abs(effect.flexLeft)) }),
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}

        {/* Ngày + ví ngay dưới số tiền: chỗ hay chọn nhầm nhất, phải thấy liền. */}
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

        {canInst && (
          <label className={`switch-row ${instBlock ? 'switch-row--off' : ''}`} data-tour="convert">
            <span>
              {tx ? T.instConvert : T.instLabel}
              {instBlock && <Info>{instBlock}</Info>}
            </span>
            <input type="checkbox" checked={inst} disabled={!!instBlock} onChange={(e) => setInstOn(e.target.checked)} />
          </label>
        )}
        {inst && (
          <Section label={T.instTerm}>
            <div className="chips">
              {INSTALLMENT_TERMS.map((n) => (
                <button type="button" key={n} className="chip" aria-pressed={term === n} onClick={() => setTerm(n)}>
                  {n}
                </button>
              ))}
              <input
                className="chip chip--input"
                type="number"
                min={1}
                inputMode="numeric"
                placeholder={L.card.termOther}
                value={INSTALLMENT_TERMS.includes(term) || !term ? '' : term}
                onChange={(e) => setTerm(Number(e.target.value) || 0)}
                aria-label={L.card.termOtherAria}
              />
            </div>
            <label className="field">
              <span>{T.instFee}</span>
              <MoneyInput value={fee} onChange={setFee} placeholder="0" />
            </label>
            {amount > 0 && term > 0 && (
              <p className={`hint advice-hint ${roomAfter !== undefined && roomAfter < room.flexPlanned ? 'neg' : ''}`}>
                {t(T.instResult, { monthly: money(instMonthly), period: periodLabel(shiftPeriod(firstPeriod, term - 1)) })}
                {fee > 0 && ` · ${t(T.instFeeFirst, { amount: money(fee), period: periodLabel(firstPeriod) })}`}
                {roomAfter !== undefined && roomAfter < room.flexPlanned && ` · ${t(T.instOver, { amount: money(room.flexPlanned - roomAfter) })}`}
              </p>
            )}
          </Section>
        )}

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
                    <Art name={catIcon(c.id, c)} size={32} />
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
          {dup && (
            <div className="banner banner--stack">
              <span>{t(T.dupInst, { name: dup.name })}</span>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => {
                  if (tx) dispatch({ type: 'deleteTx', id: tx.id });
                  onClose();
                }}
              >
                {T.dupInstDrop}
              </button>
            </div>
          )}
          {looksInst && (
            <div className="banner banner--stack">
              <span>{T.looksInst}</span>
              <button type="button" className="btn btn--primary" onClick={() => setInstOn(true)}>
                {T.looksInstOn}
              </button>
            </div>
          )}
          <datalist id="merchants">
            {[...new Set(data.transactions.map((t) => t.merchant))].map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </Section>

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
                <label className="share-row share-row--mine">
                  <span>{T.myPart}</span>
                  <MoneyInput className={myShare < 0 ? 'neg' : undefined} value={myShare} onChange={setMyPart} />
                </label>
              </div>
            )}
            {splitHint() && <p className="hint">{splitHint()}</p>}
          </Section>
        )}

        {canRepeat && !inst && (
          <label className="switch-row">
            <span>
              {T.repeatLabel}
              <Info>{t(T.repeatHint, { day: Number(date.slice(8, 10)) })}</Info>
            </span>
            <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} />
          </label>
        )}

        <button type="submit" className="btn btn--primary btn--block" disabled={!valid}>
          {valid ? T.save : amount > 0 ? (transfer ? T.sameAccount : !cats.some((c) => c.id === categoryId) ? T.pickCategory : inst ? T.pickTerm : T.needPerson) : T.enterAmount}
        </button>
        {tx && !draft && !transfer && !tx.kind && (
          <label className="switch-row" data-tour="cancel">
            <span>
              {T.cancelled}
              <Info>{T.cancelledHint}</Info>
            </span>
            <input type="checkbox" checked={cancelled} onChange={(e) => setCancelled(e.target.checked)} />
          </label>
        )}
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
      {mode === CUSTOM && chosen.length > 0 && <NewTip id="myPart" target=".sheet .share-row--mine input" />}
      {tx && canInst && !instBlock && <NewTip id="convert" target=".sheet [data-tour='convert']" />}
      {tx && !draft && !transfer && !tx.kind && (!(canInst && !instBlock) || tourSeen('new-convert')) && (
        <NewTip id="cancel" target=".sheet [data-tour='cancel']" />
      )}
      {adding === 'category' && <CategoryForm defaultKind={income ? 'income' : 'spend'} onClose={() => setAdding(null)} onSaved={setCategoryId} />}
      {adding === 'account' && <AccountForm onClose={() => setAdding(null)} onSaved={setAccountId} />}
      {adding === 'split' && <SplitPresetForm onClose={() => setAdding(null)} onSaved={setMode} />}
    </Sheet>
  );
}
