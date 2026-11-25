/** Gọi Claude để trích xuất giao dịch (trình duyệt gọi thẳng API bằng key của người dùng). */
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { AiError, type AiRequest, type ExtractedList } from './extract';
import { L } from '../labels';
import { t } from '../i18n';

export async function extractWithClaude(apiKey: string, req: AiRequest): Promise<ExtractedList> {
  // App chỉ chạy trên máy người dùng với key của chính họ, nên cho phép gọi từ trình duyệt.
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  for (const img of req.images) {
    content.push({ type: 'image', source: { type: 'base64', media_type: img.mediaType, data: img.base64 } });
  }
  for (const text of req.texts) content.push({ type: 'text', text });

  try {
    const response = await client.beta.messages.parse({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      // Nếu bị bộ lọc an toàn từ chối, máy chủ tự chạy lại bằng mô hình dự phòng.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: req.system,
      messages: [{ role: 'user', content }],
      output_config: { effort: 'low', format: betaZodOutputFormat(req.schema) },
    });
    if (response.stop_reason === 'refusal') throw new AiError(L.errors.claudeRefusal);
    if (!response.parsed_output) throw new AiError(L.errors.claudeUnreadable);
    return response.parsed_output;
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (e instanceof Anthropic.AuthenticationError) throw new AiError(L.errors.claudeBadKey);
    if (e instanceof Anthropic.PermissionDeniedError) throw new AiError(L.errors.claudeNoPermission);
    if (e instanceof Anthropic.RateLimitError) throw new AiError(L.errors.claudeRateLimit);
    if (e instanceof Anthropic.APIConnectionError) throw new AiError(L.errors.claudeOffline);
    if (e instanceof Anthropic.APIError) throw new AiError(t(L.errors.claudeStatus, { status: String(e.status), message: e.message }));
    throw e;
  }
}

/** Hỏi đáp nhiều lượt (chữ thường). */
export async function chatWithClaude(apiKey: string, system: string, msgs: { role: 'user' | 'ai'; text: string }[]): Promise<string> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  try {
    const response = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system,
      messages: msgs.map((m) => ({ role: m.role === 'user' ? ('user' as const) : ('assistant' as const), content: m.text })),
      output_config: { effort: 'low' },
    });
    if (response.stop_reason === 'refusal') throw new AiError(L.errors.claudeRefusal);
    const text = response.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
    if (!text) throw new AiError(L.errors.claudeUnreadable);
    return text;
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (e instanceof Anthropic.AuthenticationError) throw new AiError(L.errors.claudeBadKey);
    if (e instanceof Anthropic.PermissionDeniedError) throw new AiError(L.errors.claudeNoPermission);
    if (e instanceof Anthropic.RateLimitError) throw new AiError(L.errors.claudeRateLimit);
    if (e instanceof Anthropic.APIConnectionError) throw new AiError(L.errors.claudeOffline);
    if (e instanceof Anthropic.APIError) throw new AiError(t(L.errors.claudeStatus, { status: String(e.status), message: e.message }));
    throw e;
  }
}
