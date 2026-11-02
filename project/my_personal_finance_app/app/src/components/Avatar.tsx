import { useLook, type AvatarKind } from '../theme';

/** Hình đại diện với các vòng sóng lan toả (lấy cảm hứng từ app "Here I Am"). Nền theo màu chủ đạo. */
export function RippleAvatar({ size = 132, kind }: { size?: number; kind?: AvatarKind }) {
  const look = useLook();
  return (
    <div className="ripple" style={{ width: size, height: size }} aria-hidden>
      <span className="ripple__ring ripple__ring--3" />
      <span className="ripple__ring ripple__ring--2" />
      <span className="ripple__ring ripple__ring--1" />
      <Face kind={kind ?? look.avatar} />
    </div>
  );
}

export function Face({ kind, className = 'ripple__girl' }: { kind: AvatarKind; className?: string }) {
  const id = `face-clip-${kind}`;
  return (
    <svg className={className} viewBox="0 0 120 120">
      <defs>
        <clipPath id={id}>
          <circle cx="60" cy="60" r="60" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id})`}>
        <circle cx="60" cy="60" r="60" fill="var(--accent)" />
        {kind === 'girl' && (
          <>
            {/* tóc phía sau */}
            <path d="M30 64c0-26 13-42 30-42s30 16 30 42v26H30z" fill="#45465a" />
            <rect x="52" y="76" width="16" height="16" rx="4" fill="#f3c9a5" />
            <path d="M20 122c0-20 17-32 40-32s40 12 40 32z" fill="#ffa65c" />
            <path d="M50 90l10 11 10-11z" fill="#f3c9a5" />
            <ellipse cx="60" cy="58" rx="20" ry="23" fill="#ffe6d1" />
            {/* tóc mái */}
            <path d="M38 58c1-20 11-30 23-30 11 0 21 8 22 25-9-2-17-9-21-17-5 11-14 19-24 22z" fill="#45465a" />
          </>
        )}
        {kind === 'boy' && (
          <>
            <rect x="52" y="76" width="16" height="16" rx="4" fill="#f3c9a5" />
            <path d="M20 122c0-20 17-32 40-32s40 12 40 32z" fill="#4f7cac" />
            <path d="M50 90l10 11 10-11z" fill="#f3c9a5" />
            <ellipse cx="60" cy="58" rx="20" ry="23" fill="#ffe6d1" />
            {/* tóc ngắn */}
            <path d="M39 56c-2-19 9-31 22-31 14 0 24 10 21 30-3-7-8-11-14-13-8 4-19 6-29 14z" fill="#3a3b4a" />
          </>
        )}
        {kind === 'person' && (
          <>
            <circle cx="60" cy="50" r="19" fill="#ffffff" fillOpacity="0.9" />
            <path d="M22 122c0-22 17-38 38-38s38 16 38 38z" fill="#ffffff" fillOpacity="0.9" />
          </>
        )}
      </g>
    </svg>
  );
}
