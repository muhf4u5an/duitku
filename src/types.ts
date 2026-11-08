export type Kind = 'expense' | 'income';
export type ForWhom = 'self' | 'couple';
export type TxStatus = 'inbox' | 'done' | 'ignored';
export type TxSource = 'gmail' | 'manual' | 'adjustment';

export interface Account {
  id?: number;
  name: string;
  icon: string;
  color: string;
  initialBalance: number;
  order: number;
}

export interface Category {
  id?: number;
  name: string;
  icon: string;
  color: string;
  kind: Kind;
  /** false = bukan konsumsi (mis. Investasi): tetap mengurangi saldo, tapi tidak dihitung di rata-rata harian */
  isConsumption: boolean;
  archived: boolean;
  order: number;
}

export interface Item {
  name: string;
  price: number;
}

export interface Transaction {
  id?: number;
  status: TxStatus;
  source: TxSource;
  /** id unik dari sumber (messageId Gmail) untuk mencegah impor ganda */
  sourceId?: string;
  accountId: number;
  kind: Kind;
  amount: number;
  counterparty: string;
  /** ISO datetime */
  date: string;
  forWhom?: ForWhom;
  categoryId?: number;
  /** transfer antar akun / top-up: memengaruhi saldo, tidak masuk laporan */
  transfer?: boolean;
  items: Item[];
  note: string;
  photoIds: number[];
  planId?: number;
  createdAt: string;
}

export interface Photo {
  id?: number;
  txId?: number;
  blob: Blob;
  createdAt: string;
}

export type PlanStatus = 'active' | 'done' | 'cancelled';

export interface Plan {
  id?: number;
  name: string;
  icon: string;
  target: number;
  /** YYYY-MM-DD, kosong = wishlist tanpa tanggal */
  dueDate?: string;
  forWhom: ForWhom;
  note: string;
  status: PlanStatus;
  actualAmount?: number;
  realizedTxIds: number[];
  createdAt: string;
  doneAt?: string;
}

export interface Budget {
  categoryId: number;
  monthlyAmount: number;
}

export interface RecurringIncome {
  id?: number;
  name: string;
  amount: number;
  dayOfMonth: number;
  accountId: number;
}

export interface MerchantRule {
  key: string;
  categoryId?: number;
  forWhom?: ForWhom;
  transfer?: boolean;
  hits: number;
  updatedAt: string;
}

export interface MetaRow {
  key: string;
  value: unknown;
}
