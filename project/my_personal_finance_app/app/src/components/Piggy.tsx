/** Heo đất của app: vui khi dư, buồn khi thiếu. */
export function Piggy({ mood, size = 72 }: { mood: 'happy' | 'sad'; size?: number }) {
  const happy = mood === 'happy';
  return (
    <svg className="piggy" width={size} height={size * 0.9} viewBox="0 0 120 108" aria-hidden>
      <defs>
        <radialGradient id="piggy-body" cx="38%" cy="28%" r="80%">
          <stop offset="0" stopColor="#ffd3e1" />
          <stop offset="0.55" stopColor="#ff9dbb" />
          <stop offset="1" stopColor="#e4688f" />
        </radialGradient>
        <radialGradient id="piggy-coin" cx="35%" cy="30%" r="80%">
          <stop offset="0" stopColor="#fff0a8" />
          <stop offset="1" stopColor="#f2b022" />
        </radialGradient>
      </defs>
      {happy && (
        <g>
          <circle cx="56" cy="13" r="11" fill="url(#piggy-coin)" />
          <circle cx="56" cy="13" r="6.5" fill="none" stroke="#d99713" strokeWidth="1.6" />
        </g>
      )}
      <path d="M12 58c-9 1-10-8-5-10" fill="none" stroke="#e4688f" strokeWidth="4" strokeLinecap="round" />
      <rect x="29" y="82" width="15" height="19" rx="7" fill="#e4688f" />
      <rect x="70" y="82" width="15" height="19" rx="7" fill="#e4688f" />
      <ellipse cx="56" cy="60" rx="45" ry="36" fill="url(#piggy-body)" />
      <path d="M72 30l7-15c6 5 8 12 7 21z" fill="#f584a8" />
      <rect x="44" y="26" width="23" height="4.5" rx="2.2" fill="#b94670" />
      <ellipse cx="97" cy="62" rx="15" ry="13" fill="#ffb7cd" stroke="#e4688f" strokeWidth="2" />
      <ellipse cx="92" cy="61" rx="2.2" ry="3.4" fill="#b94670" />
      <ellipse cx="102" cy="61" rx="2.2" ry="3.4" fill="#b94670" />
      <circle cx="74" cy="48" r="4.6" fill="#40222f" />
      <circle cx="75.8" cy="46.2" r="1.5" fill="#fff" />
      {happy ? (
        <path d="M68 76q8 8 17 2" fill="none" stroke="#b94670" strokeWidth="3" strokeLinecap="round" />
      ) : (
        <>
          <path d="M67 41l11-3" stroke="#40222f" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M69 81q8-7 16-1" fill="none" stroke="#b94670" strokeWidth="3" strokeLinecap="round" />
          <path d="M68 56c-3 5-4 7-1 9s6-1 5-4c-.5-2-2-3-4-5z" fill="#7cc9f5" />
        </>
      )}
    </svg>
  );
}
