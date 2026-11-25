import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { askMoney, type ChatMsg } from '../ai/chat';
import { AiError } from '../ai/extract';
import { todayISO } from '../domain/calc';
import { useStore } from '../store';
import { L } from '../labels';
import { Sheet } from './ui';

/** Con robot nhỏ (vẽ bằng SVG, theo màu chủ đề). */
export function RobotArt({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <line x1="32" y1="6" x2="32" y2="14" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <circle className="bot__dot" cx="32" cy="6" r="4" fill="#ffd166" />
      <rect x="8" y="14" width="48" height="40" rx="16" fill="currentColor" />
      <rect x="15" y="22" width="34" height="22" rx="11" fill="#fff" />
      <circle className="bot__eye" cx="25" cy="32" r="3.6" fill="#1f2a44" />
      <circle className="bot__eye" cx="39" cy="32" r="3.6" fill="#1f2a44" />
      <circle cx="19.5" cy="38.5" r="2.6" fill="#ff8fa3" opacity=".75" />
      <circle cx="44.5" cy="38.5" r="2.6" fill="#ff8fa3" opacity=".75" />
      <path d="M28 38.5q4 3.2 8 0" stroke="#1f2a44" strokeWidth="2" fill="none" strokeLinecap="round" />
      <rect x="3" y="28" width="5" height="12" rx="2.5" fill="currentColor" />
      <rect x="56" y="28" width="5" height="12" rx="2.5" fill="currentColor" />
    </svg>
  );
}

/** **đậm** trong một dòng. */
function inline(s: string): ReactNode {
  return s.split(/\*\*(.+?)\*\*/g).map((p, i) => (i % 2 ? <b key={i}>{p}</b> : <Fragment key={i}>{p}</Fragment>));
}

/** Hiện câu trả lời dạng markdown đơn giản: bảng, gạch đầu dòng, tiêu đề, chữ đậm. */
export function MiniMarkdown({ text }: { text: string }) {
  const out: ReactNode[] = [];
  const lines = text.replace(/\r/g, '').split('\n');
  for (let i = 0; i < lines.length; ) {
    const line = lines[i].trim();
    if (line.startsWith('|')) {
      const rows: string[][] = [];
      for (; i < lines.length && lines[i].trim().startsWith('|'); i++) {
        const cells = lines[i].trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells);
      }
      const [head, ...body] = rows;
      out.push(
        <table key={out.length} className="bot-table">
          <thead>
            <tr>{head.map((c, j) => <th key={j}>{inline(c)}</th>)}</tr>
          </thead>
          <tbody>
            {body.map((r, k) => (
              <tr key={k}>{r.map((c, j) => <td key={j}>{inline(c)}</td>)}</tr>
            ))}
          </tbody>
        </table>,
      );
      continue;
    }
    if (/^[-*•]\s|^\d+[.)]\s/.test(line)) {
      const items: string[] = [];
      for (; i < lines.length && /^[-*•]\s|^\d+[.)]\s/.test(lines[i].trim()); i++) items.push(lines[i].trim().replace(/^([-*•]|\d+[.)])\s+/, ''));
      out.push(
        <ul key={out.length}>
          {items.map((x, k) => (
            <li key={k}>{inline(x)}</li>
          ))}
        </ul>,
      );
      continue;
    }
    if (line) out.push(/^#{1,4}\s/.test(line) ? <p key={out.length}><b>{inline(line.replace(/^#+\s*/, ''))}</b></p> : <p key={out.length}>{inline(line)}</p>);
    i++;
  }
  return <>{out}</>;
}

/** Nút robot ở góc màn hình + khung hỏi đáp về tiền. Lịch sử chat chỉ giữ khi đang mở. */
export function ChatBot() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="bot" aria-label={L.bot.open} onClick={() => setOpen(true)}>
        <RobotArt />
      </button>
      {open && <ChatSheet onClose={() => setOpen(false)} />}
    </>
  );
}

function ChatSheet({ onClose }: { onClose: () => void }) {
  const { data } = useStore();
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [partial, setPartial] = useState('');
  const [status, setStatus] = useState('');
  const [err, setErr] = useState('');
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [msgs, busy, err, partial]);

  async function send(q: string) {
    q = q.trim();
    if (!q || busy) return;
    const next: ChatMsg[] = [...msgs, { role: 'user', text: q }];
    setMsgs(next);
    setText('');
    setErr('');
    setBusy(true);
    setPartial('');
    setStatus(L.bot.thinking);
    try {
      const a = await askMoney(data, next, todayISO(), setPartial, setStatus);
      setMsgs([...next, { role: 'ai', text: a }]);
    } catch (e) {
      setErr(e instanceof AiError || e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setPartial('');
    }
  }

  return (
    <Sheet title={L.bot.title} info={L.bot.privacy} onClose={onClose}>
      <div className="bot-chat">
        {msgs.length === 0 && (
          <div className="bot-hello">
            <span className="bot-hello__art">
              <RobotArt size={56} />
            </span>
            <p>{L.bot.hello}</p>
            <div className="chips">
              {L.bot.suggestions.map((s) => (
                <button key={s} type="button" className="chip" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`bot-msg bot-msg--${m.role}`}>
            {m.role === 'ai' ? <MiniMarkdown text={m.text} /> : m.text}
          </div>
        ))}
        {busy &&
          (partial ? (
            <div className="bot-msg bot-msg--ai">
              <MiniMarkdown text={partial} />
            </div>
          ) : (
            <div className="bot-msg bot-msg--ai bot-msg--busy">{status}</div>
          ))}
        {err && <p className="hint neg">{err}</p>}
        <div ref={end} />
      </div>
      <form
        className="bot-input"
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={L.bot.placeholder} aria-label={L.bot.placeholder} />
        <button className="btn btn--primary btn--sm" type="submit" disabled={!text.trim() || busy}>
          {L.bot.send}
        </button>
      </form>
    </Sheet>
  );
}
