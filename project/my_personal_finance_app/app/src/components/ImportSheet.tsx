import { useRef, useState } from 'react';
import { AiError, extractTransactions, fileToImage, type DocInput, type Extracted } from '../ai/extract';
import { extractLocally } from '../ai/local';
import { PdfSkipped, readPdf } from '../ai/pdf';
import { getApiKey } from '../ai/key';
import { todayISO } from '../domain/calc';
import { dm, money, uid } from '../domain/format';
import type { Transaction } from '../domain/types';
import { useLookups, useStore } from '../store';
import { BANKS, DEFAULT_LIMITS, GmailError, buildQuery, fetchBankEmails, forgetGmailAccount, getGmailAccount } from '../sync/gmail';
import { CatBadge, Icon } from './icons';
import { TxForm } from './TxForm';
import { Sheet, Info } from './ui';
import { L } from '../labels';
import { splitsOf } from '../domain/split';
// Đặt tên khác vì trong danh sách bên dưới đã có biến `t` (giao dịch).
import { t as fill } from '../i18n';

const T = L.importer;

/** Một dòng chờ duyệt: giao dịch đã dựng sẵn, chạm vào để sửa bằng form như lúc ghi tay. */
interface Row {
  key: string;
  checked: boolean;
  dup: boolean;
  /** Số tiền lớn bất thường (thường là đọc nhầm số tài khoản / mã giao dịch). */
  odd: boolean;
  tx: Transaction;
}

const MODE_KEY = 'vi-cua-nang/import-mode';
/** Từ 200 triệu trở lên: đánh dấu "số lạ?" và bỏ tick sẵn — người dùng xem lại rồi mới thêm. */
const ODD_AMOUNT = 200_000_000;

