import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import { starterCategories, starterData } from './data/starter';
import { mergeSamePeople, migratePeople, migratePresets } from './domain/split';
import type { Account, AppData, Budget, Category, Goal, Installment, Recurring, Settings, Transaction } from './domain/types';
import { adjustFor, recurringDue } from './domain/calc';
import { findPreset, splitByRatio } from './domain/split';
import { uid } from './domain/format';

const KEY = 'vi-cua-nang/v1';

type Action =
  | { type: 'upsertTx'; tx: Transaction }
  | { type: 'deleteTx'; id: string }
  | { type: 'addTxs'; txs: Transaction[] }
  | { type: 'upsertAccount'; account: Account }
  | { type: 'deleteAccount'; id: string }
  | { type: 'upsertCategory'; category: Category }
  | { type: 'deleteCategory'; id: string }
  | { type: 'upsertInstallment'; item: Installment; category?: Category }
  | { type: 'deleteInstallment'; id: string }
  | { type: 'upsertBudget'; budget: Budget }
  | { type: 'settings'; patch: Partial<Settings> }
  | { type: 'finishSetup'; patch: Partial<Settings>; accounts: Account[] }
  | { type: 'upsertRecurring'; item: Recurring }
  | { type: 'deleteRecurring'; id: string }
  | { type: 'upsertGoal'; goal: Goal }
  /** Nhập lịch sử từ app khác: thêm danh mục, nguồn tiền mới và các khoản. */
  | { type: 'importPlan'; categories: Category[]; accounts: Account[]; txs: Transaction[] }
  | { type: 'deleteGoal'; id: string }
  /** Tự ghi các khoản định kỳ đã tới ngày (gọi khi mở app). */
  | { type: 'postRecurring'; today: string }
  /** Nhập số dư hiện tại của một nguồn (undefined = thôi theo dõi số dư). */
  | { type: 'setBalance'; accountId: string; balance: number | undefined }
  | { type: 'replace'; data: AppData };

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  return list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item];
}

function reducer(s: AppData, a: Action): AppData {
  if (a.type === 'replace') return mergeSamePeople(a.data);
  const next = apply(s, a);
  // Không có gì thay đổi (vd. chưa tới ngày ghi định kỳ) → giữ nguyên, khỏi sao lưu lại.
  if (next === s) return s;
  // Đóng dấu thời gian sửa để biết bản trên máy hay bản trên Drive mới hơn.
  return { ...next, updatedAt: Date.now() };
}

/** Ghi các khoản định kỳ đã tới ngày mà chưa ghi. Không có gì để ghi thì trả lại đúng state cũ. */
function postRecurring(s: AppData, today: string): AppData {
  const list = s.recurring ?? [];
  const sources = new Set(s.transactions.map((t) => t.source));
  const added: Transaction[] = [];
  let changed = false;
  const recurring = list.map((r) => {
    const due = recurringDue(r, today);
    if (!due.length) return r;
    changed = true;
    const preset = r.kind === 'income' ? undefined : findPreset(s.settings, r.splitId ?? 'me');
    for (const date of due) {
      const source = `recurring:${r.id}:${date}`;
      if (sources.has(source)) continue;
      const who = r.people ?? (r.counterparty ? [r.counterparty] : []);
      const share = preset && preset.other > 0 && who.length ? splitByRatio(r.amount, preset.mine, preset.other, who) : { myShare: r.amount, splits: [] };
      added.push({
        id: uid(),
        date,
        merchant: r.merchant,
        amount: r.amount,
        myShare: r.kind === 'income' ? r.amount : share.myShare,
        splits: share.splits.length ? share.splits : undefined,
        categoryId: r.categoryId,
        accountId: r.accountId,
        reimbursed: 0,
        kind: r.kind,
        source,
      });
    }
    return { ...r, lastDate: due[due.length - 1] };
  });
  return changed ? { ...s, recurring, transactions: [...s.transactions, ...added] } : s;
}

