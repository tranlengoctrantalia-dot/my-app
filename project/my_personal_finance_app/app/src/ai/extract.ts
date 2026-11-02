/**
 * Đọc giao dịch từ ảnh chụp màn hình / email ngân hàng bằng AI (Gemini hoặc Claude).
 * App không có máy chủ: trình duyệt gọi thẳng API bằng key người dùng tự nhập
 * (lưu riêng trên máy, không đồng bộ lên Drive).
 */
import { z } from 'zod';
import type { AppData } from '../domain/types';
import { getApiKey, getGeminiModel, getProvider } from './key';
import { redact } from './redact';
import { L } from '../labels';
import { t } from '../i18n';

export interface ImageInput {
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp';
  base64: string;
}

export interface EmailInput {
  id: string;
  from: string;
  subject: string;
  date: string;
  text: string;
  /** File PDF đính kèm (sao kê). */
  attachments?: { filename: string; data: Uint8Array }[];
}

/** Chữ lấy từ file PDF (sao kê) người dùng tự chọn hoặc đính kèm email. */
export interface DocInput {
  name: string;
  text: string;
}

export interface Extracted {
  date: string;
  merchant: string;
  amount: number;
  type: 'expense' | 'income' | 'refund';
  categoryId: string;
  accountId: string;
  sourceRef: string;
}

/** Thu nhỏ ảnh chụp màn hình (cạnh dài ≤ 1568px) để gửi nhanh và rẻ hơn. */
export async function fileToImage(file: File): Promise<ImageInput> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1568 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const url = canvas.toDataURL('image/jpeg', 0.85);
  return { mediaType: 'image/jpeg', base64: url.slice(url.indexOf(',') + 1) };
}

function schemaFor(data: AppData) {
  const spendIds = data.categories.filter((c) => c.kind !== 'installment').map((c) => c.id);
  const accountIds = data.accounts.map((a) => a.id);
  return z.object({
    transactions: z.array(
      z.object({
        date: z.string().describe('Ngày giao dịch dạng YYYY-MM-DD'),
        merchant: z.string().describe('Tên ngắn gọn nơi chi tiêu / người chuyển, vd "Shopee", "Grab", "Lương công ty"'),
        amount: z.number().describe('Số tiền VND, số nguyên dương'),
        type: z.enum(['expense', 'income', 'refund']),
        categoryId: z.enum(spendIds as [string, ...string[]]),
        accountId: z.enum(accountIds as [string, ...string[]]),
        sourceRef: z.string().describe('Mã email (id) mà giao dịch được lấy ra; để chuỗi rỗng nếu lấy từ ảnh'),
      }),
    ),
  });
}

