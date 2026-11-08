import { db } from '../db';
import type { MerchantRule, Transaction } from '../types';

/**
 * Kunci merchant yang dinormalisasi supaya "SPBU PERTAMINA 34.123" dan
 * "SPBU Pertamina 34.999" dianggap sama: huruf besar, buang kata yang mengandung angka.
 */
export function merchantKey(counterparty: string): string {
  return counterparty
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !/\d/.test(w))
    .slice(0, 4)
    .join(' ')
    .trim();
}

export async function getRule(counterparty: string): Promise<MerchantRule | undefined> {
  const key = merchantKey(counterparty);
  if (!key) return undefined;
  return db.merchantRules.get(key);
}

/** Dipanggil setiap transaksi disimpan: app "belajar" pilihan kamu. */
export async function learnFrom(tx: Transaction) {
  const key = merchantKey(tx.counterparty);
  if (!key || tx.source === 'adjustment') return;
  const existing = await db.merchantRules.get(key);
  await db.merchantRules.put({
    key,
    categoryId: tx.transfer ? undefined : tx.categoryId,
    forWhom: tx.forWhom,
    transfer: tx.transfer,
    hits: (existing?.hits ?? 0) + 1,
    updatedAt: new Date().toISOString()
  });
}
