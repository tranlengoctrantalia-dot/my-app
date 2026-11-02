/**
 * Dữ liệu khởi đầu cho người mới: chỉ có danh mục và nguồn tiền cơ bản,
 * không có giao dịch / trả góp / ngân sách của ai cả.
 */
import type { AppData, Category } from '../domain/types';
import { defaultPresets } from '../domain/split';
import { L } from '../labels';

const N = L.errors.starter;

export const starterCategories: Category[] = [
  { id: 'shopping', name: N.categories.shopping, icon: '🛍️', kind: 'spend' },
  { id: 'food', name: N.categories.food, icon: '🧋', kind: 'spend' },
  { id: 'dating', name: N.categories.dating, icon: '💕', kind: 'spend' },
  { id: 'transport', name: N.categories.transport, icon: '🛵', kind: 'spend' },
  { id: 'gift', name: N.categories.gift, icon: '🎁', kind: 'spend' },
  { id: 'beauty', name: N.categories.beauty, icon: '💅', kind: 'spend' },
  { id: 'bills', name: N.categories.bills, icon: '', kind: 'spend' },
  { id: 'health', name: N.categories.health, icon: '', kind: 'spend' },
  { id: 'fun', name: N.categories.fun, icon: '', kind: 'spend' },
  { id: 'other', name: N.categories.other, icon: '📌', kind: 'spend' },
  { id: 'family', name: N.categories.family, icon: '🏡', kind: 'fixed' },
  { id: 'gym', name: N.categories.gym, icon: '🏋️', kind: 'fixed' },
  { id: 'saving', name: N.categories.saving, icon: '🐷', kind: 'fixed' },
  { id: 'salary', name: N.categories.salary, icon: '', kind: 'income' },
  { id: 'bonus', name: N.categories.bonus, icon: '', kind: 'income' },
  { id: 'gift-in', name: N.categories.giftIn, icon: '', kind: 'income' },
  { id: 'other-in', name: N.categories.otherIn, icon: '', kind: 'income' },
];

export function starterData(): AppData {
  return {
    version: 1,
    setupPending: true,
    settings: {
      cutoffDay: 8,
      dueDay: 25,
      salaryDay: 5,
      partnerName: N.partnerName,
      cashOnHand: 0,
      savingsFund: 0,
      splitPresets: defaultPresets.map((p) => ({ ...p })),
      splitV2: true,
      people: [],
    },
    accounts: [
      { id: 'card', name: N.accounts.card, kind: 'credit' },
      { id: 'bank', name: N.accounts.bank, kind: 'bank' },
      { id: 'momo', name: N.accounts.momo, kind: 'ewallet' },
      { id: 'cash', name: N.accounts.cash, kind: 'cash' },
    ],
    categories: starterCategories.map((c) => ({ ...c })),
    transactions: [],
    installments: [],
    budgets: [],
  };
}
