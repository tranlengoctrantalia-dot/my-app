import type { AppData, ISODate, Person, Settings, SplitPreset, Transaction, TxSplit } from './types';
import { L } from '../labels';

/** "Mình trả" (không chia) luôn đứng đầu; các cách chia còn lại người dùng tự sửa / xoá / thêm. */
export const ME: SplitPreset = { id: 'me', name: L.errors.starter.splitMe, mine: 1, other: 0 };

/** Chia đều cho mình và mọi người được chọn. */
export const EQUAL: SplitPreset = { id: 'half', name: L.errors.starter.splitHalf, mine: 1, other: 1 };
/** Người khác trả hết (chia đều cho những người được chọn). */
export const OTHERS: SplitPreset = { id: 'partner', name: L.errors.starter.splitPartner, mine: 0, other: 1 };
/** Mình trả · Chia đều · Trả hộ: luôn có, không sửa / xoá. */
export const BUILTIN: SplitPreset[] = [ME, EQUAL, OTHERS];
/** Tên cũ của các cách chia giờ đã thành lựa chọn cơ bản (không còn hiện trong "Tỉ lệ riêng"). */
const RETIRED = new Set(['me', 'half', 'partner', 'company']);

/** Bản cũ cho người mới sẵn "Chia đôi", "Trả hộ" trong danh sách — giờ là lựa chọn cơ bản nên để trống. */
export const defaultPresets: SplitPreset[] = [];

/** Cách chia của bản cũ (trước khi cho sửa): giữ lại cho ai đã dùng. */
export const legacyPresets = {
  third: { id: 'third', name: 'Hẹn hò 1:2', mine: 1, other: 2, counterparty: 'partner' } as SplitPreset,
  company: { id: 'company', name: 'Công ty trả', mine: 0, other: 1, counterparty: 'company' } as SplitPreset,
};

/** Tự nhập số tiền phần mình. */
export const CUSTOM = 'custom';

/** Tỉ lệ riêng người dùng tự thêm (vd. "Hẹn hò 1:2"). */
export const customRatios = (s: Settings): SplitPreset[] => (s.splitPresets ?? []).filter((p) => !RETIRED.has(p.id));

/** Mọi cách chia: 3 cách cơ bản + tỉ lệ riêng ("Tự nhập" là lựa chọn riêng, không nằm ở đây). */
export const allPresets = (s: Settings): SplitPreset[] => [...BUILTIN, ...customRatios(s)];

export const findPreset = (s: Settings, id: string) => allPresets(s).find((p) => p.id === id);

/** Tên cách chia; "{partner}" trong tên được thay bằng tên người đang chọn (không có thì bỏ đi). */
export const presetLabel = (p: SplitPreset, name?: string) =>
  name ? p.name.replace('{partner}', name) : p.name.replace(/\s*\{partner\}/, '');

/** Phần của từng người trong một khoản (đọc được cả cách lưu cũ chỉ có 1 người). */
export function splitsOf(t: Transaction): TxSplit[] {
  if (t.splits) return t.splits;
  if (t.counterparty && t.amount !== t.myShare) return [{ person: t.counterparty, amount: t.amount - t.myShare, paid: t.reimbursed }];
  return [];
}

/** Phần đã trả lại có ghi ngày nhận. */
export const loggedPaid = (x: TxSplit) => (x.log ?? []).reduce((a, e) => a + e.amount, 0);

/** Phần đã trả lại không rõ ngày nhận (ghi bằng bản cũ). */
export const unloggedPaid = (x: TxSplit) => x.paid - loggedPaid(x);

/** Phần trả dư (vượt số nợ). */
export const overPaid = (x: TxSplit) => (x.log ?? []).reduce((a, e) => a + (e.extra ?? 0), 0);

/** Tổng tiền thực nhận từ người đó = đã trả + phần dư. */
export const received = (x: TxSplit) => x.paid + overPaid(x);

/**
 * Đặt lại tổng tiền đã nhận của một người; phần chênh ghi vào log với ngày nhận `date`.
 * Vượt số nợ thì nợ tính đủ, phần dư ghi riêng (`extra`) để vẫn cộng vào ví.
 */
export function setPaid(x: TxSplit, total: number, date: ISODate, ts = Date.now()): TxSplit {
  const t = Math.max(0, total);
  const next = Math.min(t, x.amount);
  const delta = next - x.paid;
  const extra = t - next - overPaid(x);
  if (!delta && !extra) return x;
  return { ...x, paid: next, log: [...(x.log ?? []), { date, amount: delta, ...(extra ? { extra } : {}), ts }] };
}

/**
 * Chia theo tỉ lệ cho từng người: mình `mine` phần, MỖI người khác `other` phần.
 * Vd. 1:1 với 3 bạn = chia đều 4 người; 1:2 với 1 bạn = bạn trả gấp đôi mình. Tiền lẻ dồn vào phần mình.
 */
