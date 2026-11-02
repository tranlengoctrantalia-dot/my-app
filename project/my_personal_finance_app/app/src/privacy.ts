/** Ẩn số tiền (chạm con mắt ở góc trên): nhớ trên máy này, bật thì mọi số tiền hiện •••••đ. */
import { useSyncExternalStore } from 'react';
import { setMoneyMask } from './domain/format';

const KEY = 'vi-cua-nang/hide-money';
const listeners = new Set<() => void>();

let hidden = (() => {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
})();
setMoneyMask(hidden);

export function toggleHidden() {
  hidden = !hidden;
  setMoneyMask(hidden);
  try {
    localStorage.setItem(KEY, hidden ? '1' : '0');
  } catch {
    /* bỏ qua */
  }
  listeners.forEach((f) => f());
}

/** Dùng ở gốc app để cả cây vẽ lại khi bật / tắt. */
export const useHidden = () =>
  useSyncExternalStore(
    (f) => {
      listeners.add(f);
      return () => listeners.delete(f);
    },
    () => hidden,
  );
