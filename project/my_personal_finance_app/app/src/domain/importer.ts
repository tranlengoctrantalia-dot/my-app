/**
 * Nhập lịch sử giao dịch từ app khác: Money Lover (CSV/XLSX), Misa Sổ Thu Chi (Excel),
 * sao kê ngân hàng / bảng Excel tự làm. Chỉ đọc & chuyển đổi, không đụng tới state.
 */
import * as XLSX from 'xlsx';
import type { Account, AccountKind, AppData, Category, Transaction } from './types';
import { uid } from './format';

export type ColKey = 'date' | 'amount' | 'category' | 'note' | 'account' | 'type' | 'income' | 'expense';

/** Bảng đã đọc: dòng tiêu đề + các dòng dữ liệu (chuỗi hiển thị). */
export interface Sheet {
  headers: string[];
  rows: string[][];
}

export interface ImportRow {
  date: string;
  /** Luôn dương; chiều tiền nằm ở `income`. */
  amount: number;
  income: boolean;
  category: string;
  note: string;
  account: string;
  /** Chuyển tiền / vay nợ / điều chỉnh số dư — không nhập, chỉ đếm. */
  transfer: boolean;
}

export interface Plan {
  transactions: Transaction[];
  newCategories: Category[];
  newAccounts: Account[];
  duplicates: number;
  transfers: number;
}

/** Chuẩn hoá để so khớp: bỏ dấu, đ→d, chữ thường, gom khoảng trắng (giữ '/' cho "thu/chi"). */
export function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9/]+/g, ' ')
    .trim();
}

/** `kw` xuất hiện trong `s` như một cụm từ trọn vẹn (cả hai đã chuẩn hoá). */
const hasWord = (s: string, kw: string) => ` ${s} `.includes(` ${kw} `);

const KEYWORDS: Record<ColKey, string[]> = {
  date: ['ngay', 'ngay giao dich', 'ngay gd', 'ngay thang', 'thoi gian', 'date', 'time', 'transaction date', 'ngay hach toan'],
  amount: ['so tien', 'amount', 'gia tri', 'money', 'tien', 'so tien vnd'],
  income: ['thu', 'tien thu', 'khoan thu', 'so tien thu', 'income', 'inflow', 'credit', 'ghi co', 'tien vao'],
  expense: ['chi', 'tien chi', 'khoan chi', 'so tien chi', 'expense', 'outflow', 'debit', 'ghi no', 'tien ra'],
  category: ['hang muc', 'danh muc', 'nhom', 'muc chi', 'muc thu', 'category', 'phan loai'],
  note: ['ghi chu', 'dien giai', 'mo ta', 'noi dung', 'note', 'notes', 'description', 'memo', 'chi tiet'],
  account: ['tai khoan', 'vi', 'nguon tien', 'wallet', 'account', 'the'],
  type: ['loai', 'loai giao dich', 'thu/chi', 'thu chi', 'type', 'kieu'],
};

/** Cột không bao giờ là dữ liệu cần lấy (loại tiền tệ, số dư…). */
const IGNORE = ['currency', 'loai tien', 'tien te', 'so du', 'balance', 'ma giao dich', 'so but toan'];

/** Điểm khớp tiêu đề: trùng hẳn > chứa cụm từ (cụm dài hơn thắng). Cột thu/chi riêng được ưu tiên hơn "số tiền". */
function score(header: string, key: ColKey): number {
  const h = norm(header);
  if (!h || IGNORE.some((w) => hasWord(h, w))) return 0;
  let best = 0;
  for (const kw of KEYWORDS[key]) {
    if (h === kw) return 100;
    if (hasWord(h, kw)) best = Math.max(best, kw.length + (key === 'income' || key === 'expense' ? 5 : 0));
  }
  return best;
}

export function guessColumns(headers: string[]): Partial<Record<ColKey, number>> {
  const cands: { key: ColKey; col: number; s: number }[] = [];
  headers.forEach((h, col) => {
    for (const key of Object.keys(KEYWORDS) as ColKey[]) {
      const s = score(h, key);
      if (s > 0) cands.push({ key, col, s });
    }
  });
  // Gán tham lam theo điểm cao nhất, mỗi cột / mỗi khoá dùng một lần.
  cands.sort((a, b) => b.s - a.s || a.col - b.col);
  const out: Partial<Record<ColKey, number>> = {};
  const used = new Set<number>();
  for (const c of cands) {
    if (out[c.key] !== undefined || used.has(c.col)) continue;
    out[c.key] = c.col;
    used.add(c.col);
  }
  return out;
}

