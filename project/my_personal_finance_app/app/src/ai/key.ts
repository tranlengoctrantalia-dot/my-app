/** Cấu hình AI lưu riêng trên máy (không đồng bộ lên Drive). */
export type Provider = 'gemini' | 'claude';

export const DEFAULT_GEMINI_MODEL = 'gemini-flash-latest';

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

export const getGeminiModel = () => read(GEMINI_MODEL) || DEFAULT_GEMINI_MODEL;
export const setGeminiModel = (m: string) => write(GEMINI_MODEL, m);
