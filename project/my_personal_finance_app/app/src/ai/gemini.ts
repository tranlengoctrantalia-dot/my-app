/** Gọi Gemini để trích xuất giao dịch (trình duyệt gọi thẳng API bằng key AI Studio của người dùng). */
import { ApiError, GoogleGenAI, type Part } from '@google/genai';
import { z } from 'zod';
import { AiError, type AiRequest, type ExtractedList } from './extract';
import { L } from '../labels';
import { t } from '../i18n';

/** Dùng khi tên mô hình người dùng chọn không còn tồn tại. */
const FALLBACK_MODEL = 'gemini-2.5-flash';
const API = 'https://generativelanguage.googleapis.com/v1beta/models';

/** Lỗi Gemini trả về khi gọi bằng đường dự phòng (cùng dạng với ApiError của SDK). */
class RestError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Trình duyệt không gửi được yêu cầu (mất mạng, bị chặn…), khác với lỗi Gemini trả về. */
const isNetError = (e: unknown) => e instanceof TypeError && /failed to fetch|networkerror|load failed|network connection/i.test(e.message);

const statusOf = (e: unknown) => (e instanceof ApiError || e instanceof RestError ? { status: e.status, message: e.message } : undefined);

interface GenerateBody {
  contents: { role: 'user'; parts: Part[] }[];
  systemInstruction?: { parts: { text: string }[] };
  generationConfig?: { responseMimeType?: string; responseJsonSchema?: unknown };
}

/**
 * Đường dự phòng: gửi kiểu "yêu cầu đơn giản" (key trên địa chỉ, Content-Type text/plain) nên trình duyệt
 * không phải hỏi trước máy chủ (CORS preflight). iPhone đôi khi chặn bước hỏi trước đó, Gemini vẫn đọc được nội dung JSON.
 */
async function restGenerate(apiKey: string, model: string, body: GenerateBody): Promise<string> {
  const res = await fetch(`${API}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  if (!res.ok) throw new RestError(res.status, json.error?.message ?? res.statusText);
  return (json.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('');
}

/** Gọi qua SDK; nếu trình duyệt không gửi được thì thử lại bằng đường dự phòng. */
async function generate(apiKey: string, model: string, body: GenerateBody): Promise<string> {
  try {
    const ai = new GoogleGenAI({ apiKey });
    const res = await ai.models.generateContent({
      model,
      contents: body.contents,
      config: {
        systemInstruction: body.systemInstruction?.parts[0]?.text,
        responseMimeType: body.generationConfig?.responseMimeType,
        responseJsonSchema: body.generationConfig?.responseJsonSchema,
      },
    });
    return res.text ?? '';
  } catch (e) {
    if (!isNetError(e)) throw e;
    return restGenerate(apiKey, model, body);
  }
}

export async function extractWithGemini(apiKey: string, model: string, req: AiRequest): Promise<ExtractedList> {
  const parts: Part[] = [
    ...req.images.map((img) => ({ inlineData: { mimeType: img.mediaType, data: img.base64 } })),
    ...req.texts.map((text) => ({ text })),
  ];

  // Bỏ khoá "$schema" để Gemini nhận đúng phần lược đồ nó hỗ trợ.
  const { $schema: _ignored, ...jsonSchema } = z.toJSONSchema(req.schema);
  void _ignored;

  const body: GenerateBody = {
    contents: [{ role: 'user', parts }],
    systemInstruction: { parts: [{ text: req.system }] },
    generationConfig: { responseMimeType: 'application/json', responseJsonSchema: jsonSchema },
  };

  try {
    let text: string;
    try {
      text = await generate(apiKey, model, body);
    } catch (e) {
      if (statusOf(e)?.status === 404 && model !== FALLBACK_MODEL) text = await generate(apiKey, FALLBACK_MODEL, body);
      else throw e;
    }
    if (!text) throw new AiError(L.errors.geminiEmpty);
    const parsed = req.schema.safeParse(JSON.parse(text));
    if (!parsed.success) throw new AiError(L.errors.geminiBadFormat);
    return parsed.data;
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (e instanceof SyntaxError) throw new AiError(L.errors.geminiUnreadable);
    const s = statusOf(e);
    if (s) {
      if (s.status === 400 && /API_KEY_INVALID|API key not valid/i.test(s.message)) throw new AiError(L.errors.geminiBadKey);
      if (s.status === 403) throw new AiError(L.errors.geminiNoPermission);
      if (s.status === 404) throw new AiError(t(L.errors.geminiNoModel, { model }));
      if (s.status === 429) throw new AiError(L.errors.geminiQuota);
      throw new AiError(t(L.errors.geminiStatus, { status: s.status, message: s.message }));
    }
    // Chỉ coi là mất mạng khi trình duyệt không gửi được yêu cầu; lỗi khác thì hiện nguyên văn để dễ sửa.
    if (isNetError(e)) throw new AiError(`${L.errors.geminiOffline} (${(e as Error).message})`);
    throw new AiError(t(L.errors.geminiOther, { message: e instanceof Error ? e.message : String(e) }));
  }
}

/** Thử key + tên mô hình bằng một yêu cầu rất nhỏ; trả về câu báo kết quả. */
export async function pingGemini(apiKey: string, model: string): Promise<string> {
  try {
    const text = await generate(apiKey, model, { contents: [{ role: 'user', parts: [{ text: 'Trả lời đúng một chữ: OK' }] }] });
    return text ? t(L.errors.pingOk, { model }) : L.errors.pingEmpty;
  } catch (e) {
    const s = statusOf(e);
    if (s) {
      if (s.status === 400 && /API_KEY_INVALID|API key not valid/i.test(s.message)) return L.errors.pingBadKey;
      if (s.status === 403) return L.errors.pingNoPermission;
      if (s.status === 404) return t(L.errors.pingNoModel, { model });
      if (s.status === 429) return L.errors.pingQuota;
      return t(L.errors.pingStatus, { status: s.status, message: s.message });
    }
    // Kèm nguyên văn lỗi của trình duyệt để dễ tìm nguyên nhân.
    if (isNetError(e)) return `${L.errors.pingOffline} (${(e as Error).message})`;
    return t(L.errors.pingOther, { message: e instanceof Error ? e.message : String(e) });
  }
}
