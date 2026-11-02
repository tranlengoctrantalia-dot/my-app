/** Cấu hình Firebase (sổ chung). Tách riêng để màn hình chính biết có bật hay không mà không phải tải Firebase. */
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

export const sharedEnabled = !!(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);

const JOIN_KEY = 'vi-cua-nang/join';

/** Link mời có dạng ?join=<mã sổ>: nhớ lại để sau khi đăng nhập / cài đặt xong thì tham gia. */
export function captureJoinLink(): string | null {
  try {
    const url = new URL(location.href);
    const id = url.searchParams.get('join');
    if (id) {
      sessionStorage.setItem(JOIN_KEY, id);
      url.searchParams.delete('join');
      history.replaceState(null, '', url.pathname + url.search + url.hash);
    }
    return sessionStorage.getItem(JOIN_KEY);
  } catch {
    return null;
  }
}

export function clearJoinLink() {
  try {
    sessionStorage.removeItem(JOIN_KEY);
  } catch {
    /* bỏ qua */
  }
}

export const inviteLink = (ledgerId: string) => `${location.origin}/?join=${ledgerId}`;
