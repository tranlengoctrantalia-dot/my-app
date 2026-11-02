/** Xuất dữ liệu ra file Excel để xem / lọc / in (file .json chỉ dùng để khôi phục vào app). */
import { utils, writeFile } from 'xlsx';
import { otherShare, monthOf, todayISO } from './domain/calc';
import { periodLabel } from './domain/format';
import type { AppData } from './domain/types';
import { L } from './labels';
import { personName, splitsOf } from './domain/split';

const X = L.card.excel;
const kindLabel = { credit: X.kindCredit, ewallet: X.kindEwallet, bank: X.kindBank, cash: X.kindCash };
const catKind = { spend: X.catSpend, fixed: X.catFixed, installment: X.catInstallment, income: X.catIncome };

function sheet(rows: Record<string, unknown>[], widths: number[]) {
  const ws = utils.json_to_sheet(rows);
  ws['!cols'] = widths.map((wch) => ({ wch }));
  return ws;
}

export function exportExcel(data: AppData) {
  const cat = (id: string) => data.categories.find((c) => c.id === id)?.name ?? id;
  const acc = (id: string) => data.accounts.find((a) => a.id === id)?.name ?? id;
  const wb = utils.book_new();

  const txs = [...data.transactions].sort((a, b) => a.date.localeCompare(b.date));
  utils.book_append_sheet(
    wb,
    sheet(
      txs.map((t) => ({
        [X.colDate]: new Date(t.date),
        [X.colPeriod]: periodLabel(monthOf(t.date)),
        [X.colMerchant]: t.merchant,
        [X.colCategory]: cat(t.categoryId),
        [X.colType]: t.kind === 'income' ? X.typeIncome : t.kind === 'transfer' ? X.typeTransfer : t.kind === 'lend' ? X.typeLend : t.kind === 'borrow' ? X.typeBorrow : t.amount < 0 ? X.typeRefund : X.typeSpend,
        [X.colAccount]: t.kind === 'transfer' ? `${acc(t.accountId)} → ${acc(t.toAccountId ?? '')}` : acc(t.accountId),
        [X.colAmount]: t.amount,
        [X.colMyShare]: t.kind === 'income' ? null : t.myShare,
        [X.colOtherShare]: splitsOf(t).length ? otherShare(t) : null,
        [X.colOther]: splitsOf(t)
          .map((x) => personName(data.settings, x.person))
          .join(', '),
        [X.colReimbursed]: splitsOf(t).length ? splitsOf(t).reduce((a, x) => a + x.paid, 0) : null,
        [X.colNote]: t.note ?? '',
      })),
      [11, 10, 26, 16, 10, 18, 13, 13, 13, 12, 12, 24],
    ),
    X.sheetTx,
  );

  utils.book_append_sheet(
    wb,
    sheet(
      data.budgets.flatMap((b) => [
        { [X.colPeriod]: periodLabel(b.period), [X.colCategory]: X.incomeRow, [X.colBudget]: b.income },
        ...b.lines.map((l) => ({ [X.colPeriod]: periodLabel(b.period), [X.colCategory]: cat(l.categoryId), [X.colBudget]: l.limit })),
      ]),
      [10, 22, 14],
    ),
    X.sheetBudget,
  );

  utils.book_append_sheet(
    wb,
    sheet(
      data.installments.map((i) => ({
        [X.colName]: i.name,
        [X.colCard]: acc(i.accountId),
        [X.colPrincipal]: i.principal ?? null,
        [X.colMonths]: i.months,
        [X.colRate]: i.ratePerYear ?? 0,
        [X.colFee]: i.fee ?? 0,
        [X.colMonthly]: i.monthly,
        [X.colFirstPeriod]: periodLabel(i.firstPeriod),
      })),
      [20, 16, 13, 8, 10, 14, 13, 12],
    ),
    X.sheetInstallment,
  );

  utils.book_append_sheet(
    wb,
    sheet(
      [
        ...data.accounts.map((a) => ({ [X.colGroup]: X.groupAccount, [X.colName]: a.name, [X.colType]: kindLabel[a.kind] })),
        ...data.categories.map((c) => ({ [X.colGroup]: X.groupCategory, [X.colName]: c.name, [X.colType]: catKind[c.kind] })),
      ],
      [12, 24, 14],
    ),
    X.sheetLists,
  );

  writeFile(wb, `vi-gon-${todayISO()}.xlsx`, { cellDates: true });
}
