/** Cấu hình AI lưu riêng trên máy (không đồng bộ lên Drive). */
export type Provider = 'gemini' | 'claude';

export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';

/** Mô hình gợi ý trong Cài đặt (tên trong app Gemini → tên gọi API). */
export const GEMINI_MODELS = [
  { id: 'gemini-3.8-flash', label: '3.8 Flash', sub: 'Cân bằng' },
  { id: 'gemini-3.5-flash-lite', label: '3.5 Flash-Lite', sub: 'Nhanh nhất' },
] as const;

/** Tên mô hình cũ đã bị Google ngừng / thay: tự chuyển sang mặc định mới. */
const RETIRED = /^gemini-(flash-latest|2\.\d|3\.[0-7]-flash$)/;

const KEYS: Record<Provider, string> = {
  claude: 'vi-cua-nang/ai-key',
  gemini: 'vi-cua-nang/gemini-key',
};
const PROVIDER = 'vi-cua-nang/ai-provider';
const GEMINI_MODEL = 'vi-cua-nang/gemini-model';

function read(k: string) {
  try {
    return localStorage.getItem(k) ?? '';
  } catch {
    return '';
  }
}

function write(k: string, v: string) {
  try {
    if (v) localStorage.setItem(k, v.trim());
    else localStorage.removeItem(k);
  } catch {
    /* bỏ qua */
  }
}

export const getProvider = (): Provider => (read(PROVIDER) === 'claude' ? 'claude' : 'gemini');
export const setProvider = (p: Provider) => write(PROVIDER, p);

export const getApiKey = (p: Provider = getProvider()) => read(KEYS[p]);
export const setApiKey = (key: string, p: Provider = getProvider()) => write(KEYS[p], key);

export const getGeminiModel = () => {
  const m = read(GEMINI_MODEL);
  return !m || RETIRED.test(m) ? DEFAULT_GEMINI_MODEL : m;
};
export const setGeminiModel = (m: string) => write(GEMINI_MODEL, m);