export function splitByRatio(amount: number, mine: number, other: number, people: string[]): { myShare: number; splits: TxSplit[] } {
  if (!people.length || other === 0) return { myShare: amount, splits: [] };
  const total = mine + other * people.length;
  const splits = people.map((person) => ({ person, amount: Math.round((amount * other) / total), paid: 0 }));
  return { myShare: amount - splits.reduce((a, x) => a + x.amount, 0), splits };
}

/** Đoán lại cách chia của một khoản đã lưu (để mở form sửa đúng lựa chọn). */
export function inferSplit(t: Transaction, s: Settings): { mode: string; people: string[]; amounts: Record<string, number> } {
  const splits = splitsOf(t);
  const people = splits.map((x) => x.person);
  const amounts = Object.fromEntries(splits.map((x) => [x.person, x.amount]));
  if (!splits.length) return { mode: 'me', people, amounts };
  const match = allPresets(s).find((p) => {
    if (p.other === 0 && p.mine === 0) return false;
    const r = splitByRatio(t.amount, p.mine, p.other, people);
    return r.splits.length === splits.length && r.splits.every((x, i) => x.amount === splits[i].amount);
  });
  return { mode: match?.id ?? CUSTOM, people, amounts };
}

/** Danh sách người hay chia tiền cùng. */
export const peopleOf = (s: Settings): Person[] => s.people ?? [];

/** Tên một người theo id (người đã bị xoá khỏi danh sách thì dùng tên cũ / id). */
export function personName(s: Settings, id?: string): string {
  if (!id) return '';
  return peopleOf(s).find((p) => p.id === id)?.name ?? (id === 'company' ? L.split.company : id === 'partner' ? s.partnerName : id);
}

/**
 * Bản cũ chỉ chia được với "người yêu" và "công ty" cố định. Chuyển thành danh sách người sửa được:
 * chỉ thêm người mà dữ liệu đã từng chia.
 */
/**
 * Gộp người trùng tên (vd. "Người yêu" bị thêm 2 lần): giữ 1 người, mọi khoản của bản trùng chuyển sang người giữ lại.
 * Ưu tiên giữ id 'partner' / 'company' của bản cũ.
 */
export function mergeSamePeople(d: AppData): AppData {
  const people = d.settings.people ?? [];
  // Chữ có dấu gõ trên iPhone / máy tính có thể khác mã (NFC / NFD) dù nhìn giống nhau.
  const norm = (name: string) => name.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
  const keep = new Map<string, Person>();
  const remap = new Map<string, string>();
  for (const p of [...people].sort((a, b) => Number(['partner', 'company'].includes(b.id)) - Number(['partner', 'company'].includes(a.id)))) {
    const k = norm(p.name);
    const first = keep.get(k);
    if (first) remap.set(p.id, first.id);
    else keep.set(k, p);
  }
  // Khoản cũ ghi theo id cố định ('partner' / 'company') mà danh sách người không có id đó:
  // tên hiện ra trùng một người trong danh sách → coi là cùng một người.
  const listed = new Set(people.map((p) => p.id));
  const used = new Set(
    d.transactions.flatMap((t) => [t.counterparty, ...(t.splits ?? []).map((x) => x.person)]).filter((id): id is string => !!id),
  );
  for (const id of used) {
    if (listed.has(id) || remap.has(id)) continue;
    const same = keep.get(norm(personName(d.settings, id)));
    if (same) remap.set(id, same.id);
  }
  if (!remap.size) return d;
  const to = (id?: string) => (id && remap.get(id)) || id;
  const mergeSplits = (splits?: TxSplit[]) => {
    if (!splits) return splits;
    const out: TxSplit[] = [];
    for (const x of splits) {
      const person = to(x.person)!;
      const same = out.find((y) => y.person === person);
      if (same)
        Object.assign(same, {
          amount: same.amount + x.amount,
          paid: same.paid + x.paid,
          log: same.log || x.log ? [...(same.log ?? []), ...(x.log ?? [])] : undefined,
        });
      else out.push({ ...x, person });
    }
    return out;
  };
  return {
    ...d,
    transactions: d.transactions.map((t) =>
      t.splits?.some((x) => remap.has(x.person)) || (t.counterparty && remap.has(t.counterparty))
        ? { ...t, counterparty: to(t.counterparty), splits: mergeSplits(t.splits) }
        : t,
    ),
    recurring: d.recurring?.map((r) => ({ ...r, counterparty: to(r.counterparty), people: r.people && [...new Set(r.people.map((p) => to(p)!))] })),
    settings: {
      ...d.settings,
      people: people.filter((p) => !remap.has(p.id)),
      splitPresets: d.settings.splitPresets?.map((p) => ({ ...p, counterparty: to(p.counterparty) })),
    },
  };
}

export function migratePeople(s: Settings, txs: Transaction[]): Person[] {
  if (s.people) return s.people;
  const used = new Set(txs.map((t) => t.counterparty).filter(Boolean));
  const out: Person[] = [];
  if (used.has('partner')) out.push({ id: 'partner', name: s.partnerName || L.errors.starter.partnerName });
  if (used.has('company')) out.push({ id: 'company', name: L.split.company });
  return out;
}

