/** Robot hỏi đáp: Gemini bận / treo / không cho tắt suy nghĩ → tự xử lý, hiện chữ dần. */
import { describe, expect, it, vi } from 'vitest';

const calls: string[] = [];
type Plan = (model: string, think: boolean) => string | 'HANG' | `ERR${number}`;
let plan: Plan;
vi.mock('@google/genai', () => {
  class ApiError extends Error {
    constructor(public status: number) {
      super(`status ${status}`);
    }
  }
  class GoogleGenAI {
    models = {
      generateContentStream: async ({ model, config }: { model: string; config: { thinkingConfig?: unknown; abortSignal: AbortSignal } }) => {
        const think = !config.thinkingConfig;
        calls.push(`${model}${think ? '+think' : ''}`);
        const r = plan(model, think);
        if (r.startsWith('ERR')) throw new ApiError(Number(r.slice(3)));
        if (r === 'HANG')
          await new Promise((_, rej) => config.abortSignal.addEventListener('abort', () => rej(new Error('aborted'))));
        return (async function* () {
          for (const w of r.split(' ')) yield { text: w + ' ' };
        })();
      },
    };
  }
  return { ApiError, GoogleGenAI };
});

// Đường dự phòng (fetch thẳng): theo cùng kế hoạch, ghi lại là "rest:<mô hình>".
let available = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-3-flash', 'gemini-3-flash-lite'];
vi.stubGlobal('fetch', async (url: string, init: { signal?: AbortSignal }) => {
  if (!url.includes('/models/'))
    return new Response(JSON.stringify({ models: available.map((n) => ({ name: `models/${n}`, supportedGenerationMethods: ['generateContent'] })) }));
  const model = decodeURIComponent(url.split('/models/')[1].split(':')[0]);
  calls.push(`rest:${model}`);
  const r = plan(model, true);
  if (r === 'HANG') await new Promise((_, rej) => init.signal?.addEventListener('abort', () => rej(new Error('aborted'))));
  if (r.startsWith('ERR')) return new Response(JSON.stringify({ error: { message: 'x' } }), { status: Number(r.slice(3)) });
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: r }] } }] }));
});

const { chatWithGemini, pickFlash } = await import('./gemini');
async function ask() {
  const seen: string[] = [];
  const status: string[] = [];
  const p = chatWithGemini('k', 'gemini-flash-latest', 'sys', [{ role: 'user', text: 'hi' }], (s) => seen.push(s), (s) => status.push(s)).catch((e: Error) => `ERROR ${e.message}`);
  await vi.runAllTimersAsync();
  return { out: await p, seen, status };
}

describe('robot hỏi đáp với Gemini', () => {
  it('hiện chữ dần', async () => {
    vi.useFakeTimers();
    calls.length = 0;
    plan = () => 'Dư 1tr nhé';
    const r = await ask();
    expect(r.out.trim()).toBe('Dư 1tr nhé');
    expect(r.seen.length).toBe(3);
    expect(calls).toEqual(['gemini-flash-latest']);
  });

  it('503 → đổi ngay mô hình dự phòng, không chờ', async () => {
    calls.length = 0;
    plan = (m) => (m === 'gemini-flash-latest' ? 'ERR503' : 'ok');
    const r = await ask();
    expect(r.out.trim()).toBe('ok');
    expect(calls).toEqual(['gemini-flash-latest', 'gemini-3-flash']);
    expect(r.status[0]).toMatch(/đổi mô hình/);
  });

  it('treo không trả chữ → hết giờ, đổi mô hình qua đường dự phòng', async () => {
    calls.length = 0;
    plan = (m) => (m === 'gemini-flash-latest' ? 'HANG' : 'ok');
    const r = await ask();
    expect(r.out.trim()).toBe('ok');
    expect(calls).toEqual(['gemini-flash-latest', 'rest:gemini-3-flash']);
  });

  it('mô hình không cho tắt suy nghĩ (400) → hỏi lại bình thường', async () => {
    calls.length = 0;
    plan = (_m, think) => (think ? 'ok' : 'ERR400');
    const r = await ask();
    expect(r.out.trim()).toBe('ok');
    expect(calls).toEqual(['gemini-flash-latest', 'gemini-flash-latest+think']);
  });

  it('mô hình đã chọn không còn (404) → dùng mô hình còn trong danh sách, lần sau dùng luôn', async () => {
    calls.length = 0;
    plan = (m) => (m === 'gemini-flash-latest' ? 'ERR404' : 'ok');
    expect((await ask()).out.trim()).toBe('ok');
    expect(calls).toEqual(['gemini-flash-latest', 'gemini-3-flash']);
    calls.length = 0;
    expect((await ask()).out.trim()).toBe('ok');
    expect(calls).toEqual(['gemini-3-flash']);
  });

  it('cả hai đều treo → báo dễ hiểu', async () => {
    plan = () => 'HANG';
    const r = await ask();
    expect(r.out).toMatch(/quá lâu/);
    vi.useRealTimers();
  });
});

describe('chọn mô hình flash', () => {
  it('ưu tiên latest, rồi số cao, bỏ lite / ảnh / giọng nói', () => {
    expect(pickFlash(['models/gemini-2.5-flash', 'models/gemini-3-flash', 'models/gemini-3-flash-lite', 'models/gemini-3-flash-image', 'models/gemini-2.5-flash-preview-tts'], 'x')).toBe('gemini-3-flash');
    expect(pickFlash(['models/gemini-flash-latest', 'models/gemini-3-flash'], 'x')).toBe('gemini-flash-latest');
    expect(pickFlash(['models/gemini-flash-latest', 'models/gemini-flash-lite-latest', 'models/gemini-3-flash'], 'gemini-flash-latest')).toBe('gemini-3-flash');
  });
});

describe('mô hình mặc định', () => {
  it('tên cũ đã ngừng → tự dùng 3.8 Flash', async () => {
    const { getGeminiModel, setGeminiModel } = await import('./key');
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) });
    for (const old of ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-3.7-flash', '']) {
      setGeminiModel(old);
      expect(getGeminiModel()).toBe('gemini-3.8-flash');
    }
    setGeminiModel('gemini-3.5-flash-lite');
    expect(getGeminiModel()).toBe('gemini-3.5-flash-lite');
  });
});
