import Dexie, { type Table } from 'dexie';
import type {
  Account, Budget, Category, MerchantRule, MetaRow, Photo, Plan, RecurringIncome, Transaction
} from './types';

class DuitKuDB extends Dexie {
  accounts!: Table<Account, number>;
  categories!: Table<Category, number>;
  transactions!: Table<Transaction, number>;
  photos!: Table<Photo, number>;
  plans!: Table<Plan, number>;
  budgets!: Table<Budget, number>;
  recurringIncome!: Table<RecurringIncome, number>;
  merchantRules!: Table<MerchantRule, string>;
  meta!: Table<MetaRow, string>;

  constructor() {
    super('duitku');
    this.version(1).stores({
      accounts: '++id, order',
      categories: '++id, kind, order',
      transactions: '++id, status, date, accountId, categoryId, planId, sourceId',
      photos: '++id, txId',
      plans: '++id, status, dueDate',
      budgets: 'categoryId',
      recurringIncome: '++id',
      merchantRules: 'key',
      meta: 'key'
    });
  }
}

export const db = new DuitKuDB();

export const ALL_TABLES = [
  'accounts', 'categories', 'transactions', 'photos', 'plans',
  'budgets', 'recurringIncome', 'merchantRules', 'meta'
] as const;

export const DEFAULT_ACCOUNTS: Account[] = [
  { name: 'BSI', icon: '🏦', color: '#00897B', initialBalance: 0, order: 0 },
  { name: 'GoPay', icon: '💙', color: '#0277BD', initialBalance: 0, order: 1 }
];

export const DEFAULT_CATEGORIES: Category[] = [
  { name: 'Makan/Minum', icon: '🍜', color: '#F39C12', kind: 'expense', isConsumption: true, archived: false, order: 0 },
  { name: 'Keperluan Kuliah/Kerja', icon: '🎓', color: '#6C5CE7', kind: 'expense', isConsumption: true, archived: false, order: 1 },
  { name: 'Bensin', icon: '⛽', color: '#0984E3', kind: 'expense', isConsumption: true, archived: false, order: 2 },
  { name: 'Service Kendaraan', icon: '🔧', color: '#E17055', kind: 'expense', isConsumption: true, archived: false, order: 3 },
  { name: 'Investasi', icon: '📈', color: '#00B894', kind: 'expense', isConsumption: false, archived: false, order: 4 },
  { name: 'Lainnya', icon: '📦', color: '#95A5A6', kind: 'expense', isConsumption: true, archived: false, order: 99 },
  { name: 'Uang Bulanan/Gaji', icon: '💰', color: '#16A085', kind: 'income', isConsumption: true, archived: false, order: 0 },
  { name: 'Dana Tambahan', icon: '➕', color: '#00B894', kind: 'income', isConsumption: true, archived: false, order: 1 },
  { name: 'Lainnya', icon: '📦', color: '#95A5A6', kind: 'income', isConsumption: true, archived: false, order: 99 }
];

/** Isi data awal saat app pertama kali dibuka. */
export async function ensureSeed() {
  await db.transaction('rw', db.accounts, db.categories, db.meta, async () => {
    const seeded = await db.meta.get('seeded');
    if (seeded) return;
    await db.accounts.bulkAdd(DEFAULT_ACCOUNTS);
    await db.categories.bulkAdd(DEFAULT_CATEGORIES);
    await db.meta.put({ key: 'seeded', value: true });
  });
}

export async function getMeta<T>(key: string, fallback: T): Promise<T> {
  const row = await db.meta.get(key);
  return row ? (row.value as T) : fallback;
}

export async function setMeta(key: string, value: unknown) {
  await db.meta.put({ key, value });
}

/** Minta browser agar data tidak dihapus otomatis saat memori penuh. */
export async function requestPersistence() {
  try {
    if (navigator.storage?.persist) {
      const already = await navigator.storage.persisted();
      if (!already) await navigator.storage.persist();
    }
  } catch {
    /* tidak didukung, abaikan */
  }
}
