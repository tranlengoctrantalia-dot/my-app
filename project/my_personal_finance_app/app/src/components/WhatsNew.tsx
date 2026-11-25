import { L } from '../labels';
import { Icon } from './icons';
import { Tour } from './Tour';

const N = L.news;

/**
 * Chỉ một nút mới: lần đầu nút đó hiện trên màn hình thì làm tối xung quanh, khoanh sáng nút + 1 câu.
 * Mỗi nút chỉ 1 lần; "Xem lại hướng dẫn nhanh" thì chỉ lại.
 */
export function NewTip({ id, target }: { id: keyof typeof N.tips; target: string }) {
  return <Tour id={`new-${id}`} steps={[{ target, ...N.tips[id] }]} delay={600} />;
}

const dmy = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

/** Thẻ "Có gì mới" trong Hướng dẫn: chỉ tên tính năng, gập sẵn. */
export function NewsCard() {
  return (
    <details className="guide__item">
      <summary>
        <span className="mini-icon">
          <Icon name="star" size={22} />
        </span>
        <b>{N.title}</b>
        <Icon name="right" size={18} className="guide__chev" />
      </summary>
      <div className="guide__body">
        {N.releases.map((r) => (
          <section key={r.date} className="news__release">
            <small className="news__date">{dmy(r.date)}</small>
            <ul className="news__list">
              {r.items.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </details>
  );
}
