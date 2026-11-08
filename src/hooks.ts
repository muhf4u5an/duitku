import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import type { Account, Budget, Category, Plan, RecurringIncome, Transaction } from './types';

export interface Store {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  plans: Plan[];
  budgets: Budget[];
  incomes: RecurringIncome[];
  dailyEstimate: number;
  catById: Map<number, Category>;
  accById: Map<number, Account>;
}

/** Semua data utama dalam satu hook (otomatis ter-update saat database berubah). */
export function useStore(): Store | undefined {
  return useLiveQuery(async () => {
    const [accounts, categories, transactions, plans, budgets, incomes, est] = await Promise.all([
      db.accounts.orderBy('order').toArray(),
      db.categories.orderBy('order').toArray(),
      db.transactions.orderBy('date').reverse().toArray(),
      db.plans.toArray(),
      db.budgets.toArray(),
      db.recurringIncome.toArray(),
      db.meta.get('dailyEstimate')
    ]);
    return {
      accounts, categories, transactions, plans, budgets, incomes,
      dailyEstimate: (est?.value as number) ?? 50000,
      catById: new Map(categories.map((c) => [c.id!, c])),
      accById: new Map(accounts.map((a) => [a.id!, a]))
    };
  }, []);
}

export function useInboxCount(): number {
  return useLiveQuery(() => db.transactions.where('status').equals('inbox').count(), []) ?? 0;
}
