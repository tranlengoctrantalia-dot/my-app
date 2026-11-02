/** Đọc email thông báo giao dịch từ Gmail (chỉ đọc, quyền gmail.readonly). */
import type { EmailInput } from '../ai/extract';
import { CLIENT_ID, loadGis } from './googleDrive';
import { L } from '../labels';
import { t as fill } from '../i18n';

const SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const API = 'https://gmail.googleapis.com/gmail/v1/users/me';

/** Ngân hàng / ví hay gửi email biến động số dư, biên lai, sao kê. */
export const BANKS: { id: string; name: string; domains: string[] }[] = [
  { id: 'vcb', name: 'Vietcombank', domains: ['vietcombank.com.vn'] },
  { id: 'tcb', name: 'Techcombank', domains: ['techcombank.com.vn'] },
  { id: 'mb', name: 'MB', domains: ['mbbank.com.vn'] },
  { id: 'vpb', name: 'VPBank', domains: ['vpbank.com.vn'] },
  { id: 'acb', name: 'ACB', domains: ['acb.com.vn'] },
  { id: 'tpb', name: 'TPBank', domains: ['tpb.vn', 'tpbank.com.vn'] },
  { id: 'bidv', name: 'BIDV', domains: ['bidv.com.vn'] },
  { id: 'ctg', name: 'VietinBank', domains: ['vietinbank.vn'] },
  { id: 'agr', name: 'Agribank', domains: ['agribank.com.vn'] },
  { id: 'stb', name: 'Sacombank', domains: ['sacombank.com'] },
  { id: 'shb', name: 'Shinhan', domains: ['shinhan.com', 'shinhan.com.vn'] },
  { id: 'hsbc', name: 'HSBC', domains: ['hsbc.com.vn'] },
  { id: 'vib', name: 'VIB', domains: ['vib.com.vn'] },
  { id: 'msb', name: 'MSB', domains: ['msb.com.vn'] },
  { id: 'ocb', name: 'OCB', domains: ['ocb.com.vn'] },
  { id: 'hdb', name: 'HDBank', domains: ['hdbank.com.vn'] },
  { id: 'seab', name: 'SeABank', domains: ['seabank.com.vn'] },
  { id: 'eib', name: 'Eximbank', domains: ['eximbank.com.vn'] },
  { id: 'uob', name: 'UOB', domains: ['uob.com.vn'] },
  { id: 'timo', name: 'Timo', domains: ['timo.vn'] },
  { id: 'cake', name: 'Cake', domains: ['cake.vn'] },
  { id: 'momo', name: 'MoMo', domains: ['momo.vn'] },
  { id: 'zalopay', name: 'ZaloPay', domains: ['zalopay.vn'] },
];
const SUBJECTS = [
  'biến động', 'bien dong', 'số dư', 'so du', 'giao dịch', 'giao dich', 'biên lai', 'bien lai', 'chuyển tiền', 'chuyen tien',
  'ghi nợ', 'ghi có', 'thanh toán', 'thanh toan', 'sao kê', 'sao ke', 'transaction', 'statement', 'receipt', 'alert',
];

export interface GmailLimits {
  /** 'since' = từ lần đọc trước; còn lại là số ngày gần nhất. */
  range: 'since' | 7 | 30 | 90;
  /** Số email tối đa mỗi lần đọc. */
  max: number;
  /** Chỉ đọc email của các ngân hàng này; để trống = tất cả. */
  banks?: string[];
}

export const DEFAULT_LIMITS: GmailLimits = { range: 30, max: 50 };

/** Dựng bộ lọc Gmail từ giới hạn người dùng chọn. */
export function buildQuery(l: GmailLimits, lastRead?: string): string {
  // "Từ lần trước": đọc lại từ đầu ngày của lần trước — email đã nhập rồi sẽ tự bỏ qua.
  const time = l.range === 'since' && lastRead ? `after:${lastRead.replaceAll('-', '/')}` : `newer_than:${l.range === 'since' ? 30 : l.range}d`;
  const picked = BANKS.filter((b) => l.banks?.includes(b.id));
  if (picked.length) return `${time} from:(${picked.flatMap((b) => b.domains).join(' OR ')})`;
  const all = BANKS.flatMap((b) => b.domains).join(' OR ');
  return `${time} -category:promotions (${SUBJECTS.map((s) => `subject:"${s}"`).join(' OR ')} OR from:(${all}))`;
}

/** Bộ lọc mặc định (30 ngày, mọi ngân hàng). */
export const DEFAULT_QUERY = buildQuery(DEFAULT_LIMITS);

let cached: { token: string; expiresAt: number } | null = null;

// Tài khoản Gmail nhận sao kê — có thể khác tài khoản dùng để sao lưu Drive.
const ACCOUNT_KEY = 'vi-cua-nang/gmail-account';

export function getGmailAccount(): string {
  try {
    return localStorage.getItem(ACCOUNT_KEY) ?? '';
  } catch {
    return '';
  }
}

function saveGmailAccount(email: string) {
  try {
    if (email) localStorage.setItem(ACCOUNT_KEY, email);
    else localStorage.removeItem(ACCOUNT_KEY);
  } catch {
    /* bỏ qua */
  }
}

/** Quên tài khoản Gmail đã chọn; lần đọc sau sẽ hỏi chọn lại. */
export function forgetGmailAccount() {
  if (cached) window.google?.accounts.oauth2.revoke(cached.token);
  cached = null;
  saveGmailAccount('');
}

/** Lỗi Gmail kèm link (nếu có) để người dùng bấm vào sửa. */
export class GmailError extends Error {
  constructor(
    message: string,
    public url?: string,
  ) {
    super(message);
  }
}

