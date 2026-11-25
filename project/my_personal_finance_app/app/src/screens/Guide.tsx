import { Art, Icon, type IconName } from '../components/icons';
import { sharedEnabled } from '../shared/config';
import { resetTours } from '../components/Tour';
import { L } from '../labels';
import { Rich } from '../i18n';
import { NewsCard } from '../components/WhatsNew';

const G = L.guide;

/** Hướng dẫn sử dụng — mỗi mục một câu hỏi, chạm để mở. */
const items: { icon: IconName; q: string; a: string; vars?: Record<string, string>; show?: boolean }[] = [
  { icon: 'plus', ...G.addExpense },
  { icon: 'money', ...G.income },
  { icon: 'undo', ...G.refund },
  { icon: 'edit', ...G.edit },
  { icon: 'heart', ...G.split },
  { icon: 'handshake', ...G.loan },
  { icon: 'flag', ...G.goals },
  { icon: 'users', ...G.shared, show: sharedEnabled },
  { icon: 'wallet', ...G.wallet },
  { icon: 'calendar', ...G.recurring },
  { icon: 'target', ...G.budget },
  { icon: 'pie_chart', ...G.report },
  { icon: 'card', ...G.card },
  { icon: 'fact_check', ...G.reconcile },
  { icon: 'calendar_month', ...G.extras },
  { icon: 'scan', ...G.scan },
  { icon: 'upload_file', ...G.migrate },
  { icon: 'notifications', ...G.remind },
  { icon: 'lock', ...G.lock },
  { icon: 'cloud', ...G.backup },
  { icon: 'phone', ...G.install },
  { icon: 'palette', ...G.look },
  { icon: 'care', q: G.privacy.q, a: G.privacy.a, vars: { sharedNote: sharedEnabled ? G.privacy.sharedNote : '' } },
];

/**
 * Hiện câu trả lời trong labels: dòng trống = đoạn mới, dòng "1. " = danh sách số,
 * dòng "- " = gạch đầu dòng, **chữ** = in đậm.
 */
function GuideText({ text, vars }: { text: string; vars?: Record<string, string> }) {
  return (
    <>
      {text.split(/\n\s*\n/).map((block, i) => {
        const lines = block.split('\n').filter((l) => l.trim());
        if (lines.every((l) => /^\d+\.\s/.test(l))) {
          return (
            <ol key={i}>
              {lines.map((l, j) => (
                <li key={j}>
                  <Rich text={l.replace(/^\d+\.\s+/, '')} vars={vars} />
                </li>
              ))}
            </ol>
          );
        }
        if (lines.every((l) => /^-\s/.test(l))) {
          return (
            <ul key={i}>
              {lines.map((l, j) => (
                <li key={j}>
                  <Rich text={l.replace(/^-\s+/, '')} vars={vars} />
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i}>
            <Rich text={lines.join(' ')} vars={vars} />
          </p>
        );
      })}
    </>
  );
}

export function Guide() {
  return (
    <div className="guide">
      <button className="tip" onClick={resetTours}>
        <Icon name="star" size={22} />
        <span>
          <Rich text={G.replayTour} />
        </span>
        <Icon name="right" size={18} />
      </button>
      <NewsCard />
      {items
        .filter((i) => i.show !== false)
        .map((i) => (
          <details key={i.q} className="guide__item">
            <summary>
              <span className="mini-icon">
                <Art name={i.icon} size={24} />
              </span>
              <b>{i.q}</b>
              <Icon name="right" size={18} className="guide__chev" />
            </summary>
            <div className="guide__body">
              <GuideText text={i.a} vars={i.vars} />
            </div>
          </details>
        ))}
    </div>
  );
}
