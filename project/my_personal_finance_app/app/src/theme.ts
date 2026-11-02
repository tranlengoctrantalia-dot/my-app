import { useEffect, useState } from 'react';
import { L } from './labels';

const KEY = 'vi-cua-nang/theme';
const ACCENT_KEY = 'vi-cua-nang/accent';
const AVATAR_KEY = 'vi-cua-nang/avatar';
export type Theme = 'dark' | 'light';

/** Màu chủ đạo — mỗi người tự chọn, lưu trên máy. Giá trị màu nằm trong styles.css. */
export const accents = [
  { id: 'rose', name: L.look.accents.rose, color: '#be3a5a' },
  { id: 'ocean', name: L.look.accents.ocean, color: '#1f6fd1' },
  { id: 'forest', name: L.look.accents.forest, color: '#2e8b57' },
  { id: 'violet', name: L.look.accents.violet, color: '#7b4fd6' },
  { id: 'amber', name: L.look.accents.amber, color: '#d0711f' },
  { id: 'slate', name: L.look.accents.slate, color: '#55707f' },
] as const;
export type Accent = (typeof accents)[number]['id'];

export const avatars = [
  { id: 'girl', name: L.look.avatars.girl },
  { id: 'boy', name: L.look.avatars.boy },
  { id: 'person', name: L.look.avatars.person },
] as const;
export type AvatarKind = (typeof avatars)[number]['id'];

function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* bỏ qua */
  }
}

const themeColor = () => (document.documentElement.dataset.theme === 'light' ? '#fafafa' : '#212121');

export function applyStoredTheme() {
  if (read(KEY) === 'light') document.documentElement.dataset.theme = 'light';
  const accent = read(ACCENT_KEY);
  if (accent && accent !== 'rose') document.documentElement.dataset.accent = accent;
}

export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    if (next === 'light') document.documentElement.dataset.theme = 'light';
    else delete document.documentElement.dataset.theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor());
    write(KEY, next);
  }
  return [theme, toggle];
}

export const getAccent = (): Accent => (document.documentElement.dataset.accent as Accent) ?? 'rose';

export function setAccent(a: Accent) {
  if (a === 'rose') delete document.documentElement.dataset.accent;
  else document.documentElement.dataset.accent = a;
  write(ACCENT_KEY, a);
}

const listeners = new Set<() => void>();

export const getAvatar = (): AvatarKind => {
  const v = read(AVATAR_KEY);
  return avatars.some((a) => a.id === v) ? (v as AvatarKind) : 'girl';
};

export function setAvatar(a: AvatarKind) {
  write(AVATAR_KEY, a);
  listeners.forEach((f) => f());
}

/** Màu + hình đại diện hiện tại; tự cập nhật khi đổi ở chỗ khác. */
export function useLook() {
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((n) => n + 1);
    listeners.add(f);
    return () => void listeners.delete(f);
  }, []);
  return {
    accent: getAccent(),
    avatar: getAvatar(),
    setAccent: (a: Accent) => {
      setAccent(a);
      listeners.forEach((f) => f());
    },
    setAvatar,
  };
}