interface GoogleErrorBody {
  error?: {
    message?: string;
    details?: { reason?: string; metadata?: { activationUrl?: string; consumer?: string } }[];
  };
}

/** Phân biệt 403 do chưa bật Gmail API trong project hay do thiếu quyền đọc thư. */
async function forbidden(r: Response): Promise<GmailError> {
  const body: GoogleErrorBody = await r.json().catch(() => ({}));
  const details = body.error?.details ?? [];
  const reasons = details.map((d) => d.reason);
  if (reasons.includes('SERVICE_DISABLED') || /has not been used|is disabled/i.test(body.error?.message ?? '')) {
    const url = details.find((d) => d.metadata?.activationUrl)?.metadata?.activationUrl;
    return new GmailError(L.errors.gmailApiOff, url);
  }
  if (reasons.includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT') || /insufficient/i.test(body.error?.message ?? '')) {
    forgetGmailAccount();
    return new GmailError(L.errors.gmailNoScope);
  }
  return new GmailError(fill(L.errors.gmailDenied, { message: body.error?.message ?? '403' }));
}

/**
 * Xin quyền đọc Gmail; phải gọi từ thao tác bấm của người dùng.
 * Chưa chọn tài khoản thì Google hiện danh sách để chọn đúng hộp thư nhận sao kê.
 */
async function token(): Promise<string> {
  if (cached && cached.expiresAt > Date.now()) return cached.token;
  const loginHint = getGmailAccount();
  const clientId = CLIENT_ID;
  if (!clientId) throw new Error(L.errors.gmailNoConfig);
  await loadGis();
  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (r) => {
        if (r.error || !r.access_token) return reject(new Error(r.error_description || r.error || L.errors.gmailNotGranted));
        // Màn hình đồng ý của Google cho phép bỏ tick từng quyền — kiểm tra đã tick ô đọc Gmail chưa.
        if (r.scope && !r.scope.split(' ').includes(SCOPE)) {
          return reject(
            new GmailError(L.errors.gmailUnticked),
          );
        }
        cached = { token: r.access_token, expiresAt: Date.now() + ((r.expires_in ?? 3600) - 60) * 1000 };
        resolve(r.access_token);
      },
      error_callback: (e) => reject(new Error(e.type === 'popup_closed' ? L.errors.popupClosed : e.message || e.type)),
    });
    client.requestAccessToken(loginHint ? { prompt: '', login_hint: loginHint } : { prompt: 'select_account' });
  });
}

async function get(t: string, path: string) {
  const r = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${t}` } });
  if (r.status === 401) {
    cached = null;
    throw new Error(L.errors.gmailExpired);
  }
  if (r.status === 403) throw await forbidden(r);
  if (!r.ok) throw new Error(fill(L.errors.gmailStatus, { status: r.status }));
  return r.json();
}

interface Part {
  mimeType?: string;
  filename?: string;
  body?: { data?: string; attachmentId?: string; size?: number };
  parts?: Part[];
  headers?: { name: string; value: string }[];
}

function bytes(data: string) {
  const bin = atob(data.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

const decode = (data: string) => new TextDecoder().decode(bytes(data));

/** File PDF đính kèm (sao kê thẻ thường gửi dạng này), tối đa 15MB. */
function pdfParts(p: Part): Part[] {
  const out: Part[] = [];
  const walk = (x: Part) => {
    const isPdf = x.mimeType === 'application/pdf' || /\.pdf$/i.test(x.filename ?? '');
    if (isPdf && x.body?.attachmentId && (x.body.size ?? 0) < 15_000_000) out.push(x);
    x.parts?.forEach(walk);
  };
  walk(p);
  return out;
}

function htmlToText(html: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('style,script,head').forEach((n) => n.remove());
  return (doc.body.innerText || doc.body.textContent || '').replace(/\n\s*\n+/g, '\n').trim();
}

/** Ưu tiên phần text/plain; không có thì chuyển text/html sang chữ. */
function bodyText(p: Part): string {
  const plain: string[] = [];
  const html: string[] = [];
  const walk = (x: Part) => {
    if (x.body?.data && x.mimeType === 'text/plain') plain.push(decode(x.body.data));
    if (x.body?.data && x.mimeType === 'text/html') html.push(decode(x.body.data));
    x.parts?.forEach(walk);
  };
  walk(p);
  return (plain.length ? plain.join('\n') : html.map(htmlToText).join('\n')).trim();
}

export async function fetchBankEmails(opts: { query: string; max: number; skipIds: Set<string> }): Promise<EmailInput[]> {
  const t = await token();
  // Ghi nhớ hộp thư vừa được cấp quyền để lần sau không phải chọn lại.
  const profile = await get(t, '/profile');
  if (profile.emailAddress) saveGmailAccount(profile.emailAddress);
  const list = await get(t, `/messages?maxResults=${opts.max}&q=${encodeURIComponent(opts.query)}`);
  const ids: string[] = (list.messages ?? []).map((m: { id: string }) => m.id).filter((id: string) => !opts.skipIds.has(id));
  const out: EmailInput[] = [];
  for (const id of ids) {
    const m = await get(t, `/messages/${id}?format=full`);
    const h = (name: string) => (m.payload?.headers ?? []).find((x: { name: string }) => x.name.toLowerCase() === name)?.value ?? '';
    const text = bodyText(m.payload ?? {});
    const attachments = [];
    for (const part of pdfParts(m.payload ?? {})) {
      const a = await get(t, `/messages/${id}/attachments/${part.body!.attachmentId}`);
      attachments.push({ filename: part.filename || 'sao-ke.pdf', data: bytes(a.data) });
    }
    if (text || attachments.length) out.push({ id, from: h('from'), subject: h('subject'), date: h('date'), text, attachments });
  }
  return out;
}
