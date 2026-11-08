import { db } from '../db';
import type { ForWhom, Item, Transaction } from '../types';
import { learnFrom } from './merchantRules';

export interface TidyInput {
  forWhom?: ForWhom;
  categoryId?: number;
  transfer?: boolean;
  items: Item[];
  note: string;
  planId?: number;
  /** foto baru yang belum tersimpan */
  newPhotos: Blob[];
  /** id foto lama yang dihapus */
  removedPhotoIds: number[];
  /** perubahan detail dasar (opsional) */
  patch?: Partial<Pick<Transaction, 'amount' | 'accountId' | 'date' | 'counterparty' | 'kind'>>;
}

async function recomputePlan(planId: number) {
  const plan = await db.plans.get(planId);
  if (!plan) return;
  const txs = (await db.transactions.where('planId').equals(planId).toArray()).filter((t) => t.status !== 'ignored');
  if (txs.length === 0) {
    if (plan.status === 'done' && plan.realizedTxIds.length) {
      await db.plans.update(planId, { status: 'active', realizedTxIds: [], actualAmount: undefined, doneAt: undefined });
    }
    return;
  }
  await db.plans.update(planId, {
    status: 'done',
    realizedTxIds: txs.map((t) => t.id!),
    actualAmount: txs.reduce((s, t) => s + t.amount, 0),
    doneAt: plan.doneAt ?? new Date().toISOString()
  });
}

/** Simpan hasil "Rapikan": kategori, untuk siapa, rincian, foto, realisasi rencana. */
export async function saveTidy(txId: number, input: TidyInput) {
  await db.transaction('rw', db.transactions, db.photos, db.plans, db.merchantRules, async () => {
    const tx = await db.transactions.get(txId);
    if (!tx) throw new Error('Transaksi tidak ditemukan');
    const prevPlan = tx.planId;

    if (input.removedPhotoIds.length) await db.photos.bulkDelete(input.removedPhotoIds);
    const now = new Date().toISOString();
    const newIds: number[] = [];
    for (const blob of input.newPhotos) newIds.push(await db.photos.add({ txId, blob, createdAt: now }));

    const updated: Transaction = {
      ...tx,
      ...input.patch,
      status: 'done',
      forWhom: input.transfer ? undefined : input.forWhom,
      categoryId: input.transfer ? undefined : input.categoryId,
      transfer: input.transfer || undefined,
      items: input.items.filter((i) => i.name.trim() || i.price),
      note: input.note.trim(),
      photoIds: [...tx.photoIds.filter((id) => !input.removedPhotoIds.includes(id)), ...newIds],
      planId: input.transfer ? undefined : input.planId
    };
    await db.transactions.put(updated);
    await learnFrom(updated);
    if (prevPlan && prevPlan !== updated.planId) await recomputePlan(prevPlan);
    if (updated.planId) await recomputePlan(updated.planId);
  });
}

/** Terima saran kategori langsung dari Inbox (geser kanan). */
export async function acceptSuggestion(tx: Transaction, s: { categoryId?: number; forWhom?: ForWhom; transfer?: boolean }) {
  const updated: Transaction = {
    ...tx, status: 'done',
    categoryId: s.transfer ? undefined : s.categoryId,
    forWhom: s.transfer || tx.kind === 'income' ? undefined : s.forWhom,
    transfer: s.transfer || undefined
  };
  await db.transactions.put(updated);
  await learnFrom(updated);
}

export async function setStatus(txId: number, status: Transaction['status']) {
  await db.transactions.update(txId, { status });
  const tx = await db.transactions.get(txId);
  if (tx?.planId) await recomputePlan(tx.planId);
}

export async function deleteTx(txId: number) {
  const tx = await db.transactions.get(txId);
  if (!tx) return;
  await db.transaction('rw', db.transactions, db.photos, db.plans, async () => {
    if (tx.photoIds.length) await db.photos.bulkDelete(tx.photoIds);
    await db.transactions.delete(txId);
    if (tx.planId) await recomputePlan(tx.planId);
  });
}
