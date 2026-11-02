/**
 * Sao lưu lên Google Drive của tài khoản đăng nhập, trong thư mục ẩn appDataFolder
 * (app chỉ thấy file của chính nó, không đọc được file khác của người dùng).
 */
import type { AppData } from '../domain/types';
import { L } from '../labels';
import { t } from '../i18n';

export const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

const SCOPES = 'openid email https://www.googleapis.com/auth/drive.appdata';
const FILE_NAME = 'vi-cua-nang-backup.json';
const API = 'https://www.googleapis.com';

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  /** Các quyền thực sự được cấp (người dùng có thể bỏ tick một số quyền). */
  scope?: string;
  error?: string;
  error_description?: string;
}

interface TokenClient {
  callback: (r: TokenResponse) => void;
  error_callback?: (e: { type: string; message?: string }) => void;
  requestAccessToken: (o?: { prompt?: string; login_hint?: string }) => void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (cfg: {
            client_id: string;
            scope: string;
            callback: (r: TokenResponse) => void;
            error_callback?: (e: { type: string; message?: string }) => void;
          }) => TokenClient;
          revoke: (token: string, done?: () => void) => void;
        };
        /** Nút "Đăng nhập bằng Google" chính chủ: trả về ID token (dùng cho Sổ chung / Firebase). */
        id: {
          initialize: (cfg: { client_id: string; callback: (r: { credential: string }) => void; auto_select?: boolean; use_fedcm_for_button?: boolean }) => void;
          renderButton: (el: HTMLElement, opts: Record<string, string | number>) => void;
        };
      };
    };
  }
}

let gisLoading: Promise<void> | null = null;
export function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  gisLoading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      gisLoading = null;
      reject(new Error(L.errors.googleScriptFailed));
    };
    document.head.appendChild(s);
  });
  return gisLoading;
}

export interface Token {
  value: string;
  expiresAt: number;
}

/** Mở cửa sổ đăng nhập Google; phải gọi từ thao tác bấm của người dùng. */
export async function signIn(loginHint?: string): Promise<Token> {
  if (!CLIENT_ID) throw new Error(L.errors.driveNoConfig);
  await loadGis();
  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (r) => {
        if (r.error || !r.access_token) return reject(new Error(r.error_description || r.error || L.errors.signInFailed));
        resolve({ value: r.access_token, expiresAt: Date.now() + ((r.expires_in ?? 3600) - 60) * 1000 });
      },
      error_callback: (e) => reject(new Error(e.type === 'popup_closed' ? L.errors.popupClosed : e.message || e.type)),
    });
    client.requestAccessToken(loginHint ? { prompt: '', login_hint: loginHint } : { prompt: 'select_account' });
  });
}

export function signOut(token: string) {
  window.google?.accounts.oauth2.revoke(token);
}

async function call(token: Token, url: string, init: RequestInit = {}) {
  const res = await fetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token.value}` } });
  if (res.status === 401) throw new AuthExpired();
  if (!res.ok) throw new Error(t(L.errors.driveStatus, { status: res.status, message: await res.text() }));
  return res;
}

export class AuthExpired extends Error {
  constructor() {
    super(L.errors.googleSessionExpired);
  }
}

export async function getEmail(token: Token): Promise<string> {
  const r = await call(token, `${API}/oauth2/v3/userinfo`);
  return (await r.json()).email;
}

export interface RemoteFile {
  id: string;
  modifiedTime: string;
}

export async function findBackup(token: Token): Promise<RemoteFile | null> {
  const q = encodeURIComponent(`name='${FILE_NAME}' and trashed=false`);
  const r = await call(token, `${API}/drive/v3/files?spaces=appDataFolder&q=${q}&fields=files(id,modifiedTime)&orderBy=modifiedTime desc`);
  return (await r.json()).files?.[0] ?? null;
}

export async function download(token: Token, id: string): Promise<unknown> {
  const r = await call(token, `${API}/drive/v3/files/${id}?alt=media`);
  return r.json();
}

/** Ghi đè file sao lưu (tạo mới nếu chưa có). Trả về id file. */
export async function upload(token: Token, data: AppData, id?: string): Promise<string> {
  const body = JSON.stringify(data);
  if (id) {
    await call(token, `${API}/upload/drive/v3/files/${id}?uploadType=media`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    return id;
  }
  const boundary = 'vcn' + Math.random().toString(36).slice(2);
  const meta = JSON.stringify({ name: FILE_NAME, parents: ['appDataFolder'], mimeType: 'application/json' });
  const multipart =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${boundary}--`;
  const r = await call(token, `${API}/upload/drive/v3/files?uploadType=multipart&fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body: multipart,
  });
  return (await r.json()).id;
}
