/** Tab Thẻ → Đối chiếu sao kê: đọc file sao kê, so với các khoản đã ghi trên thẻ, chỉ ra thiếu / trùng / lệch. */
import { useRef, useState } from 'react';
import { dm, money, uid } from '../domain/format';
import { reconcile, type StatementLine } from '../domain/reconcile';
import type { PeriodKey, Transaction } from '../domain/types';
import { cardSettings, periodInfo } from '../domain/calc';
import { GmailError, bankQuery, fetchBankEmails } from '../sync/gmail';
import { CLIENT_ID } from '../sync/googleDrive';
import { useStore } from '../store';
import { Sheet, Info } from './ui';
import { Icon } from './icons';
import { L } from '../labels';
import { Rich, t } from '../i18n';

const R = L.reconcile;
const hasClientId = !!CLIENT_ID;
type Line = StatementLine & { categoryId: string };

export function ReconcileSheet({
  accountId,
  period,
  onEdit,
  onClose,
}: {
  accountId: string;
  /** Kỳ sao kê đang xem: quét email chỉ lấy giao dịch trong kỳ này. */
  period: PeriodKey;
  onEdit: (t: Transaction) => void;
  onClose: () => void;
}) {
  const { data, dispatch } = useStore();
  const info = periodInfo(period, cardSettings(data, accountId));
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [lines, setLines] = useState<Line[] | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());

  /** Đọc file (PDF / ảnh) hoặc email ngân hàng → các dòng sao kê → so với app. */
  async function analyze(source: { files?: File[]; gmail?: boolean }) {
    setBusy(true);
    setError('');
    try {
      // Dùng lại phần đọc PDF / AI / Gmail của "AI quét"; chỉ tải khi cần.
      const [{ readPdf, PdfSkipped }, ex, { extractLocally }, { getApiKey }] = await Promise.all([
        import('../ai/pdf'),
        import('../ai/extract'),
        import('../ai/local'),
        import('../ai/key'),
      ]);
      const files = source.files ?? [];
      const images = await Promise.all(files.filter((f) => f.type.startsWith('image/')).map(ex.fileToImage));
      const docs: { name: string; text: string }[] = [];
      const openPdf = async (bytes: Uint8Array, name: string, owner: string) => {
        try {
          const pdf = await readPdf(bytes, name, owner);
          images.push(...pdf.images);
          return pdf.text;
        } catch (e) {
          if (!(e instanceof PdfSkipped)) throw e;
          setError(e.message);
          return '';
        }
      };
      for (const f of files.filter((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name))) {
        const text = await openPdf(new Uint8Array(await f.arrayBuffer()), f.name, 'file');
        if (text) docs.push({ name: f.name, text });
      }
      // Email ngân hàng trong kỳ sao kê (cả file sao kê PDF đính kèm nếu có).
      const emails = source.gmail ? await fetchBankEmails({ query: bankQuery(info.start, info.due), max: 100, skipIds: new Set() }) : [];
      for (const m of emails) {
        for (const a of m.attachments ?? []) {
          const text = await openPdf(a.data, a.filename, m.from.match(/<([^>]+)>/)?.[1] ?? m.from);
          if (text) m.text += `\n\n[Tệp đính kèm: ${a.filename}]\n${text}`;
        }
        delete m.attachments;
      }
      if (source.gmail && !emails.length) throw new Error(R.noEmails);
      const today = new Date().toISOString().slice(0, 10);
      const rows = getApiKey()
        ? await ex.extractTransactions(data, { images, docs, emails }, today)
        : images.length
          ? (() => {
              throw new Error(R.needAi);
            })()
          : extractLocally(data, { docs, emails }, today);
      const out = rows
        .filter((r) => r.type !== 'income')
        // Email: chỉ lấy khoản trong kỳ và không phải của nguồn tiền khác (email báo trừ tài khoản ngân hàng…).
        .filter((r) => !source.gmail || (r.date >= info.start && r.date <= info.end && (r.accountId === accountId || !data.accounts.some((a) => a.id === r.accountId))))
        .map((r) => ({ date: r.date, merchant: r.merchant, amount: r.type === 'refund' ? -Math.abs(r.amount) : Math.abs(r.amount), categoryId: r.categoryId }));
      if (!out.length) setError(R.nothing);
      setLines(out);
      setDone(new Set());
    } catch (e) {
      setError(e instanceof GmailError || e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const res = lines ? reconcile(data, accountId, lines, info) : null;
  const lineKey = (l: StatementLine) => `${l.date}|${l.amount}|${l.merchant}`;
  const missing = (res?.missing ?? []) as Line[];
  const todo = missing.filter((l) => !done.has(lineKey(l)));

  function add(l: Line) {
    const fallbackCat = data.categories.find((c) => c.kind === 'spend')?.id ?? '';
    const tx: Transaction = {
      id: uid(),
      date: l.date,
      merchant: l.merchant,
      amount: l.amount,
      myShare: l.amount,
      categoryId: data.categories.some((c) => c.id === l.categoryId) ? l.categoryId : fallbackCat,
      accountId,
      reimbursed: 0,
      source: `statement:${lineKey(l)}`,
    };
    dispatch({ type: 'upsertTx', tx });
    setDone((s) => new Set(s).add(lineKey(l)));
  }

  function fixAmount(tx: Transaction, amount: number) {
    // Không chia tiền thì phần mình = cả khoản; có chia thì giữ nguyên tỉ lệ phần mình.
    const myShare = tx.myShare === tx.amount ? amount : Math.round((tx.myShare / tx.amount) * amount);
    dispatch({ type: 'upsertTx', tx: { ...tx, amount, myShare } });
    setDone((s) => new Set(s).add(tx.id));
  }

  return (
    <Sheet title={R.title} info={R.hint} onClose={onClose}>
      <div className="form">
        <button className="btn btn--block add-btn" disabled={busy} onClick={() => file.current?.click()}>
          <Icon name="fact_check" size={20} /> {busy ? R.reading : res ? R.again : R.pick}
        </button>
        {hasClientId && (
          <button className="btn btn--block" disabled={busy} onClick={() => void analyze({ gmail: true })}>
            <Icon name="mail" size={20} /> {t(R.gmail, { range: `${dm(info.start)} – ${dm(info.end)}` })}
          </button>
        )}
        <input
          ref={file}
          type="file"
          accept="application/pdf,image/*"
          multiple
          hidden
          onChange={(e) => {
            // Chép danh sách file ra trước khi xoá ô chọn (xoá xong danh sách gốc thành rỗng).
            if (e.target.files?.length) void analyze({ files: [...e.target.files] });
            e.target.value = '';
          }}
        />
        {error && <p className="hint neg">{error}</p>}

        {res && lines && lines.length > 0 && (
          <>
            <p>
              <Rich text={R.summary} vars={{ n: lines.length, ok: res.matched.length }} />
            </p>
            {!missing.length && !res.extra.length && !res.mismatched.length && <p className="pos">{R.allGood}</p>}

            {missing.length > 0 && (
              <section className="rec-group">
                <header>
                  <b>{t(R.missingTitle, { n: missing.length })}<Info>{R.missingHint}</Info></b>
                  {todo.length > 1 && (
                    <button className="link" onClick={() => todo.forEach(add)}>
                      {t(R.addAll, { n: todo.length })}
                    </button>
                  )}
                </header>
                <ul className="plain-list">
                  {missing.map((l) => (
                    <li key={lineKey(l)} className="rec-row">
                      <span>
                        <b>{l.merchant}</b>
                        <small>{dm(l.date)}</small>
                      </span>
                      <b className={l.amount < 0 ? 'pos' : ''}>{money(l.amount)}</b>
                      {done.has(lineKey(l)) ? (
                        <span className="pos rec-done">{R.added}</span>
                      ) : (
                        <button className="chip chip--accent" onClick={() => add(l)}>
                          {R.add}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {res.mismatched.length > 0 && (
              <section className="rec-group">
                <header>
                  <b>{t(R.mismatchTitle, { n: res.mismatched.length })}</b>
                </header>
                <ul className="plain-list">
                  {res.mismatched.map(({ line, tx }) => (
                    <li key={tx.id} className="rec-row">
                      <span>
                        <b>{tx.merchant}</b>
                        <small>
                          {dm(tx.date)} · {t(R.mismatchLine, { app: money(tx.amount), bank: money(line.amount) })}
                        </small>
                      </span>
                      {done.has(tx.id) ? (
                        <span className="pos rec-done">{R.fixed}</span>
                      ) : (
                        <button className="chip chip--accent" onClick={() => fixAmount(tx, line.amount)}>
                          {t(R.fixAmount, { amount: money(line.amount) })}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {res.extra.length > 0 && (
              <section className="rec-group">
                <header>
                  <b>
                    {t(R.extraTitle, { n: res.extra.length })}
                    <Info>{R.extraHint}</Info>
                  </b>
                </header>
                <ul className="plain-list">
                  {res.extra.map(({ tx, dup }) => (
                    <li key={tx.id}>
                      <button className="row-btn" onClick={() => onEdit(tx)}>
                        <span>
                          <b>{tx.merchant}</b>
                          <small>
                            {dm(tx.date)}
                            {dup && <span className="tag tag--warn">{R.dup}</span>}
                          </small>
                        </span>
                        <b>{money(tx.amount)}</b>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </Sheet>
  );
}