/** Tìm dòng tiêu đề trong 15 dòng đầu (khớp >= 2 cột), lấy dữ liệu bên dưới, bỏ dòng trống. */
function toSheet(grid: string[][]): Sheet {
  const isEmpty = (r: string[]) => r.every((c) => !c.trim());
  let hi = grid.findIndex((r, i) => i < 15 && Object.keys(guessColumns(r)).length >= 2);
  if (hi < 0) hi = grid.findIndex((r) => !isEmpty(r));
  if (hi < 0) return { headers: [], rows: [] };
  const headers = grid[hi].map((c) => c.trim());
  const rows = grid.slice(hi + 1).filter((r) => !isEmpty(r)).map((r) => r.map((c) => c.trim()));
  return { headers, rows };
}

/** Đoán dấu phân cách CSV: tab, chấm phẩy hay phẩy. */
function detectDelimiter(lines: string[]): string {
  const sample = lines.filter((l) => l.trim()).slice(0, 15);
  const half = Math.max(1, Math.ceil(sample.length / 2));
  for (const d of ['\t', ';']) if (sample.filter((l) => l.includes(d)).length >= half) return d;
  return ',';
}

/** Tách CSV có hỗ trợ ngoặc kép ("a;b", "" = dấu ngoặc kép). */
function parseCsv(text: string, delim: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && !cell.trim()) {
      quoted = true;
      cell = '';
    } else if (ch === delim) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

export function readText(text: string): Sheet {
  const t = text.replace(/^﻿/, '');
  return toSheet(parseCsv(t, detectDelimiter(t.split(/\r?\n/))));
}

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

/** Đọc ô Excel thành chuỗi: ngày → YYYY-MM-DD, số → số thô (tránh định dạng kiểu Mỹ). */
function cellText(cell: XLSX.CellObject | undefined): string {
  if (!cell || cell.v == null) return '';
  if (cell.v instanceof Date) return iso(cell.v.getFullYear(), cell.v.getMonth() + 1, cell.v.getDate());
  if (cell.t === 'n' && typeof cell.v === 'number') {
    if (cell.z && XLSX.SSF.is_date(cell.z)) {
      const p = XLSX.SSF.parse_date_code(cell.v);
      if (p) return iso(p.y, p.m, p.d);
    }
    return String(cell.v);
  }
  return String(cell.w ?? cell.v);
}

export async function readFile(file: File): Promise<Sheet> {
  const name = file.name.toLowerCase();
  if (/\.(csv|txt|tsv)$/.test(name) || file.type.startsWith('text/')) return readText(await file.text());
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  // Lấy sheet đầu tiên có dữ liệu.
  for (const sn of wb.SheetNames) {
    const ws = wb.Sheets[sn];
    if (!ws['!ref']) continue;
    const r = XLSX.utils.decode_range(ws['!ref']);
    const grid: string[][] = [];
    for (let R = r.s.r; R <= r.e.r; R++) {
      const row: string[] = [];
      for (let C = r.s.c; C <= r.e.c; C++) row.push(cellText(ws[XLSX.utils.encode_cell({ r: R, c: C })]));
      grid.push(row);
    }
    const sheet = toSheet(grid);
    if (sheet.rows.length) return sheet;
  }
  return { headers: [], rows: [] };
}

/** Ngày dạng 'YYYY-MM-DD' hoặc '' nếu không đọc được. Mặc định ngày trước tháng (kiểu Việt Nam). */
export function parseDate(raw: string): string {
  const s = raw.trim();
  if (!s) return '';
  // Số serial của Excel (1955 → 2119).
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    if (n < 20000 || n > 80000) return '';
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(n) * 86_400_000);
    return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  const m = s.match(/^(\d{1,4})[/\-.](\d{1,2})[/\-.](\d{1,4})(?!\d)/);
  if (!m) return '';
  const [a, b, c] = [Number(m[1]), Number(m[2]), Number(m[3])];
  let y: number, mo: number, d: number;
  if (m[1].length === 4 || a > 31) [y, mo, d] = [a, b, c];
  else {
    [d, mo, y] = [a, b, c];
    if (mo > 12 && d <= 12) [d, mo] = [mo, d];
  }
  if (y < 100) y += 2000;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return '';
  return iso(y, mo, d);
}

