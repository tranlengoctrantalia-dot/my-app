import { accents, avatars, useLook } from '../theme';
import { Face } from './Avatar';
import { Icon } from './icons';
import { L } from '../labels';

/** Chọn màu chủ đạo + hình đại diện. Đổi là thấy ngay. */
export function LookPicker() {
  const look = useLook();
  return (
    <div className="form">
      <div className="field">
        <span>{L.look.accentLabel}</span>
        <div className="swatches">
          {accents.map((a) => (
            <button
              key={a.id}
              type="button"
              className="swatch"
              style={{ background: a.color }}
              aria-label={a.name}
              aria-pressed={look.accent === a.id}
              onClick={() => look.setAccent(a.id)}
            >
              {look.accent === a.id && <Icon name="check" size={20} />}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <span>{L.look.avatarLabel}</span>
        <div className="avatar-picks">
          {avatars.map((a) => (
            <button key={a.id} type="button" className="avatar-pick" aria-pressed={look.avatar === a.id} onClick={() => look.setAvatar(a.id)}>
              <Face kind={a.id} className="avatar-pick__face" />
              <small>{a.name}</small>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
