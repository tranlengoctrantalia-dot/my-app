/** Gọi Gemini để trích xuất giao dịch (trình duyệt gọi thẳng API bằng key AI Studio của người dùng). */
import { ApiError, GoogleGenAI, type Part } from '@google/genai';
import { z } from 'zod';
import { AiError, type AiRequest, type ExtractedList } from './extract';
import { L } from '../labels';
import { t } from '../i18n';

/** Mô hình dự phòng khi không hỏi được danh sách mô hình của Google. */
const FALLBACK_MODEL = 'gemini-3.5-flash-lite';

/** Xếp hạng mô hình flash: bản "latest" → bản số cao nhất → bản xem trước / lite. Bỏ mô hình ảnh, giọng nói… */
export function pickFlash(names: string[], exclude: string): string | undefined {
  const ok = names
    .map((n) => n.replace(/^models\//, ''))
    .filter((n) => n !== exclude && /flash/.test(n) && !/image|tts|audio|live|embed|thinking-exp|8b/.test(n));
  const ver = (n: string) => Number(n.match(/gemini-(\d+(?:\.\d+)?)/)?.[1] ?? 0);
  const score = (n: string) => (/latest/.test(n) ? 100 : 0) + ver(n) * 10 - (/preview|exp/.test(n) ? 5 : 0) - (/lite/.test(n) ? 80 : 0) - (/-\d{3}$/.test(n) ? 1 : 0);
  return ok.sort((a, b) => score(b) - score(a))[0];
}

let listed: string[] | undefined;
/** Mô hình người dùng chọn không còn (404) → mô hình thay thế, nhớ trong lúc app mở để khỏi gọi hỏng mỗi lần. */
const replaced = new Map<string, string>();
/** Mô hình flash còn dùng được (hỏi Google danh sách mô hình của key này), khác `exclude`. */
async function fallbackModel(apiKey: string, exclude: string): Promise<string> {
  try {
    if (!listed) {
      const res = await fetch(`${API}?pageSize=200&key=${encodeURIComponent(apiKey)}`, { signal: AbortSignal.timeout(8000) });
      const json = (await res.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
      listed = (json.models ?? []).filter((m) => m.supportedGenerationMethods?.includes('generateContent')).map((m) => m.name);
    }
    return pickFlash(listed, exclude) ?? FALLBACK_MODEL;
  } catch {
    return exclude === FALLBACK_MODEL ? 'gemini-flash-latest' : FALLBACK_MODEL;
  }
}
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
  contents: { role: 'user' | 'model'; parts: Part[] }[];
  systemInstruction?: { parts: { text: string }[] };
  generationConfig?: { responseMimeType?: string; responseJsonSchema?: unknown };
}

/**
 * Đường dự phòng: gửi kiểu "yêu cầu đơn giản" (key trên địa chỉ, Content-Type text/plain) nên trình duyệt
 * không phải hỏi trước máy chủ (CORS preflight). iPhone đôi khi chặn bước hỏi trước đó, Gemini vẫn đọc được nội dung JSON.
 */
async function restGenerate(apiKey: string, model: string, body: GenerateBody, signal?: AbortSignal): Promise<string> {
  const res = await fetch(`${API}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    signal,
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

/** Máy chủ Gemini bận / lỗi tạm thời. */
const BUSY = new Set([500, 502, 503, 504]);

/** Gọi Gemini; mô hình không còn (404) hoặc máy chủ quá tải (503…) thì chuyển ngay sang mô hình dự phòng, không chờ. */
async function generateSafe(apiKey: string, model: string, body: GenerateBody): Promise<string> {
  try {
    return await generate(apiKey, model, body);
  } catch (e) {
    const status = statusOf(e)?.status;
    if (!status || (status !== 404 && !BUSY.has(status))) throw e;
    const other = await fallbackModel(apiKey, model);
    try {
      return await generate(apiKey, other, body);
    } catch (e2) {
      // Báo lỗi theo mô hình gọi sau cùng.
      throw Object.assign(e2 as object, { triedModel: other });
    }
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
    const text = await generateSafe(apiKey, model, body);
    if (!text) throw new AiError(L.errors.geminiEmpty);
    const parsed = req.schema.safeParse(JSON.parse(text));
    if (!parsed.success) throw new AiError(L.errors.geminiBadFormat);
    return parsed.data;
  } catch (e) {
    throw toAiError(e, (e as { triedModel?: string })?.triedModel ?? model);
  }
}

/** Quá lâu không thấy chữ nào thì bỏ, đổi mô hình. */
const FIRST_TEXT_MS = 20_000;
/** Tối đa cho cả câu trả lời. */
const TOTAL_MS = 60_000;

class Timeout extends Error {}

/** Hỏi một mô hình, hiện chữ dần (`onText` nhận toàn bộ chữ tới lúc đó). */
async function streamOnce(apiKey: string, model: string, body: GenerateBody, think: boolean, onText: (s: string) => void): Promise<string> {
  const ctrl = new AbortController();
  let timer = setTimeout(() => ctrl.abort(new Timeout()), FIRST_TEXT_MS);
  try {
    const ai = new GoogleGenAI({ apiKey });
    const stream = await ai.models.generateContentStream({
      model,
      contents: body.contents,
      config: {
        systemInstruction: body.systemInstruction?.parts[0]?.text,
        // Câu hỏi về tiền chỉ cần đọc số app gửi: không cần "suy nghĩ" lâu.
        ...(think ? {} : { thinkingConfig: { thinkingBudget: 0 } }),
        abortSignal: ctrl.signal,
      },
    });
    let text = '';
    for await (const chunk of stream) {
      if (!text) {
        clearTimeout(timer);
        timer = setTimeout(() => ctrl.abort(new Timeout()), TOTAL_MS);
      }
      text += chunk.text ?? '';
      if (text) onText(text);
    }
    return text;
  } catch (e) {
    if (ctrl.signal.aborted) throw new Timeout();
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** Đường dự phòng (không hiện dần), tối đa 30 giây. */
async function restOnce(apiKey: string, model: string, body: GenerateBody): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30_000);
  try {
    return await restGenerate(apiKey, model, body, ctrl.signal);
  } catch (e) {
    if (ctrl.signal.aborted) throw new Timeout();
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Hỏi đáp nhiều lượt, hiện chữ dần. Mô hình bận / quá lâu → đổi ngay sang mô hình dự phòng (`onStatus` báo cho người dùng).
 * Mô hình không cho tắt "suy nghĩ" (400) → hỏi lại không kèm tuỳ chọn đó. Trình duyệt chặn → đường dự phòng (không hiện dần).
 */
export async function chatWithGemini(
  apiKey: string,
  model: string,
  system: string,
  msgs: { role: 'user' | 'ai'; text: string }[],
  onText: (s: string) => void = () => {},
  onStatus: (s: string) => void = () => {},
): Promise<string> {
  const body: GenerateBody = {
    contents: msgs.map((m) => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.text }] })),
    systemInstruction: { parts: [{ text: system }] },
  };
  let last: unknown;
  let m = replaced.get(model) ?? model;
  try {
    for (let i = 0; i < 2; i++) {
      if (i) {
        onStatus(L.errors.geminiSwitching);
        m = await fallbackModel(apiKey, model);
      }
      try {
        let text: string;
        try {
          // Lần trước treo (có thể trình duyệt chặn đường gọi chính): đi đường dự phòng, có giới hạn thời gian.
          text = last instanceof Timeout ? await restOnce(apiKey, m, body) : await streamOnce(apiKey, m, body, false, onText);
        } catch (e) {
          if (statusOf(e)?.status !== 400 || /API_KEY/i.test(statusOf(e)!.message)) throw e;
          text = await streamOnce(apiKey, m, body, true, onText);
        }
        if (!text) throw new AiError(L.errors.geminiEmpty);
        if (i && statusOf(last)?.status === 404) replaced.set(model, m);
        return text;
      } catch (e) {
        last = e;
        if (isNetError(e)) {
          const text = await restGenerate(apiKey, m, body);
          if (text) return text;
        }
        const status = statusOf(e)?.status;
        if (!(e instanceof Timeout) && status !== 404 && !(status && BUSY.has(status))) throw e;
      }
    }
    throw last;
  } catch (e) {
    if (e instanceof Timeout) throw new AiError(L.errors.geminiSlow);
    throw toAiError(e, m);
  }
}

/** Đổi lỗi Gemini / mạng thành câu báo dễ hiểu. */
function toAiError(e: unknown, model: string): AiError {
  if (e instanceof AiError) return e;
  if (e instanceof SyntaxError) return new AiError(L.errors.geminiUnreadable);
  const s = statusOf(e);
  if (s) {
    if (s.status === 400 && /API_KEY_INVALID|API key not valid/i.test(s.message)) return new AiError(L.errors.geminiBadKey);
    if (s.status === 403) return new AiError(L.errors.geminiNoPermission);
    if (s.status === 404) return new AiError(t(L.errors.geminiNoModel, { model }));
    if (s.status === 429) return new AiError(L.errors.geminiQuota);
    if (BUSY.has(s.status)) return new AiError(L.errors.geminiBusy);
    return new AiError(t(L.errors.geminiStatus, { status: s.status, message: s.message }));
  }
  // Chỉ coi là mất mạng khi trình duyệt không gửi được yêu cầu; lỗi khác thì hiện nguyên văn để dễ sửa.
  if (isNetError(e)) return new AiError(`${L.errors.geminiOffline} (${(e as Error).message})`);
  return new AiError(t(L.errors.geminiOther, { message: e instanceof Error ? e.message : String(e) }));
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