/** Số tiền kiểu "1.234.567", "-50.000 ₫", "50,000.00", "(50.000)"; NaN nếu không có số. */
export function parseAmount(raw: string): number {
  const s = raw.trim();
  if (!/\d/.test(s)) return NaN;
  // Âm khi có dấu trừ trước số đầu tiên ("-50.000", "VND -50.000"), dấu trừ cuối, hoặc trong ngoặc.
  const neg = /[-−–]/.test(s.slice(0, s.search(/\d/))) || /[-−–]\s*$/.test(s) || /^\(.*\)$/.test(s);
  let n = s.replace(/[^\d.,]/g, '');
  const dot = n.lastIndexOf('.');
  const comma = n.lastIndexOf(',');
  if (dot >= 0 && comma >= 0) {
    // Có cả hai: dấu xuất hiện sau cùng là dấu thập phân.
    const dec = dot > comma ? '.' : ',';
    n = n.split(dec === '.' ? ',' : '.').join('').replace(dec, '.');
  } else if (dot >= 0 || comma >= 0) {
    const sep = dot >= 0 ? '.' : ',';
    const parts = n.split(sep);
    // Một dấu và đúng 3 số phía sau → dấu nghìn (VND hầu như không có số lẻ).
    n = parts.length > 2 || parts[1].length === 3 ? parts.join('') : `${parts[0]}.${parts[1]}`;
  }
  const v = Math.round(Number(n) * 100) / 100;
  if (!Number.isFinite(v)) return NaN;
  return neg ? -v : v;
}

const TRANSFER = [
  'chuyen tien', 'chuyen khoan noi bo', 'transfer', 'dieu chinh so du', 'adjust balance', 'balance adjustment',
  'cho vay', 'di vay', 'thu no', 'tra no', 'debt', 'loan', 'repayment',
];
const EXPENSE_TYPE = ['chi', 'tien chi', 'khoan chi', 'chi tieu', 'expense', 'expenses', 'out', 'outflow', 'debit', 'ghi no'];
const INCOME_TYPE = ['thu', 'tien thu', 'khoan thu', 'thu nhap', 'income', 'in', 'inflow', 'credit', 'ghi co'];

const isTransfer = (s: string) => {
  const n = norm(s);
  return !!n && TRANSFER.some((w) => hasWord(n, w));
};

/** Đọc cột loại: true = thu, false = chi, undefined = không rõ. */
function typeIncome(s: string): boolean | undefined {
  const n = norm(s);
  if (!n) return undefined;
  if (EXPENSE_TYPE.some((w) => hasWord(n, w))) return false;
  if (INCOME_TYPE.some((w) => hasWord(n, w))) return true;
  if (n === '+') return true;
  if (n === '-') return false;
  return undefined;
}

export function parseRows(sheet: Sheet, cols: Partial<Record<ColKey, number>>): { rows: ImportRow[]; skipped: number } {
  const get = (r: string[], k: ColKey) => (cols[k] === undefined ? '' : (r[cols[k]!] ?? '').trim());
  const split = cols.income !== undefined || cols.expense !== undefined;
  // Chỉ có cột số tiền toàn số dương, không có cột loại → coi như toàn khoản chi.
  const allPositive =
    !split && cols.type === undefined && sheet.rows.every((r) => !(parseAmount(get(r, 'amount')) < 0));

  const rows: ImportRow[] = [];
  let skipped = 0;
  for (const r of sheet.rows) {
    const date = parseDate(get(r, 'date'));
    let amount = 0;
    let income = false;
    if (split) {
      const inc = Math.abs(parseAmount(get(r, 'income'))) || 0;
      const exp = Math.abs(parseAmount(get(r, 'expense'))) || 0;
      if (exp > 0) amount = exp;
      else if (inc > 0) [amount, income] = [inc, true];
    } else {
      const v = parseAmount(get(r, 'amount')) || 0;
      amount = Math.abs(v);
      income = typeIncome(get(r, 'type')) ?? (allPositive ? false : v > 0);
    }
    if (!date || !amount) {
      skipped++;
      continue;
    }
    const category = get(r, 'category');
    rows.push({
      date,
      amount,
      income,
      category,
      note: get(r, 'note'),
      account: get(r, 'account'),
      transfer: isTransfer(category) || isTransfer(get(r, 'type')),
    });
  }
  return { rows, skipped };
}

