/**
 * Mở file PDF sao kê ngay trên máy (pdf.js), kể cả file có mật khẩu,
 * rồi lấy chữ ra theo từng dòng để gửi AI — không gửi file gốc lên đâu cả.
 */
import { GlobalWorkerOptions, PasswordException, PasswordResponses, getDocument } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { ImageInput } from './extract';
import { L } from '../labels';
import { t } from '../i18n';

GlobalWorkerOptions.workerSrc = workerUrl;

const PW_KEY = 'vi-cua-nang/pdf-passwords';

/** Mật khẩu đã dùng, lưu theo người gửi (ngân hàng) — chỉ trên máy này. */
function savedPasswords(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(PW_KEY) || '{}');
  } catch {
    return {};
  }
}

function savePassword(owner: string, pw: string) {
  try {
    localStorage.setItem(PW_KEY, JSON.stringify({ ...savedPasswords(), [owner]: pw }));
  } catch {
    /* bỏ qua */
  }
}

export function forgetPdfPasswords() {
  try {
    localStorage.removeItem(PW_KEY);
  } catch {
    /* bỏ qua */
  }
}

export class PdfSkipped extends Error {}

interface TextItem {
  str: string;
  transform: number[];
}

/** Ghép các mẩu chữ có cùng toạ độ dọc thành một dòng, giữ thứ tự cột từ trái sang phải. */
function linesOf(items: TextItem[]): string[] {
  const rows = new Map<number, { x: number; s: string }[]>();
  for (const it of items) {
    if (!it.str.trim()) continue;
    const y = Math.round(it.transform[5] / 3);
    rows.set(y, [...(rows.get(y) ?? []), { x: it.transform[4], s: it.str.trim() }]);
  }
  return [...rows.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, cells]) => cells.sort((a, b) => a.x - b.x).map((c) => c.s).join('  '));
}

export interface PdfContent {
  text: string;
  /** Ảnh các trang khi PDF là bản scan, không có lớp chữ. */
  images: ImageInput[];
}

/**
 * Đọc PDF. `owner` là người gửi (vd. email ngân hàng) để nhớ mật khẩu cho lần sau.
 * Hỏi mật khẩu bằng hộp thoại khi cần; người dùng bấm Huỷ thì bỏ qua file.
 */
export async function readPdf(data: Uint8Array, filename: string, owner: string): Promise<PdfContent> {
  let password = savedPasswords()[owner];
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const doc = await getDocument({ data: data.slice(), password }).promise;
      if (password) savePassword(owner, password);
      const lines: string[] = [];
      for (let p = 1; p <= doc.numPages; p++) {
        const page = await doc.getPage(p);
        const content = await page.getTextContent();
        lines.push(...linesOf(content.items as TextItem[]));
      }
      const text = lines.join('\n').trim();
      if (text.length > 40) return { text, images: [] };
      return { text: '', images: await renderPages(doc, 5) };
    } catch (e) {
      if (!(e instanceof PasswordException)) throw e;
      const wrong = e.code === PasswordResponses.INCORRECT_PASSWORD;
      const input = window.prompt(
        (wrong ? L.errors.pdfWrongPassword : '') + t(L.errors.pdfAskPassword, { filename }),
      );
      if (input === null) throw new PdfSkipped(t(L.errors.pdfSkipped, { filename }));
      password = input.trim();
    }
  }
  throw new PdfSkipped(t(L.errors.pdfTooManyTries, { filename }));
}

type PdfDoc = Awaited<ReturnType<typeof getDocument>['promise']>;

async function renderPages(doc: PdfDoc, max: number): Promise<ImageInput[]> {
  const out: ImageInput[] = [];
  for (let p = 1; p <= Math.min(doc.numPages, max); p++) {
    const page = await doc.getPage(p);
    const viewport = page.getViewport({ scale: 1.6 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvas, viewport }).promise;
    const url = canvas.toDataURL('image/jpeg', 0.8);
    out.push({ mediaType: 'image/jpeg', base64: url.slice(url.indexOf(',') + 1) });
  }
  return out;
}
