/** Cài đặt → Sao lưu & dữ liệu → Nhập từ app khác (Money Lover, Misa, Excel / CSV ngân hàng). */
import { useMemo, useRef, useState } from 'react';
import { dm, money } from '../domain/format';
import type { ColKey, Sheet as DataSheet } from '../domain/importer';
import { useStore } from '../store';
import { Card, Sheet, Info } from './ui';
import { Icon } from './icons';
import { L } from '../labels';
import { Rich, t } from '../i18n';

const M = L.migrate;
const COLS: ColKey[] = ['date', 'amount', 'income', 'expense', 'type', 'category', 'note', 'account'];
type Importer = typeof import('../domain/importer');

export function MigrateCard() {
  const file = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState<{ lib: Importer; sheet: DataSheet } | null>(null);
  const [busy, setBusy] = useState(false);

  async function pick(f: File) {
    setBusy(true);
    try {
      // Phần đọc Excel khá nặng nên chỉ tải khi cần.
      const lib = await import('../domain/importer');
      const sheet = await lib.readFile(f);
      if (!sheet.rows.length) throw new Error();
      setOpen({ lib, sheet });
    } catch {
      alert(M.readFail);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title={M.title} info={`${M.hint} ${M.how}`}>
      <button className="btn btn--block add-btn" disabled={busy} onClick={() => file.current?.click()}>
        <Icon name="upload_file" size={20} /> {busy ? L.common.loading : M.pick}
      </button>
      <input
        ref={file}
        type="file"
        accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        hidden
        onChange={(e) => {
          if (e.target.files?.[0]) void pick(e.target.files[0]);
          e.target.value = '';
        }}
      />
      {open && <MigrateSheet lib={open.lib} sheet={open.sheet} onClose={() => setOpen(null)} />}
    </Card>
  );
}

function MigrateSheet({ lib, sheet, onClose }: { lib: Importer; sheet: DataSheet; onClose: () => void }) {
  const { data, dispatch } = useStore();
  const [cols, setCols] = useState(() => lib.guessColumns(sheet.headers));
  const [fallback, setFallback] = useState(data.accounts.find((a) => a.kind !== 'credit')?.id ?? data.accounts[0]?.id);
  const parsed = useMemo(() => lib.parseRows(sheet, cols), [lib, sheet, cols]);
  const plan = useMemo(() => lib.buildImport(parsed.rows, data, fallback), [lib, parsed, data, fallback]);
  const txs = plan.transactions;
  const spent = txs.filter((x) => x.kind !== 'income').reduce((a, x) => a + x.amount, 0);
  const earned = txs.filter((x) => x.kind === 'income').reduce((a, x) => a + x.amount, 0);
  const dates = txs.map((x) => x.date).sort();
  const needsFallback = parsed.rows.some((r) => !r.account);

  return (
    <Sheet title={M.sheetTitle} onClose={onClose}>
      <div className="form">
        <div className="field">
          <span>
            {M.colsTitle}
            <Info>{M.colsHint}</Info>
          </span>
          <div className="map-grid">
            {COLS.map((k) => (
              <label key={k} className="field">
                <span>{M.cols[k]}</span>
                <select
                  value={cols[k] ?? ''}
                  onChange={(e) => setCols({ ...cols, [k]: e.target.value === '' ? undefined : Number(e.target.value) })}
                >
                  <option value="">{M.colNone}</option>
                  {sheet.headers.map((h, i) => (
                    <option key={i} value={i}>
                      {h || `#${i + 1}`}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </div>
        {needsFallback && data.accounts.length > 0 && (
          <label className="field">
            <span>{M.account}</span>
            <select value={fallback} onChange={(e) => setFallback(e.target.value)}>
              {data.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {txs.length === 0 ? (
          <p className="empty">{M.nothing}</p>
        ) : (
          <div className="migrate-sum">
            <p>
              <Rich text={M.summary} vars={{ n: txs.length, spent: money(spent), earned: money(earned) }} />
            </p>
            <p className="muted">{t(M.range, { from: dm(dates[0]), to: dm(dates[dates.length - 1]) + '/' + dates[dates.length - 1].slice(0, 4) })}</p>
            {plan.newCategories.length > 0 && <p className="muted">{t(M.newCats, { names: plan.newCategories.map((c) => c.name).join(', ') })}</p>}
            {plan.newAccounts.length > 0 && <p className="muted">{t(M.newAccounts, { names: plan.newAccounts.map((a) => a.name).join(', ') })}</p>}
          </div>
        )}
        {parsed.skipped > 0 && <p className="hint">{t(M.skipped, { n: parsed.skipped })}</p>}
        {plan.transfers > 0 && <p className="hint">{t(M.transfers, { n: plan.transfers })}</p>}
        {plan.duplicates > 0 && <p className="hint">{t(M.duplicates, { n: plan.duplicates })}</p>}
        <ul className="plain-list migrate-preview">
          {txs.slice(0, 5).map((x) => (
            <li key={x.id} className="split-line">
              <span>
                {dm(x.date)} · {x.merchant}
              </span>
              <b className={x.kind === 'income' ? 'pos' : ''}>
                {x.kind === 'income' ? '+' : ''}
                {money(x.amount)}
              </b>
            </li>
          ))}
        </ul>
        <button
          className="btn btn--primary btn--block"
          disabled={!txs.length}
          onClick={() => {
            dispatch({ type: 'importPlan', categories: plan.newCategories, accounts: plan.newAccounts, txs });
            alert(t(M.done, { n: txs.length }));
            onClose();
          }}
        >
          {t(M.import, { n: txs.length })}
        </button>
      </div>
    </Sheet>
  );
}
