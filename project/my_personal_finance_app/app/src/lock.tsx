/**
 * Khoá app bằng mã PIN, thêm vân tay / Face ID (WebAuthn, xác thực ngay trên máy) nếu máy hỗ trợ.
 * Chỉ lưu trên máy này: mã PIN lưu dạng băm (SHA-256 + muối), không bao giờ lưu số gốc.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Icon } from './components/icons';
import { L } from './labels';

const KEY = 'vi-cua-nang/lock';
/** Quay lại app sau bấy nhiêu ms thì khoá lại. */
const RELOCK_MS = 60_000;

interface LockConfig {
  salt: string;
  pinHash: string;
  /** Số chữ số của mã PIN (để biết lúc nào báo sai). */
  len: number;
  /** Id khoá vân tay / Face ID (base64). */
  credId?: string;
}

export function getLock(): LockConfig | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as LockConfig) : null;
  } catch {
    return null;
  }
}

function saveLock(c: LockConfig | null) {
  try {
    if (c) localStorage.setItem(KEY, JSON.stringify(c));
    else localStorage.removeItem(KEY);
  } catch {
    /* bỏ qua */
  }
  window.dispatchEvent(new Event('vg-lock-change'));
}

const b64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf instanceof Uint8Array ? buf : new Uint8Array(buf))));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const random = (n: number) => crypto.getRandomValues(new Uint8Array(n));

async function hashPin(pin: string, salt: string) {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  return b64(await crypto.subtle.digest('SHA-256', data));
}

export async function setPin(pin: string) {
  const salt = b64(random(16));
  saveLock({ ...getLock(), salt, pinHash: await hashPin(pin, salt), len: pin.length });
}

export async function checkPin(pin: string) {
  const c = getLock();
  return !!c && (await hashPin(pin, c.salt)) === c.pinHash;
}

export const disableLock = () => saveLock(null);

export async function bioAvailable() {
  try {
    return !!window.PublicKeyCredential && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch {
    return false;
  }
}

/** Tạo khoá vân tay / Face ID cho app trên máy này. */
export async function enableBio(): Promise<boolean> {
  const c = getLock();
  if (!c) return false;
  try {
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge: random(32),
        rp: { name: L.lock.bioUser },
        user: { id: random(16), name: L.lock.bioUser, displayName: L.lock.bioUser },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
        timeout: 60_000,
      },
    })) as PublicKeyCredential | null;
    if (!cred) return false;
    saveLock({ ...c, credId: b64(cred.rawId) });
    return true;
  } catch {
    return false;
  }
}

export function disableBio() {
  const c = getLock();
  if (c) saveLock({ ...c, credId: undefined });
}

async function verifyBio(): Promise<boolean> {
  const id = getLock()?.credId;
  if (!id) return false;
  try {
    const ok = await navigator.credentials.get({
      publicKey: {
        challenge: random(32),
        allowCredentials: [{ type: 'public-key', id: unb64(id), transports: ['internal'] }],
        userVerification: 'required',
        timeout: 60_000,
      },
    });
    return !!ok;
  } catch {
    return false;
  }
}

/** Theo dõi khoá app đang bật hay tắt (Cài đặt dùng). */
export function useLockConfig() {
  const [c, setC] = useState(getLock);
  useEffect(() => {
    const on = () => setC(getLock());
    window.addEventListener('vg-lock-change', on);
    return () => window.removeEventListener('vg-lock-change', on);
  }, []);
  return c;
}

/** Bọc ngoài app: đang khoá thì chỉ hiện màn mở khoá. */
export function LockGate({ children }: { children: ReactNode }) {
  const [locked, setLocked] = useState(() => !!getLock());
  useEffect(() => {
    let hiddenAt = 0;
    const onVis = () => {
      if (document.visibilityState === 'hidden') hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > RELOCK_MS && getLock()) setLocked(true);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);
  // Khoá đè lên trên (không gỡ app ra) để mở khoá xong vẫn đúng chỗ đang làm dở.
  return (
    <>
      <div aria-hidden={locked || undefined} style={locked ? { visibility: 'hidden' } : undefined}>
        {children}
      </div>
      {locked && <LockScreen onUnlock={() => setLocked(false)} />}
    </>
  );
}

function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPinText] = useState('');
  const [wrong, setWrong] = useState(false);
  const hasBio = !!getLock()?.credId;
  const len = getLock()?.len ?? 6;

  const tryBio = async () => {
    if (await verifyBio()) onUnlock();
  };
  useEffect(() => {
    if (hasBio) void tryBio();
  }, []);

  async function press(d: string) {
    const next = (pin + d).slice(0, len);
    setPinText(next);
    setWrong(false);
    if (next.length < len) return;
    if (await checkPin(next)) return onUnlock();
    {
      setWrong(true);
      setPinText('');
    }
  }

  function forgot() {
    if (!confirm(L.lock.forgotConfirm)) return;
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith('vi-cua-nang/'))
        .forEach((k) => localStorage.removeItem(k));
    } catch {
      /* bỏ qua */
    }
    location.reload();
  }

  return (
    <div className="lock">
      <img src="/icon.svg" alt="" width={56} height={56} />
      <h1>{L.lock.title}</h1>
      <p className={wrong ? 'neg' : 'muted'}>{wrong ? L.lock.wrongPin : L.lock.enterPin}</p>
      <div className="lock__dots" aria-hidden>
        {Array.from({ length: len }, (_, i) => (
          <span key={i} className={i < pin.length ? 'on' : ''} />
        ))}
      </div>
      <div className="lock__pad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} onClick={() => press(d)}>
            {d}
          </button>
        ))}
        {hasBio ? (
          <button aria-label={L.lock.useBio} onClick={tryBio}>
            <Icon name="fingerprint" size={28} />
          </button>
        ) : (
          <span />
        )}
        <button onClick={() => press('0')}>0</button>
        <button aria-label="Xoá" onClick={() => setPinText((p) => p.slice(0, -1))}>
          <Icon name="backspace" size={24} />
        </button>
      </div>
      <button className="link" onClick={forgot}>
        {L.lock.forgot}
      </button>
    </div>
  );
}
