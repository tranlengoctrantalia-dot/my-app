import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AppData } from '../domain/types';
import { isAppData, useStore } from '../store';
import { L } from '../labels';
import { t } from '../i18n';
import { AuthExpired, CLIENT_ID, download, findBackup, getEmail, signIn, signOut, upload, type Token } from './googleDrive';

const KEY = 'vi-cua-nang/drive';

interface Session {
  email: string;
  fileId?: string;
  lastSync?: number;
}

export type SyncStatus = 'off' | 'syncing' | 'ok' | 'need-login' | 'error';

interface DriveSyncValue {
  enabled: boolean;
  session: Session | null;
  status: SyncStatus;
  message?: string;
  connect: () => Promise<void>;
  reconnect: () => Promise<void>;
  syncNow: () => Promise<void>;
  disconnect: () => void;
}

const Ctx = createContext<DriveSyncValue | null>(null);

function loadSession(): Session | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch {
    return null;
  }
}

function saveSession(s: Session | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    /* bỏ qua */
  }
}

const fmtTime = (ms?: number) => (ms ? new Date(ms).toLocaleString('vi-VN') : L.drive.unknownTime);

export function DriveSyncProvider({ children }: { children: ReactNode }) {
  const { data, dispatch } = useStore();
  const [session, setSessionState] = useState<Session | null>(loadSession);
  const [status, setStatus] = useState<SyncStatus>(session ? 'need-login' : 'off');
  const [message, setMessage] = useState<string>();
  const token = useRef<Token | null>(null);
  const dataRef = useRef(data);
  dataRef.current = data;
  const lastPushed = useRef<string>('');
  const sessionRef = useRef(session);

  const setSession = useCallback((s: Session | null) => {
    sessionRef.current = s;
    setSessionState(s);
    saveSession(s);
  }, []);

  const fail = useCallback((e: unknown) => {
    if (e instanceof AuthExpired) {
      token.current = null;
      setStatus('need-login');
      setMessage(L.drive.sessionExpired);
    } else {
      setStatus('error');
      setMessage(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const tokenValid = () => !!token.current && token.current.expiresAt > Date.now();

  const push = useCallback(async () => {
    const s = sessionRef.current;
    if (!s || !tokenValid()) return;
    const json = JSON.stringify(dataRef.current);
    if (json === lastPushed.current) return;
    setStatus('syncing');
    const fileId = await upload(token.current!, dataRef.current, s.fileId);
    lastPushed.current = json;
    setSession({ ...s, fileId, lastSync: Date.now() });
    setStatus('ok');
    setMessage(undefined);
  }, [setSession]);

  /** Sau khi đăng nhập: so bản trên Drive với bản trên máy, lấy bản mới hơn. */
  const reconcile = useCallback(
    async (email: string) => {
      setStatus('syncing');
      const tk = token.current!;
      const remote = await findBackup(tk);
      const base: Session = { email, fileId: remote?.id, lastSync: sessionRef.current?.lastSync };
      setSession(base);
      if (remote) {
        const remoteData = await download(tk, remote.id);
        if (isAppData(remoteData)) {
          const local = dataRef.current;
          const remoteNewer = (remoteData.updatedAt ?? 0) > (local.updatedAt ?? 0);
          // Drive có nhiều giao dịch hơn máy này (vd. vừa xoá sạch máy / máy mới): phải hỏi, không tự ghi đè.
          const remoteBigger = remoteData.transactions.length > local.transactions.length;
          if (remoteNewer || remoteBigger) {
            const n = remoteData.transactions.length;
            const m = local.transactions.length;
            const ask = remoteBigger
              ? t(L.drive.remoteHasMore, { n, m, remote: fmtTime(remoteData.updatedAt) })
              : t(L.drive.newerConfirm, { remote: fmtTime(remoteData.updatedAt), local: fmtTime(local.updatedAt) });
            if (confirm(ask)) {
              lastPushed.current = JSON.stringify(remoteData);
              dispatch({ type: 'replace', data: remoteData as AppData });
              setSession({ ...base, lastSync: Date.now() });
              setStatus('ok');
              setMessage(undefined);
              return;
            }
            // Không tải về: chỉ ghi đè bản trên Drive khi người dùng đồng ý rõ ràng.
            if (!confirm(t(L.drive.overwriteConfirm, { n }))) {
              token.current = null;
              setSession(null);
              setStatus('off');
              setMessage(L.drive.keptRemote);
              return;
            }
          }
        }
      }
      lastPushed.current = '';
      await push();
    },
    [dispatch, push, setSession],
  );

  const connect = useCallback(async () => {
    try {
      setMessage(undefined);
      token.current = await signIn();
      const email = await getEmail(token.current);
      await reconcile(email);
    } catch (e) {
      fail(e);
    }
  }, [fail, reconcile]);

  const reconnect = useCallback(async () => {
    try {
      setMessage(undefined);
      token.current = await signIn(sessionRef.current?.email);
      const email = await getEmail(token.current);
      await reconcile(email);
    } catch (e) {
      fail(e);
    }
  }, [fail, reconcile]);

  const syncNow = useCallback(async () => {
    if (!tokenValid()) return reconnect();
    try {
      lastPushed.current = '';
      await push();
    } catch (e) {
      fail(e);
    }
  }, [fail, push, reconnect]);

  const disconnect = useCallback(() => {
    if (token.current) signOut(token.current.value);
    token.current = null;
    lastPushed.current = '';
    setSession(null);
    setStatus('off');
    setMessage(undefined);
  }, [setSession]);

  // Tự sao lưu 2 giây sau mỗi lần sửa dữ liệu.
  useEffect(() => {
    if (!session) return;
    if (!tokenValid()) {
      if (status === 'ok') {
        setStatus('need-login');
        setMessage(L.drive.sessionExpired);
      }
      return;
    }
    const id = setTimeout(() => push().catch(fail), 2000);
    return () => clearTimeout(id);
  }, [data]);

  const value = useMemo<DriveSyncValue>(
    () => ({ enabled: !!CLIENT_ID, session, status, message, connect, reconnect, syncNow, disconnect }),
    [session, status, message, connect, reconnect, syncNow, disconnect],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDriveSync() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useDriveSync phải nằm trong DriveSyncProvider');
  return v;
}
