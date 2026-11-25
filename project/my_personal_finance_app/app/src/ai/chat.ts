/**
 * Hỏi đáp về tiền: app tự tính sẵn các con số (không gửi từng giao dịch) rồi nhờ AI tư vấn.
 * AI chỉ tư vấn, không sửa dữ liệu.
 */
import { buildPlan, check } from '../domain/advice';
import { accountBalance, budgetReport, installmentActive, installmentMine, monthOf, payables, receivables, shiftPeriod } from '../domain/calc';
import { personName } from '../domain/split';
import type { AppData, ISODate } from '../domain/types';
import { AiError } from './extract';
import { getApiKey, getGeminiModel, getProvider } from './key';
import { redact } from './redact';
import { L } from '../labels';
import { t } from '../i18n';

export interface ChatMsg {
  role: 'user' | 'ai';
  text: string;
}

// Không dùng `money` của app: chế độ ẩn số sẽ thay số bằng ***.
const nf = new Intl.NumberFormat('vi-VN');
const vnd = (n: number) => `${nf.format(Math.round(n))}đ`;
const dm = (d: ISODate) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/** Bảng số liệu gửi cho AI: số dư, khả năng thanh toán, ngân sách, thẻ, trả góp, ai nợ ai. */
export function moneyContext(data: AppData, today: ISODate): string {
  const cat = (id: string) => data.categories.find((c) => c.id === id)?.name ?? id;
  const who = (id: string) => personName(data.settings, id);
  const month = monthOf(today);
  const lines: string[] = [`Hôm nay: ${today}. Tháng đang xét: ${month}.`];

  lines.push('', '## Số dư từng nguồn');
  for (const a of data.accounts) {
    const b = accountBalance(data, a.id, today);
    lines.push(`- ${a.name} (${a.kind === 'credit' ? 'thẻ tín dụng, số âm = đang nợ thẻ' : 'tiền có'}): ${vnd(b)}`);
  }

  const plan = buildPlan(data, today);
  const r = check(plan, plan.flexPerDay);
  lines.push('', `## Khả năng thanh toán tới ${dm(plan.monthEnd)} (app đã tính)`);
  lines.push(`- Tiền trong ví: ${vnd(plan.cash)}`);
  if (plan.salary) lines.push(`- Lương sắp nhận ${dm(plan.salary.date)}: ${vnd(plan.salary.amount)}`);
  // Gom theo người + ngày hẹn cho gọn.
  const inc = new Map<string, { person: string; date: ISODate; amount: number; late: boolean }>();
  for (const i of plan.incoming) {
    const k = `${i.person}|${i.date}|${i.late}`;
    const cur = inc.get(k) ?? { person: i.person, date: i.date, amount: 0, late: i.late };
    cur.amount += i.amount;
    inc.set(k, cur);
  }
  for (const i of inc.values())
    lines.push(`- ${who(i.person)} còn nợ ${vnd(i.amount)}, hẹn ${dm(i.date)}${i.late ? ' (đã trễ hẹn, KHÔNG tính vào tiền có)' : i.date > plan.monthEnd ? ' (sau cuối tháng, không tính)' : ''}`);
  lines.push(`- Tổng tiền có: ${vnd(r.have)}`);
  for (const f of plan.fixed) lines.push(`- Khoản cố định còn phải chi: ${cat(f.categoryId)} ${vnd(f.amount)}${f.saving ? ' (tiết kiệm, hoãn được)' : ''}`);
  for (const c of plan.cards) lines.push(`- Trả thẻ ${c.name} hạn ${dm(c.due)}: ${vnd(c.amount)}`);
  lines.push(`- Ăn tiêu theo ngân sách: ${vnd(plan.flexPerDay)}/ngày × ${plan.days} ngày = ${vnd(r.spend)}`);
  lines.push(`- Tổng phải trả: ${vnd(r.pay)}`);
  lines.push(`- KẾT QUẢ: ${r.left >= 0 ? 'Dư' : 'Thiếu'} ${vnd(Math.abs(r.left))}; nếu hoãn tiết kiệm (${vnd(r.savings)}) thì ${r.leftNoSaving >= 0 ? 'dư' : 'thiếu'} ${vnd(Math.abs(r.leftNoSaving))}`);
  lines.push(`- Ăn tiêu tối đa mỗi ngày để vẫn đủ: ${vnd(r.maxPerDay)} (hoãn tiết kiệm: ${vnd(r.maxPerDayNoSaving)})`);
  if (r.dip) lines.push(`- Lưu ý: đúng hạn thẻ ${r.dip.card} ${dm(r.dip.date)} sẽ hụt ${vnd(r.dip.amount)} vì tiền người khác trả tới sau ngày đó`);

  const rep = budgetReport(data, month);
  const kind = (id: string) => data.categories.find((c) => c.id === id)?.kind;
  const kindName = (id: string) => (kind(id) === 'fixed' ? 'cố định' : kind(id) === 'spend' ? 'ăn tiêu' : kind(id) === 'installment' ? 'trả góp' : 'khác');
  lines.push('', `## Ngân sách tháng ${month}`, `- Lương dự kiến: ${vnd(rep.income)}; trả góp phần mình tháng này: ${vnd(rep.installments)}; chưa chia: ${vnd(rep.unallocated)}${rep.unallocated < 0 ? ' (đặt lố)' : ''}`);
  // Trả góp nằm riêng ở phần dưới.
  for (const x of [...rep.rows, ...rep.unbudgeted].filter((x) => kind(x.categoryId) !== 'installment'))
    lines.push(`- ${cat(x.categoryId)} [${kindName(x.categoryId)}]: đặt ${vnd(x.limit)}, đã chi ${vnd(x.spent)}, ${x.remaining >= 0 ? 'còn' : 'lố'} ${vnd(Math.abs(x.remaining))}`);

  const insts = data.installments.filter((i) => installmentActive(i, month) || i.firstPeriod > month);
  if (insts.length) {
    lines.push('', '## Trả góp');
    for (const i of insts) {
      const until = i.months ? `tới ${shiftPeriod(i.firstPeriod, i.months - 1)}` : 'chưa rõ ngày hết';
      lines.push(`- ${i.name}: phần mình ${vnd(installmentMine(i, i.firstPeriod > month ? i.firstPeriod : month))}/tháng, từ ${i.firstPeriod} ${until}`);
    }
  }

  const rec = receivables(data);
  const pay = payables(data);
  if (rec.byPerson.length || pay.byPerson.length) {
    lines.push('', '## Nợ qua lại');
    for (const p of rec.byPerson) lines.push(`- ${who(p.id)} nợ mình ${vnd(p.amount)} (${p.count} khoản)`);
    for (const p of pay.byPerson) lines.push(`- Mình nợ ${who(p.id)} ${vnd(p.amount)}`);
  }
  return lines.join('\n');
}