/** Phần mình chịu (hẹn hò 1:2 → mình 1/3, làm tròn như công thức trong file Excel). */
export function shareFor(p: SplitPreset | undefined, amount: number, custom = 0) {
  if (!p) return Math.min(custom, amount);
  if (p.other === 0) return amount;
  return Math.round((amount * p.mine) / (p.mine + p.other));
}

/** Đoán cách chia của một giao dịch đã lưu (để mở lại form đúng lựa chọn). */
export function inferPreset(t: Transaction, s: Settings): string {
  if (!t.counterparty) return 'me';
  // Khớp theo tỉ lệ; cùng tỉ lệ thì ưu tiên cách chia gắn sẵn đúng người đó.
  const fits = allPresets(s).filter((p) => p.other > 0 && shareFor(p, t.amount) === t.myShare);
  const match = fits.find((p) => p.counterparty === t.counterparty) ?? fits[0];
  return match?.id ?? CUSTOM;
}

/**
 * Bản cũ có sẵn "Hẹn hò 1:2", "Công ty trả"… cố định cho mọi người. Chuyển thành danh sách sửa được:
 * chỉ giữ cách chia mà dữ liệu thật sự đã dùng, cộng với cách người dùng tự thêm.
 */
export function migratePresets(s: Settings, txs: Transaction[]): SplitPreset[] {
  if (s.splitV2) return s.splitPresets ?? [];
  const used = (p: SplitPreset) => txs.some((t) => t.counterparty === p.counterparty && t.amount !== 0 && shareFor(p, t.amount) === t.myShare);
  const kept = [legacyPresets.third, ...defaultPresets, legacyPresets.company].filter((p) => defaultPresets.includes(p) || used(p));
  return [...kept, ...(s.splitPresets ?? [])];
}

/**
 * Một người trả một cục: trừ vào khoản cũ nhất trước, hết tiền thì dừng (khoản cuối có thể chỉ trả một phần).
 * Trả nhiều hơn tổng nợ: các khoản tính đủ, phần dư ghi vào khoản cuối (`extra`) để vẫn cộng vào ví.
 */
export function payOldestFirst(txs: Transaction[], who: string, amount: number, date: ISODate, ts = Date.now()) {
  const part = (t: Transaction) => splitsOf(t).find((x) => x.person === who);
  const owed = (t: Transaction) => {
    const x = part(t);
    return x ? x.amount - x.paid : 0;
  };
  const open = txs.filter((t) => owed(t) > 0).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const out: Transaction[] = [];
  let money = Math.max(0, amount);
  let full = 0;
  let partial: { tx: Transaction; left: number } | undefined;
  open.forEach((t, i) => {
    if (money <= 0) return;
    const x = part(t)!;
    const pay = Math.min(money, owed(t));
    money -= pay;
    // Khoản cuối cùng: dồn luôn phần dư.
    const extra = i === open.length - 1 ? money : 0;
    if (extra) money = 0;
    const next = setPaid(x, received(x) + pay + extra, date, ts);
    out.push({ ...t, splits: splitsOf(t).map((y) => (y.person === who ? next : y)), counterparty: undefined, reimbursed: 0 });
    if (pay === owed(t)) full++;
    else partial = { tx: t, left: owed(t) - pay };
  });
  const total = open.reduce((a, t) => a + owed(t), 0);
  return { txs: out, full, partial, extra: Math.max(0, amount - total) };
}

/** Một lần nhận tiền của một người (các dòng log cùng `ts`), mới nhất lên đầu. */
export interface Receipt {
  ts: number;
  date: ISODate;
  total: number;
  items: { tx: Transaction; amount: number }[];
}

export function receiptsOf(txs: Transaction[], who: string): Receipt[] {
  const m = new Map<number, Receipt>();
  for (const tx of txs)
    for (const x of splitsOf(tx))
      if (x.person === who)
        for (const e of x.log ?? []) {
          const amount = e.amount + (e.extra ?? 0);
          if (!amount) continue;
          const r = m.get(e.ts) ?? { ts: e.ts, date: e.date, total: 0, items: [] };
          r.total += amount;
          r.items.push({ tx, amount });
          m.set(e.ts, r);
        }
  return [...m.values()].sort((a, b) => b.ts - a.ts);
}

/** Xoá một lần nhận tiền: bỏ các dòng log cùng `ts`, số đã trả lùi lại đúng phần đó. */
export function undoReceipt(txs: Transaction[], who: string, ts: number): Transaction[] {
  const out: Transaction[] = [];
  for (const tx of txs) {
    const splits = splitsOf(tx);
    const hit = splits.some((x) => x.person === who && x.log?.some((e) => e.ts === ts));
    if (!hit) continue;
    out.push({
      ...tx,
      counterparty: undefined,
      reimbursed: 0,
      splits: splits.map((x) => {
        if (x.person !== who || !x.log) return x;
        const gone = x.log.filter((e) => e.ts === ts).reduce((a, e) => a + e.amount, 0);
        return { ...x, paid: x.paid - gone, log: x.log.filter((e) => e.ts !== ts) };
      }),
    });
  }
  return out;
}