function systemPrompt(data: AppData, today: string) {
  const cats = data.categories
    .filter((c) => c.kind !== 'installment')
    .map((c) => `- ${c.id}: ${c.name} (${c.kind === 'income' ? 'khoản thu' : 'khoản chi'})`)
    .join('\n');
  const accs = data.accounts.map((a) => `- ${a.id}: ${a.name} (${a.kind})`).join('\n');
  return `Bạn trích xuất giao dịch tài chính cá nhân từ thông báo ngân hàng / ví điện tử Việt Nam (ảnh chụp màn hình, email biến động số dư, email sao kê).

Hôm nay là ${today}. Nếu nguồn không ghi năm, dùng năm gần nhất không vượt quá hôm nay.

Quy tắc:
- Chỉ lấy giao dịch đã thực hiện. Bỏ qua quảng cáo, mã OTP, nhắc nợ, dòng số dư, giao dịch bị từ chối.
- amount là số tiền VND dương (bỏ dấu chấm/phẩy ngăn cách, bỏ "VND"/"đ").
  TUYỆT ĐỐI không lấy số tài khoản, số thẻ, mã giao dịch / số tham chiếu, số điện thoại, số dư hay hạn mức làm amount.
- type: "income" khi tiền vào (+, ghi có, nhận tiền, lương); "refund" khi là hoàn tiền của một khoản đã chi; còn lại là "expense".
- merchant: tên ngắn, dễ đọc (vd "Shopee", "Grab", "Highlands", "Chuyển khoản cho Lan").
- categoryId: chọn danh mục hợp nhất. Khoản thu phải dùng danh mục khoản thu; khoản chi/hoàn tiền dùng danh mục khoản chi.
- accountId: suy ra từ tên ngân hàng / thẻ / ví trong nguồn; nếu không rõ chọn tài khoản hợp lý nhất.
- Với sao kê thẻ tín dụng / tài khoản: lấy từng dòng giao dịch, dùng ngày giao dịch (không phải ngày hạch toán) và số tiền VND.
  Bỏ qua: dòng thanh toán thẻ / trả nợ thẻ (PAYMENT, THANH TOAN THE), số dư đầu kỳ / cuối kỳ, dòng tổng cộng, hạn mức, điểm thưởng,
  và các khoản trả góp hàng tháng (app theo dõi trả góp riêng). Dòng ghi có / CR / hoàn tiền là "refund". Phí và lãi là "expense".
- Email / tin biến động số dư: mỗi email thường là MỘT giao dịch. Số tiền là số giao dịch, KHÔNG phải số dư sau giao dịch, phí 0đ hay hạn mức.
  Bỏ qua: chuyển tiền trả nợ thẻ tín dụng, nạp tiền vào ví của chính mình (không phải chi tiêu), email OTP, giao dịch thất bại.
  Nếu email không ghi ngày giao dịch thì dùng ngày gửi email.
- Không bịa giao dịch. Không có giao dịch nào thì trả mảng rỗng.

Danh mục:
${cats}

Nguồn tiền:
${accs}`;
}

export class AiError extends Error {}

export type ExtractedList = { transactions: Extracted[] };

/** Yêu cầu đã chuẩn bị sẵn, dùng chung cho mọi nhà cung cấp AI. */
export interface AiRequest {
  system: string;
  images: ImageInput[];
  texts: string[];
  schema: ReturnType<typeof schemaFor>;
}

export async function extractTransactions(
  data: AppData,
  input: { images?: ImageInput[]; emails?: EmailInput[]; docs?: DocInput[] },
  today: string,
  /** Nhận lại đúng phần chữ sẽ gửi đi (sau khi che) để người dùng xem lại. */
  onPrepared?: (texts: string[]) => void,
): Promise<Extracted[]> {
  const provider = getProvider();
  const apiKey = getApiKey(provider);
  if (!apiKey) throw new AiError(t(L.errors.noApiKey, { provider: provider === 'gemini' ? 'Gemini' : 'Claude' }));

  // Che họ tên, số thẻ, số tài khoản, sđt, email, địa chỉ… — AI chỉ cần ngày, nơi chi, số tiền.
  const words = (data.settings.privacyWords ?? '').split(',');
  const hide = (t: string) => (data.settings.aiRedact === false ? t : redact(t, words));
  const texts = (input.emails ?? []).map(
    (m) => `<email id="${m.id}">
Từ: ${hide(m.from)}
Tiêu đề: ${hide(m.subject)}
Ngày: ${m.date}

${hide(m.text)}
</email>`,
  );
  for (const d of input.docs ?? []) texts.push(`<tai_lieu ten="${hide(d.name)}">
${hide(d.text)}
</tai_lieu>`);
  onPrepared?.(texts.slice());
  texts.push('Trích xuất các giao dịch trong các ảnh / email / tài liệu trên.');
  const req: AiRequest = { system: systemPrompt(data, today), images: input.images ?? [], texts, schema: schemaFor(data) };

  // Chỉ tải SDK của nhà cung cấp đang dùng.
  const result =
    provider === 'gemini'
      ? await (await import('./gemini')).extractWithGemini(apiKey, getGeminiModel(), req)
      : await (await import('./claude')).extractWithClaude(apiKey, req);
  return result.transactions;
}
