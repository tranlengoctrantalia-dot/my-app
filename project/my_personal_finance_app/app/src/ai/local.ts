/**
 * Đọc giao dịch NGAY TRÊN MÁY, không gửi đi đâu (không dùng AI).
 * Dựa vào quy tắc: dòng có ngày + số tiền là một giao dịch; danh mục đoán theo
 * những gì bạn từng nhập trước đây và một số từ khoá quen thuộc.
 */
import type { AppData } from '../domain/types';
import type { EmailInput, Extracted } from './extract';
import { fold } from './redact';
import { L } from '../labels';

const DATE = /(?<!\d)(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?(?!\d)/;
/** Số tiền có dấu ngăn cách hàng nghìn (1.373.000 / 1,373,000), có thể kèm ,00 / .00 và dấu - / CR. */
// Không dính vào chữ / số đứng trước (vd. mã "FT-845.012.345" không phải số tiền âm).
const AMOUNT = /(?<![\w.,])(-|\+)?\s?(\d{1,3}(?:[.,]\d{3})+)(?:[.,]\d{2})?(?![\d.,]\d)\s*(VND|VNĐ|đ|CR)?/gi;

/** Dòng không phải chi tiêu: trả nợ thẻ, số dư, tổng cộng, hạn mức, trả góp… */
const SKIP =
  /thanh toan the|thanh toan sao ke|payment|thank you|so du|balance|tong cong|tong so|total|han muc|credit limit|toi thieu|minimum|ky truoc|previous|tra gop|installment|diem thuong|reward|lai suat/;

/** Từ khoá rất rõ nghĩa — ưu tiên hơn lịch sử (vd. "GRAB*FOOD" là ăn uống dù Grab thường là đi lại). */
const STRONG: [RegExp, string][] = [[/grab\W?food|grab\W?mart|shopee\W?food|baemin|gojek\W?food|\bbe\W?food/, 'food']];

const KEYWORDS: [RegExp, string][] = [
  [/foody|highlands|phuc long|starbucks|katinat|cafe|coffee|tra sua|bun|pho|com |nha hang|restaurant|kfc|lotteria|jollibee|bakery|banh/, 'food'],
  [/shopee|lazada|tiki|tiktok|sendo|uniqlo|zara|h&m|guardian|watsons|hasaki|vinmart|winmart|bach hoa|co\.?op|big ?c|aeon|lotte mart|circle k|gs25|ministop/, 'shopping'],
  [/grab|xanh ?sm|be group|\bbe\b|gojek|taxi|vietjet|vietnam airlines|bamboo|petrolimex|xang/, 'transport'],
  [/cgv|lotte cinema|bhd|galaxy|netflix|spotify|youtube|steam|vui choi/, 'fun'],
  [/evn|dien luc|nuoc|viettel|vnpt|mobifone|vinaphone|fpt|internet|cuoc/, 'bills'],
  [/nha thuoc|pharmacity|long chau|an khang|benh vien|phong kham|hospital|clinic/, 'health'],
  [/spa|salon|nail|toc|beauty|cosmetic|my pham/, 'beauty'],
  [/gym|fitness|yoga|california/, 'gym'],
];

/** Từ khoá chính của tên nơi chi (bỏ mã giao dịch, mã thành phố…) để so với lịch sử. */
const key = (merchant: string) =>
  fold(merchant)
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .find((w) => w.length >= 3 && !/^\d+$/.test(w)) ?? '';

export function learnedCategories(data: AppData) {
  const votes = new Map<string, Map<string, number>>();
  for (const t of data.transactions) {
    if (t.kind === 'income') continue;
    const k = key(t.merchant);
    if (!k) continue;
    const m = votes.get(k) ?? new Map<string, number>();
    m.set(t.categoryId, (m.get(t.categoryId) ?? 0) + 1);
    votes.set(k, m);
  }
  return (merchant: string) => {
    const m = votes.get(key(merchant));
    return m ? [...m.entries()].sort((a, b) => b[1] - a[1])[0][0] : undefined;
  };
}

export function guessCategory(merchant: string, data: AppData, learned: (m: string) => string | undefined): string {
  const has = (id: string) => data.categories.some((c) => c.id === id);
  const f = fold(merchant);
  for (const [re, id] of STRONG) if (re.test(f) && has(id)) return id;
  const fromHistory = learned(merchant);
  if (fromHistory && has(fromHistory)) return fromHistory;
  for (const [re, id] of KEYWORDS) if (re.test(f) && has(id)) return id;
  return has('other') ? 'other' : data.categories.find((c) => c.kind === 'spend')!.id;
}

export function guessAccount(hint: string, data: AppData): string {
  const h = fold(hint);
  const byName = data.accounts.find((a) => {
    const n = fold(a.name);
    return n.split(/\s+/).some((w) => w.length >= 3 && h.includes(w)) || (/shinhan/.test(h) && /shb|shinhan/.test(n));
  });
  return (byName ?? data.accounts.find((a) => a.kind === 'credit') ?? data.accounts[0]).id;
}

function toISO(d: string, m: string, y: string | undefined, today: string) {
  const year = y ? (y.length === 2 ? `20${y}` : y) : today.slice(0, 4);
  const iso = `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  // Không ghi năm mà ra ngày ở tương lai → là năm trước.
  return !y && iso > today ? `${Number(year) - 1}${iso.slice(4)}` : iso;
}

const toNumber = (s: string) => Number(s.replace(/[.,]/g, ''));

function cleanMerchant(line: string) {
  return line
    .replace(new RegExp(DATE.source, 'g'), ' ')
    .replace(AMOUNT, ' ')
    .replace(/\b\d{5,}\b/g, ' ') // mã giao dịch / mã tham chiếu
    .replace(/\b(VND|VNĐ|USD|CR|DR)\b/gi, ' ')
    .replace(/[|]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 48);
}

/** Một dòng sao kê → một giao dịch (nếu có ngày và số tiền). */
function parseLine(line: string, today: string) {
  const f = fold(line);
  if (SKIP.test(f)) return null;
  const d = line.match(DATE);
  const amounts = [...line.matchAll(AMOUNT)];
  if (!d || !amounts.length || Number(d[2]) > 12 || Number(d[1]) > 31) return null;
  // Lấy số tiền cuối dòng (cột VND thường ở cuối; cột ngoại tệ đứng trước).
  const a = amounts[amounts.length - 1];
  const amount = toNumber(a[2]);
  if (amount < 1000) return null;
  const merchant = cleanMerchant(line);
  if (!merchant) return null;
  const credit = a[1] === '+' || /^cr$/i.test(a[3] ?? '') || /hoan tien|refund|ghi co/.test(f);
  return { date: toISO(d[1], d[2], d[3], today), merchant, amount, credit };
}

/* ---------- Email biến động số dư: mỗi email là một giao dịch ---------- */

/** Số tiền (150,000 / 150.000 / 1.500.000,00 / 150000) kèm dấu +/- và đơn vị nếu có. */
const MONEY = /(?<![\w.,-])([+-])?\s?(\d{1,3}(?:[.,]\d{3})+|\d{4,})(?:[.,]\d{1,2}(?!\d))?\s*(vnd|vnđ|đ|dong)?/gi;
/** Email không phải giao dịch đã xong: OTP, thất bại, khuyến mãi… */
const NOT_TX = /\botp\b|ma xac thuc|ma xac nhan|khong thanh cong|that bai|bi tu choi|declined|failed|khuyen mai|uu dai/;
/** Tiền chuyển giữa các nguồn của chính mình — không phải chi tiêu (sao kê thẻ đã tính rồi). */
const OWN_TRANSFER = /thanh toan (du no |sao ke )?the tin dung|tra no the|card payment|nap tien (vao )?(vi|momo|zalopay)/;

/** Chọn đúng số tiền giao dịch: ưu tiên số có dấu +/-, số đứng sau "Số tiền / PS", số có VND; bỏ số dư, số tài khoản, ngày giờ. */
function notificationAmount(text: string) {
  let best: { amount: number; sign?: string; score: number } | null = null;
  for (const line of text.split('\n')) {
    const f = fold(line);
    // Dòng số dư / hạn mức → bỏ; tin 1 dòng kiểu SMS thì cắt bỏ phần sau "SD".
    if (/^\W*(so du|balance|han muc|sd\b)/.test(f)) continue;
    const cut = f.search(/\b(sd|so du|balance|han muc|available)\b/);
    const body = cut > 0 ? line.slice(0, cut) : line;
    for (const m of body.matchAll(MONEY)) {
      const digits = m[2].replace(/[.,]/g, '');
      const at = m.index! + m[0].indexOf(m[2]);
      const prev = body[at - 1] ?? '';
      const next = body[at + m[2].length] ?? '';
      if (prev === '/' || next === '/' || prev === ':' || next === ':' || /^(19|20)\d\d$/.test(digits)) continue; // ngày, giờ, năm
      // Dãy số liền không dấu chấm phẩy mà dài (số tài khoản, mã giao dịch, hotline) → không phải số tiền,
      // trừ khi ghi rõ VND / đ ngay sau.
      if (!/[.,]/.test(m[2]) && (digits.length > 9 || !m[3])) continue;
      if (digits.length > 12) continue;
      const amount = Number(digits);
      if (amount < 1000) continue;
      const before = fold(body.slice(Math.max(0, m.index! - 40), m.index!));
      let score = 0;
      if (m[1]) score += 4;
      if (/(so tien|amount|gia tri|\bps\b|phat sinh|giao dich|thanh toan|chi tieu)[^0-9]*$/.test(before)) score += 3;
      if (m[3]) score += 2;
      if (/[.,]\d{3}/.test(m[2])) score += 1;
      if (!best || score > best.score) best = { amount, sign: m[1], score };
    }
  }
  return best;
}

const LABEL =
  /^(?:nd|noi dung(?: giao dich| chuyen tien| chuyen khoan)?|mo ta|dien giai|description|details|merchant|don vi chap nhan|noi giao dich|tai|dia diem|remark|nguoi nhan|ben nhan)\s*[:：]/;

const clean = (s: string) =>
  s
    .split(/\.\s*(?:SD|So du|Số dư)|\s{3,}/i)[0]
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 48);

function notificationMerchant(text: string): string {
  const lines = text.split('\n').map((l) => l.trim());
  for (let i = 0; i < lines.length; i++) {
    if (!LABEL.test(fold(lines[i]))) continue;
    // Nhãn và nội dung có khi nằm 2 dòng liền nhau (email dạng bảng).
    const value = lines[i].slice(lines[i].search(/[:：]/) + 1).trim() || lines[i + 1] || '';
    if (value) return clean(value);
  }
  // Tin 1 dòng: "... ND: GRAB*FOOD", "... tại HIGHLANDS".
  const m = text.match(/(?:^|[\s.,;])(?:ND|N[ộo]i dung)\s*[:：]\s*(.+)/i) ?? text.match(/(?:^|\s)(?:t[ạa]i|at)\s+([A-Z0-9*][^\n]+)/);
  return m ? clean(m[1]) : '';
}

/** Trùng tên nguồn đã có thì lấy luôn; "thẻ tín dụng / card" → thẻ, "TK / tài khoản" → ngân hàng, Momo / ZaloPay → ví. */
function notificationAccount(text: string, data: AppData) {
  const f = fold(text);
  const generic = /^(the|tai|khoan|tien|luong|dung|mat)$/;
  const byName = data.accounts.find((a) => fold(a.name).split(/\s+/).some((w) => w.length >= 3 && !generic.test(w) && f.includes(w)));
  if (byName) return byName.id;
  const kind = /momo|zalopay|shopeepay|vi dien tu/.test(f)
    ? 'ewallet'
    : /the tin dung|credit card|\bthe\s*(so|\d|x{2,}|\*)/.test(f)
      ? 'credit'
      : /\b(tk|tai khoan|account)\b/.test(f)
        ? 'bank'
        : '';
  return data.accounts.find((a) => a.kind === kind)?.id ?? guessAccount(text, data);
}

function incomeCategory(text: string, data: AppData) {
  const f = fold(text);
  const has = (id: string) => data.categories.some((c) => c.id === id);
  const pick = /luong|salary/.test(f) ? 'salary' : /thuong|bonus/.test(f) ? 'bonus' : /tang|li xi|mung/.test(f) ? 'gift-in' : 'other-in';
  return has(pick) ? pick : (data.categories.find((c) => c.kind === 'income')?.id ?? 'other');
}

function headerDate(header: string | undefined, today: string) {
  const d = header ? new Date(header) : null;
  if (!d || isNaN(d.getTime())) return today;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseNotification(text: string, hint: string, mailDate: string | undefined, data: AppData, today: string, learned: (m: string) => string | undefined) {
  const all = `${hint}\n${text}`;
  const f = fold(all);
  if (NOT_TX.test(f) || OWN_TRANSFER.test(f)) return null;
  const a = notificationAmount(text);
  if (!a) return null;
  const merchant = notificationMerchant(text) || L.errors.starter.unknownMerchant;
  const refund = /hoan tien|refund|hoan tra/.test(f);
  const income =
    !refund && (a.sign === '+' || (a.sign !== '-' && /ghi co|bao co|tien vao|nhan tien|nhan duoc|\bcredit\b(?! card)|received/.test(f)));
  const d = text.match(DATE);
  const date = d && Number(d[2]) <= 12 && Number(d[1]) <= 31 ? toISO(d[1], d[2], d[3], today) : headerDate(mailDate, today);
  const type: Extracted['type'] = refund ? 'refund' : income ? 'income' : 'expense';
  return {
    date,
    merchant,
    amount: a.amount,
    type,
    categoryId: income ? incomeCategory(merchant, data) : guessCategory(merchant, data, learned),
    accountId: notificationAccount(all, data),
  };
}

export function extractLocally(data: AppData, input: { emails?: EmailInput[]; docs?: { name: string; text: string }[] }, today: string): Extracted[] {
  const learned = learnedCategories(data);
  const out: Extracted[] = [];

  const sources = [
    ...(input.emails ?? []).map((m) => ({ text: m.text, hint: `${m.from} ${m.subject}`, ref: m.id, date: m.date as string | undefined })),
    ...(input.docs ?? []).map((d) => ({ text: d.text, hint: d.name, ref: '', date: undefined })),
  ];
  for (const src of sources) {
    const rows = src.text.split('\n').map((l) => parseLine(l, today)).filter((x) => x !== null);
    // Từ 2 dòng giao dịch trở lên → sao kê; còn lại coi là email biến động số dư (1 giao dịch).
    const n = rows.length >= 2 ? null : parseNotification(src.text, src.hint, src.date, data, today, learned);
    if (n) {
      out.push({ ...n, sourceRef: src.ref });
      continue;
    }
    for (const r of rows) {
      out.push({
        date: r.date,
        merchant: r.merchant,
        amount: r.amount,
        type: r.credit ? 'refund' : 'expense',
        categoryId: guessCategory(r.merchant, data, learned),
        accountId: guessAccount(src.hint, data),
        sourceRef: src.ref,
      });
    }
  }
  return out;
}