function apply(s: AppData, a: Exclude<Action, { type: 'replace' }>): AppData {
  switch (a.type) {
    case 'upsertTx':
      return { ...s, transactions: upsert(s.transactions, a.tx) };
    case 'deleteTx':
      return { ...s, transactions: s.transactions.filter((t) => t.id !== a.id) };
    case 'addTxs':
      return { ...s, transactions: [...s.transactions, ...a.txs] };
    case 'upsertAccount':
      return { ...s, accounts: upsert(s.accounts, a.account) };
    case 'deleteAccount':
      return { ...s, accounts: s.accounts.filter((x) => x.id !== a.id) };
    case 'upsertCategory':
      return { ...s, categories: upsert(s.categories, a.category) };
    case 'deleteCategory':
      return {
        ...s,
        categories: s.categories.filter((c) => c.id !== a.id),
        budgets: s.budgets.map((b) => ({ ...b, lines: b.lines.filter((l) => l.categoryId !== a.id) })),
      };
    case 'upsertInstallment':
      return {
        ...s,
        installments: upsert(s.installments, a.item),
        categories: a.category ? upsert(s.categories, a.category) : s.categories,
      };
    case 'deleteInstallment':
      return { ...s, installments: s.installments.filter((i) => i.id !== a.id) };
    case 'upsertBudget':
      return {
        ...s,
        budgets: [...s.budgets.filter((b) => b.period !== a.budget.period), a.budget].sort((x, y) =>
          x.period.localeCompare(y.period),
        ),
      };
    case 'upsertRecurring':
      return { ...s, recurring: upsert(s.recurring ?? [], a.item) };
    case 'deleteRecurring':
      return { ...s, recurring: (s.recurring ?? []).filter((r) => r.id !== a.id) };
    case 'importPlan':
      return {
        ...s,
        categories: [...s.categories, ...a.categories],
        accounts: [...s.accounts, ...a.accounts],
        transactions: [...s.transactions, ...a.txs],
      };
    case 'upsertGoal':
      return { ...s, goals: upsert(s.goals ?? [], a.goal) };
    case 'deleteGoal':
      return { ...s, goals: (s.goals ?? []).filter((g) => g.id !== a.id) };
    case 'postRecurring':
      return postRecurring(s, a.today);
    case 'setBalance':
      return {
        ...s,
        accounts: s.accounts.map((acc) =>
          acc.id === a.accountId ? { ...acc, balanceAdjust: a.balance === undefined ? undefined : adjustFor(s, acc.id, a.balance) } : acc,
        ),
      };
    case 'settings':
      // Thêm / đổi tên người trùng tên người đã có → gộp luôn.
      return mergeSamePeople({ ...s, settings: { ...s.settings, ...a.patch } });
    case 'finishSetup':
      return { ...s, setupPending: undefined, accounts: a.accounts, settings: { ...s.settings, ...a.patch } };
  }
}

// Tên danh mục cũ (dài) → tên ngắn; chỉ đổi khi người dùng chưa tự đặt tên khác.
const renamed: Record<string, [string, string]> = {
  food: ['Ăn vặt / cà phê', 'Ăn uống'],
  gift: ['Quà & sự kiện', 'Quà tặng'],
  'inst-new': ['Trả góp điện thoại mới', 'Góp ĐT mới'],
  'inst-old': ['Trả góp Cellphones cũ', 'Góp ĐT cũ'],
};

function migrate(d: AppData): AppData {
  const categories = d.categories.map((c) => (renamed[c.id]?.[0] === c.name ? { ...c, name: renamed[c.id][1] } : c));
  // Thêm các danh mục mặc định mới (khoản thu, hóa đơn…) nếu bản cũ chưa có.
  for (const c of starterCategories) if (!categories.some((x) => x.id === c.id)) categories.push(c);
  return mergeSamePeople({ ...d, categories, settings: {
      ...d.settings,
      splitPresets: migratePresets(d.settings, d.transactions),
      splitV2: true,
      people: migratePeople(d.settings, d.transactions),
    },
  });
}

function load(): AppData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppData;
      // Bản cũ nạp sẵn dữ liệu Excel của chủ app cho mọi người. Máy nào chưa từng sửa gì
      // (không có updatedAt, chỉ toàn giao dịch mẫu) là máy người khác → xoá, bắt đầu mới.
      const untouchedSeed = !parsed.updatedAt && parsed.transactions?.length > 0 && parsed.transactions.every((t) => t.id.startsWith('seed-'));
      if (parsed?.version === 1 && !untouchedSeed) return migrate(parsed);
    }
  } catch {
    /* dữ liệu hỏng hoặc bị chặn storage → bắt đầu mới */
  }
  return starterData();
}

export function isAppData(x: unknown): x is AppData {
  const d = x as AppData;
  return !!d && d.version === 1 && Array.isArray(d.transactions) && Array.isArray(d.accounts) && !!d.settings;
}

const Ctx = createContext<{ data: AppData; dispatch: (a: Action) => void } | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, dispatch] = useReducer(reducer, undefined, load);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      /* chế độ riêng tư: vẫn dùng được, chỉ không lưu */
    }
  }, [data]);
  const value = useMemo(() => ({ data, dispatch }), [data]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore phải nằm trong StoreProvider');
  return v;
}

export function useLookups() {
  const { data } = useStore();
  return useMemo(
    () => ({
      category: (id: string) => data.categories.find((c) => c.id === id),
      account: (id: string) => data.accounts.find((a) => a.id === id),
    }),
    [data.categories, data.accounts],
  );
}
