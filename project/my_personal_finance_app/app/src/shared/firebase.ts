/**
 * Sổ chung lưu trên Firestore (gói miễn phí). Mỗi sổ chỉ thành viên đọc/ghi được — xem firestore.rules.
 * Ví riêng KHÔNG đi qua đây: vẫn chỉ nằm trên máy + Google Drive của từng người.
 */
import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithCredential,
  signInWithPopup,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth';
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  initializeFirestore,
  onSnapshot,
  orderBy,
  persistentLocalCache,
  persistentMultipleTabManager,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { CLIENT_ID, loadGis } from '../sync/googleDrive';
import type { Ledger, Member, SharedEntry } from './balance';
import { firebaseConfig } from './config';
import { L } from '../labels';

const app = initializeApp(firebaseConfig as Required<typeof firebaseConfig>);
const auth = getAuth(app);
// Lưu tạm trên máy: mở app khi mất mạng vẫn xem được, ghi thì tự gửi khi có mạng lại.
const db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });

export type { User };

export const watchUser = (cb: (u: User | null) => void) => onAuthStateChanged(auth, cb);

/** Lấy access token Google bằng cửa sổ đăng nhập quen thuộc (giống phần sao lưu Drive). */
function googleToken(): Promise<string> {
  return loadGis().then(
    () =>
      new Promise((resolve, reject) => {
        const client = window.google!.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID!,
          scope: 'openid email profile',
          callback: (r) => (r.access_token ? resolve(r.access_token) : reject(new Error(r.error_description || r.error || L.errors.signInFailed))),
          error_callback: (e) => reject(new Error(e.type === 'popup_closed' ? L.errors.popupClosed : e.message || e.type)),
        });
        client.requestAccessToken({ prompt: 'select_account' });
      }),
  );
}

const authError = (e: unknown) => {
  const code = (e as { code?: string }).code ?? '';
  if (code === 'auth/operation-not-allowed') return new Error(L.errors.firebaseGoogleOff);
  if (code === 'auth/invalid-credential') return new Error(L.errors.firebaseWrongProject);
  return e instanceof Error ? e : new Error(String(e));
};

/**
 * Vẽ nút "Đăng nhập bằng Google" của Google vào `el`. Nút trả về ID token của Client ID đăng nhập
 * (dự án Google Cloud có thể khác dự án Firebase — Firebase nhận được nhờ "Allowlist client IDs from external projects").
 */
export async function renderSignInButton(el: HTMLElement, onError: (e: Error) => void) {
  await loadGis();
  window.google!.accounts.id.initialize({
    client_id: CLIENT_ID!,
    use_fedcm_for_button: true,
    callback: async (r) => {
      try {
        await signInWithCredential(auth, GoogleAuthProvider.credential(r.credential));
      } catch (e) {
        onError(authError(e));
      }
    },
  });
  window.google!.accounts.id.renderButton(el, { theme: 'filled_black', size: 'large', shape: 'pill', text: 'signin_with', locale: 'vi', width: 260 });
}

export const hasClientId = !!CLIENT_ID;

export async function signIn(): Promise<User> {
  try {
    if (CLIENT_ID) {
      const token = await googleToken();
      return (await signInWithCredential(auth, GoogleAuthProvider.credential(null, token))).user;
    }
    return (await signInWithPopup(auth, new GoogleAuthProvider())).user;
  } catch (e) {
    throw authError(e);
  }
}

export const signOut = () => fbSignOut(auth);

export const memberOf = (u: User): Member => ({
  name: u.displayName || u.email?.split('@')[0] || L.errors.firebaseNoName,
  email: u.email ?? '',
  ...(u.photoURL ? { photo: u.photoURL } : {}),
});

const ledgers = collection(db, 'ledgers');
const entries = (ledgerId: string) => collection(db, 'ledgers', ledgerId, 'entries');

export function watchLedgers(uid: string, cb: (l: Ledger[]) => void, onError: (e: Error) => void) {
  return onSnapshot(
    query(ledgers, where('members', 'array-contains', uid)),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Ledger, 'id'>) })).sort((a, b) => a.name.localeCompare(b.name))),
    onError,
  );
}

export async function createLedger(name: string, u: User): Promise<string> {
  const ref = await addDoc(ledgers, { name, members: [u.uid], people: { [u.uid]: memberOf(u) }, createdBy: u.uid, createdAt: Date.now() });
  return ref.id;
}

export async function joinLedger(id: string, u: User) {
  try {
    await updateDoc(doc(ledgers, id), { members: arrayUnion(u.uid), [`people.${u.uid}`]: memberOf(u) });
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === 'not-found' || code === 'permission-denied') throw new Error(L.errors.inviteInvalid);
    throw e;
  }
}

export const renameLedger = (id: string, name: string) => updateDoc(doc(ledgers, id), { name });
export const leaveLedger = (id: string, uid: string) => updateDoc(doc(ledgers, id), { members: arrayRemove(uid) });

export function watchEntries(ledgerId: string, cb: (e: SharedEntry[]) => void, onError: (e: Error) => void) {
  return onSnapshot(
    query(entries(ledgerId), orderBy('date', 'desc')),
    (snap) =>
      cb(
        snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<SharedEntry, 'id'>) }))
          .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt),
      ),
    onError,
  );
}

// Ghi không cần chờ máy chủ trả lời (khi mất mạng Firestore tự gửi sau), nên không await.
export function addEntry(ledgerId: string, e: Omit<SharedEntry, 'id'>) {
  const ref = doc(entries(ledgerId));
  setDoc(ref, e).catch(console.error);
  return ref.id;
}

export const updateEntry = (ledgerId: string, id: string, e: Partial<SharedEntry>) =>
  void updateDoc(doc(entries(ledgerId), id), e).catch(console.error);
export const deleteEntry = (ledgerId: string, id: string) => void deleteDoc(doc(entries(ledgerId), id)).catch(console.error);