const SYSTEM = `Bạn là trợ lý tài chính cá nhân trong app Ví Gọn, nói tiếng Việt, xưng "mình", gọi người dùng là "bạn".
Quy tắc:
- Chỉ dùng số liệu trong phần <so_lieu>. Không bịa số. Cần cộng trừ thì ghi rõ phép tính từ các số đó.
- Trả lời NGẮN, đi thẳng vào việc. Có số tiền thì trình bày dạng bảng markdown 2–3 cột (Khoản | Số tiền), dòng tổng in đậm.
- Gợi ý phải cụ thể, có số: giảm mục nào bao nhiêu, nhắc ai trả bao nhiêu, hoãn khoản nào, ăn tiêu tối đa bao nhiêu/ngày.
- Thứ tự ưu tiên khi thiếu tiền: 1) đòi tiền người khác đang nợ, 2) giảm các mục ăn tiêu còn dư, 3) hoãn tiết kiệm, 4) cuối cùng mới tính chuyển trả góp hoặc vay.
- Bạn chỉ tư vấn, không sửa được dữ liệu trong app. Muốn đổi thì chỉ người dùng vào đâu bấm gì (Ngân sách, Chia tiền, Sổ chi, Ví).
- Câu hỏi ngoài chuyện tiền bạc thì trả lời ngắn và lái về tài chính.`;

/** Gửi câu hỏi kèm lịch sử chat; trả về câu trả lời của AI. `onText`: chữ hiện dần; `onStatus`: báo trạng thái (đổi mô hình…). */
export async function askMoney(
  data: AppData,
  history: ChatMsg[],
  today: ISODate,
  onText?: (s: string) => void,
  onStatus?: (s: string) => void,
): Promise<string> {
  const provider = getProvider();
  const apiKey = getApiKey(provider);
  if (!apiKey) throw new AiError(t(L.errors.noApiKey, { provider: provider === 'gemini' ? 'Gemini' : 'Claude' }));
  const words = (data.settings.privacyWords ?? '').split(',');
  const hide = (s: string) => (data.settings.aiRedact === false ? s : redact(s, words));
  const system = `${SYSTEM}\n\n<so_lieu>\n${hide(moneyContext(data, today))}\n</so_lieu>`;
  const msgs = history.map((m) => ({ ...m, text: m.role === 'user' ? hide(m.text) : m.text }));
  return provider === 'gemini'
    ? (await import('./gemini')).chatWithGemini(apiKey, getGeminiModel(), system, msgs, onText, onStatus)
    : (await import('./claude')).chatWithClaude(apiKey, system, msgs);
}