/** Hash ngắn ổn định (FNV-1a 32 bit) để đánh dấu nguồn nhập, tránh nhập trùng. */
function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

function guessAccountKind(name: string): AccountKind {
  const n = norm(name);
  if (['tien mat', 'cash'].some((w) => hasWord(n, w))) return 'cash';
  if (['momo', 'zalopay', 'zalo pay', 'shopeepay', 'shopee pay', 'vnpay', 'vi dien tu', 'viettel money', 'viettelpay', 'e wallet', 'ewallet'].some((w) => hasWord(n, w)))
    return 'ewallet';
  if (['the tin dung', 'credit', 'credit card', 'visa', 'mastercard'].some((w) => hasWord(n, w))) return 'credit';
  return 'bank';
}

export function buildImport(rows: ImportRow[], data: AppData, fallbackAccountId?: string): Plan {
  const cats = [...data.categories];
  const accounts = [...data.accounts];
  const plan: Plan = { transactions: [], newCategories: [], newAccounts: [], duplicates: 0, transfers: 0 };
  const existing = new Set(data.transactions.map((t) => t.source).filter(Boolean));
  const seen = new Map<string, number>();

  const kindOk = (c: Category, income: boolean) => (income ? c.kind === 'income' : c.kind === 'spend' || c.kind === 'fixed');
  const findCat = (names: string[], income: boolean) =>
    cats.find((c) => kindOk(c, income) && names.includes(norm(c.name)));
  const categoryId = (name: string, income: boolean): string => {
    const n = norm(name);
    const found = findCat(n ? [n] : income ? ['thu khac', 'khac'] : ['khac'], income);
    if (found) return found.id;
    // Danh mục mới: icon trống + iconName chung như danh mục người dùng tự tạo.
    const c: Category = { id: uid(), name: n ? name.trim() : 'Khác', icon: '', iconName: 'tag', kind: income ? 'income' : 'spend' };
    cats.push(c);
    plan.newCategories.push(c);
    return c.id;
  };

  let fallback = fallbackAccountId ?? accounts[0]?.id;
  const accountId = (name: string): string => {
    const n = norm(name);
    if (n) {
      const found = accounts.find((a) => norm(a.name) === n);
      if (found) return found.id;
      const a: Account = { id: uid(), name: name.trim(), kind: guessAccountKind(name) };
      accounts.push(a);
      plan.newAccounts.push(a);
      return a.id;
    }
    if (!fallback) {
      const a: Account = { id: uid(), name: 'Tiền mặt', kind: 'cash' };
      accounts.push(a);
      plan.newAccounts.push(a);
      fallback = a.id;
    }
    return fallback;
  };

  for (const r of rows) {
    if (r.transfer) {
      plan.transfers++;
      continue;
    }
    // Hai dòng giống hệt trong cùng file vẫn nhập cả hai (đánh số lần xuất hiện), nhập lại file thì bỏ qua.
    const key = [r.date, r.amount, r.income ? 1 : 0, r.note, r.category, r.account].join('|');
    const nth = (seen.get(key) ?? 0) + 1;
    seen.set(key, nth);
    const source = `import:${hash(`${key}#${nth}`)}`;
    if (existing.has(source)) {
      plan.duplicates++;
      continue;
    }
    plan.transactions.push({
      id: uid(),
      date: r.date,
      merchant: r.note || r.category || 'Khác',
      amount: r.amount,
      myShare: r.amount,
      categoryId: categoryId(r.category, r.income),
      accountId: accountId(r.account),
      reimbursed: 0,
      ...(r.income ? { kind: 'income' as const } : {}),
      source,
    });
  }
  return plan;
}