export function ImportSheet({ onClose, onOpenSettings }: { onClose: () => void; onOpenSettings: () => void }) {
  const { data, dispatch } = useStore();
  const { category, account } = useLookups();
  const [gmail, setGmail] = useState(getGmailAccount());
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string>('');
  const [error, setError] = useState('');
  const [errorUrl, setErrorUrl] = useState<string>();
  const [rows, setRows] = useState<Row[] | null>(null);
  const hasKey = !!getApiKey();
  // "Trên máy": đọc bằng quy tắc, không gửi dữ liệu đi đâu. "Dùng AI": chính xác hơn, đọc được cả ảnh.
  const [mode, setModeState] = useState<'ai' | 'local'>(() => {
    try {
      const saved = localStorage.getItem(MODE_KEY);
      if (saved === 'ai' || saved === 'local') return saved;
    } catch {
      /* bỏ qua */
    }
    return hasKey ? 'ai' : 'local';
  });
  const setMode = (m: 'ai' | 'local') => {
    setModeState(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      /* bỏ qua */
    }
  };
  const [sent, setSent] = useState<string[] | null>(null);
  const [showSent, setShowSent] = useState(false);
  const redactOn = data.settings.aiRedact !== false;

  const importedIds = new Set(data.transactions.map((t) => t.source?.match(/^gmail:(.+)$/)?.[1]).filter(Boolean) as string[]);
  const isDup = (x: Extracted) => data.transactions.some((t) => t.date === x.date && Math.abs(t.amount) === x.amount);

  function show(list: Extracted[], src?: string) {
    setRows(
      list.map((x) => {
        const sign = x.type === 'refund' ? -1 : 1;
        const tx: Transaction = {
          id: uid(),
          date: x.date,
          merchant: x.merchant,
          amount: sign * x.amount,
          myShare: sign * x.amount,
          categoryId: x.categoryId,
          accountId: x.accountId,
          reimbursed: 0,
          kind: x.type === 'income' ? 'income' : undefined,
          source: x.sourceRef ? `gmail:${x.sourceRef}` : src ?? `${mode}:file`,
        };
        const odd = x.amount >= ODD_AMOUNT;
        return { key: tx.id, tx, dup: isDup(x), odd, checked: !isDup(x) && !odd };
      }),
    );
  }
  const [editing, setEditing] = useState<Row | null>(null);
  const update = (key: string, patch: Partial<Row>) => setRows((rs) => rs!.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  async function run(job: () => Promise<Extracted[]>, label: string, src?: string) {
    setError('');
    setErrorUrl(undefined);
    setBusy(label);
    try {
      show(await job(), src);
    } catch (e) {
      setError(e instanceof AiError || e instanceof Error ? e.message : String(e));
      if (e instanceof GmailError) setErrorUrl(e.url);
    } finally {
      setBusy('');
    }
  }

  function scanFiles(files: FileList) {
    run(async () => {
      const list = [...files];
      const images = await Promise.all(list.filter((f) => f.type.startsWith('image/')).map(fileToImage));
      const docs: DocInput[] = [];
      for (const f of list.filter((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name))) {
        setBusy(fill(T.busyOpen, { name: f.name }));
        const pdf = await readPdfSafe(new Uint8Array(await f.arrayBuffer()), f.name, 'file');
        if (pdf?.text) docs.push({ name: f.name, text: pdf.text });
        if (pdf) images.push(...pdf.images);
      }
      if (mode === 'local') {
        if (!docs.length) throw new Error(T.localPdfOnly);
        return extractLocally(data, { docs }, todayISO());
      }
      if (!images.length && !docs.length) return [];
      setBusy(T.busyAi);
      return extractTransactions(data, { images, docs }, todayISO(), setSent);
    }, T.busyFile);
  }

  /** Mở PDF; người dùng bỏ qua (không nhập mật khẩu) thì trả null thay vì dừng cả lượt. */
  async function readPdfSafe(bytes: Uint8Array, name: string, owner: string) {
    try {
      return await readPdf(bytes, name, owner);
    } catch (e) {
      if (e instanceof PdfSkipped) {
        setError(e.message);
        return null;
      }
      throw e;
    }
  }

  const limits = data.settings.gmailLimits ?? DEFAULT_LIMITS;
  const fromGmail = useRef(false);

  function readGmail() {
    run(async () => {
      const emails = await fetchBankEmails({
        query: data.settings.gmailQuery || buildQuery(limits, data.settings.gmailLastRead),
        max: limits.max,
        skipIds: importedIds,
      });
      setGmail(getGmailAccount());
      fromGmail.current = true;
      if (emails.length === 0) return [];
      // Sao kê thẻ nằm trong file PDF đính kèm: mở ra lấy chữ, gắn vào đúng email để AI biết nguồn.
      const images = [];
      for (const m of emails) {
        for (const a of m.attachments ?? []) {
          setBusy(fill(T.busyOpen, { name: a.filename }));
          const owner = m.from.match(/<([^>]+)>/)?.[1] ?? m.from;
          const pdf = await readPdfSafe(a.data, a.filename, owner);
          if (pdf?.text) m.text += `

[Tệp đính kèm: ${a.filename}]
${pdf.text}`;
          if (pdf) images.push(...pdf.images);
        }
        delete m.attachments;
      }
      if (mode === 'local') return extractLocally(data, { emails }, todayISO());
      setBusy(fill(T.busyAiEmails, { n: emails.length }));
      return extractTransactions(data, { emails, images }, todayISO(), setSent);
    }, T.busyGmail);
  }

  function save() {
    const txs: Transaction[] = (rows ?? []).filter((r) => r.checked).map((r) => r.tx);
    if (txs.length) dispatch({ type: 'addTxs', txs });
    // Chỉ ghi nhớ "lần đọc trước" khi đã lưu, để lần sau "Từ lần trước" không bỏ sót email chưa nhập.
    if (fromGmail.current) dispatch({ type: 'settings', patch: { gmailLastRead: todayISO() } });
    onClose();
  }

  const checked = rows?.filter((r) => r.checked).length ?? 0;

  return (
    <Sheet title={T.title} onClose={onClose}>
      <div className="form">
        {rows === null && (
          <>
            <div className="segmented" aria-label={T.modeAria}>
              <button aria-pressed={mode === 'ai'} onClick={() => setMode('ai')}>
                {T.modeAi}
              </button>
              <button aria-pressed={mode === 'local'} onClick={() => setMode('local')}>
                {T.modeLocal}
              </button>
            </div>
            <p className={`privacy-note ${mode === 'ai' && !redactOn ? 'neg' : ''}`}>
              <Icon name={mode === 'local' ? 'check' : 'scan'} size={16} />
              {mode === 'local'
                ? T.privacyLocal
                : redactOn
                  ? T.privacyAiRedact
                  : T.privacyAiNoRedact}
            </p>
          </>
        )}
        {mode === 'ai' && !hasKey && rows === null ? (
          <div className="empty-cta">
            <p className="hint">{T.needKey}</p>
            <button className="btn btn--primary btn--block" onClick={onOpenSettings}>
              {T.enterKey}
            </button>
          </div>
        ) : rows === null ? (
          <>
            <button className="pill-row" onClick={() => file.current?.click()} disabled={!!busy}>
              <span className="pill-row__icon">
                <Icon name="camera" />
              </span>
              <span className="pill-row__text">
                <span>{mode === 'ai' ? T.fileAi : T.fileLocal}</span>
                <small>{mode === 'ai' ? T.fileAiSub : T.fileLocalSub}</small>
              </span>
            </button>
            <input
              ref={file}
              type="file"
              accept={mode === 'ai' ? 'image/*,application/pdf' : 'application/pdf'}
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files?.length) scanFiles(e.target.files);
                e.target.value = '';
              }}
            />
            <button className="pill-row" onClick={readGmail} disabled={!!busy}>
              <span className="pill-row__icon">
                <Icon name="mail" />
              </span>
              <span className="pill-row__text">
                <span>{T.gmail}</span>
                <small>{gmail ? fill(T.gmailSubAccount, { account: gmail }) : T.gmailSubNone}</small>
              </span>
            </button>
            <GmailLimitsPanel />
            {gmail && (
              <button
                className="link link--center"
                disabled={!!busy}
                onClick={() => {
                  forgetGmailAccount();
                  setGmail('');
                }}
              >
                {T.switchGmail}
              </button>
            )}
            {busy && <p className="busy">{busy}</p>}
            {error && <p className="hint neg">{error}</p>}
            {errorUrl && (
              <a className="btn btn--block" href={errorUrl} target="_blank" rel="noreferrer">
                {T.openGmailApi}
              </a>
            )}
          </>
        ) : rows.length === 0 ? (
          <>
            <p className="empty">{T.empty}</p>
            {mode === 'local' && <p className="hint hint--center">{T.emptyTryAi}</p>}
            <button className="btn btn--block" onClick={() => setRows(null)}>
              {T.retry}
            </button>
          </>
        ) : (
          <>
            {/* Nguồn tiền: đoán theo tên ngân hàng/thẻ trong email hoặc tên file — chạm để đổi cho tất cả. */}
            <div className="src-bar">
              <span className="src-bar__label">{T.source}</span>
              <div className="chips">
                {data.accounts.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className="chip"
                    aria-pressed={rows.every((r) => r.tx.accountId === a.id)}
                    onClick={() => setRows((rs) => rs!.map((x) => ({ ...x, tx: { ...x.tx, accountId: a.id } })))}
                  >
                    {a.name}
                  </button>
                ))}
              </div>
            </div>
            <ul className="tx-list import-list">
              {rows.map((r) => {
                const t = r.tx;
                const plus = t.kind === 'income' || t.amount < 0;
                const shared = splitsOf(t).length > 0 && t.myShare !== t.amount;
                return (
                  <li key={r.key} className="import-row">
                    <input
                      type="checkbox"
                      aria-label={T.pickRow}
                      checked={r.checked}
                      onChange={() => update(r.key, { checked: !r.checked })}
                    />
                    {/* Chạm để sửa danh mục, số tiền, ngày, nguồn, cách chia… */}
                    <button type="button" className="tx" onClick={() => setEditing(r)}>
                      <CatBadge id={t.categoryId} size={36} />
                      <span className="tx__main">
                        <span className="tx__title">{t.merchant}</span>
                        <span className="tx__meta">
                          {dm(t.date)} · {category(t.categoryId)?.name} · {account(t.accountId)?.name}
                          {shared && <span className="tag">{T.tagShared}</span>}
                          {r.dup && <span className="tag tag--warn">{T.tagDup}</span>}
                          {r.odd && Math.abs(t.amount) >= ODD_AMOUNT && <span className="tag tag--warn">{T.tagOdd}</span>}
                        </span>
                      </span>
                      <span className="tx__amt">
                        <span className={plus ? 'pos' : ''}>
                          {plus ? '+' : ''}
                          {money(Math.abs(t.amount))}
                        </span>
                        {shared ? <small>{fill(T.mine, { amount: money(t.myShare) })}</small> : <small className="import-edit">{T.edit}</small>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <button className="btn btn--primary btn--block" disabled={!checked} onClick={save}>
              {fill(T.add, { n: checked })}
            </button>
            {sent && (
              <>
                <button className="link link--center" onClick={() => setShowSent((v) => !v)}>
                  {showSent ? T.hideSent : T.showSent}
                </button>
                {showSent && <pre className="sent-preview">{sent.join('\n\n')}</pre>}
              </>
            )}
          </>
        )}
      </div>
      {editing && (
        <TxForm
          tx={editing.tx}
          draft
          onClose={() => setEditing(null)}
          onSave={(tx) => update(editing.key, { tx, checked: true })}
        />
      )}
    </Sheet>
  );
}


const RANGES: { id: 'since' | 7 | 30 | 90; label: string }[] = [
  { id: 'since', label: T.limits.rangeSince },
  { id: 7, label: fill(T.limits.rangeDays, { n: 7 }) },
  { id: 30, label: fill(T.limits.rangeDays, { n: 30 }) },
  { id: 90, label: fill(T.limits.rangeDays, { n: 90 }) },
];
const MAXES = [20, 50, 100];

/** Giới hạn khi quét Gmail — thu gọn thành 1 dòng, chạm "Giới hạn" để chỉnh. Lưu lại cho lần sau. */
function GmailLimitsPanel() {
  const { data, dispatch } = useStore();
  const [open, setOpen] = useState(false);
  const l = data.settings.gmailLimits ?? DEFAULT_LIMITS;
  const set = (patch: Partial<typeof l>) => dispatch({ type: 'settings', patch: { gmailLimits: { ...l, ...patch } } });
  const banks = l.banks ?? [];
  const last = data.settings.gmailLastRead;
  const rangeText =
    l.range === 'since' ? (last ? fill(T.limits.sinceDate, { date: `${last.slice(8, 10)}/${last.slice(5, 7)}` }) : T.limits.sinceNever) : fill(T.limits.rangeDays, { n: l.range });
  const custom = !!data.settings.gmailQuery;
  const bankText = banks.length
    ? BANKS.filter((b) => banks.includes(b.id))
        .map((b) => b.name)
        .join(', ')
    : T.limits.allBanks;

  return (
    <div className="gmail-limits">
      <button type="button" className="gmail-limits__summary" onClick={() => setOpen((o) => !o)}>
        <span>{custom ? T.limits.customQuery : fill(T.limits.summary, { range: rangeText, max: l.max, banks: bankText })}</span>
        <b>{open ? T.limits.done : T.limits.open}</b>
      </button>
      {open && (
        <div className="gmail-limits__body">
          <span className="gmail-limits__label">{T.limits.timeLabel}</span>
          <div className="chips">
            {RANGES.map((r) => (
              <button key={r.id} type="button" className="chip" aria-pressed={l.range === r.id} onClick={() => set({ range: r.id })}>
                {r.label}
              </button>
            ))}
          </div>
          <span className="gmail-limits__label">{T.limits.maxLabel}</span>
          <div className="chips">
            {MAXES.map((n) => (
              <button key={n} type="button" className="chip" aria-pressed={l.max === n} onClick={() => set({ max: n })}>
                {fill(T.limits.maxOption, { n })}
              </button>
            ))}
          </div>
          <span className="gmail-limits__label">{T.limits.banksLabel}</span>
          <div className="chips">
            {BANKS.map((b) => (
              <button
                key={b.id}
                type="button"
                className="chip"
                aria-pressed={banks.includes(b.id)}
                onClick={() => set({ banks: banks.includes(b.id) ? banks.filter((x) => x !== b.id) : [...banks, b.id] })}
              >
                {b.name}
              </button>
            ))}
          </div>
          {custom && <Info>{T.limits.customHint}</Info>}
        </div>
      )}
    </div>
  );
}
