import { db, setMeta } from '../db';
import type { Transaction } from '../types';
import { toYMD } from './format';
import { learnFrom } from './merchantRules';

/** Isi data contoh supaya bisa mencoba app (bisa dihapus lagi lewat "Hapus semua data"). */
export async function loadSampleData() {
  const accounts = await db.accounts.orderBy('order').toArray();
  const cats = await db.categories.toArray();
  const bsi = accounts[0]?.id ?? 1;
  const gopay = accounts[1]?.id ?? bsi;
  const cat = (name: string, kind: 'expense' | 'income' = 'expense') => cats.find((c) => c.name === name && c.kind === kind)?.id;

  await db.accounts.update(bsi, { initialBalance: 1_500_000 });
  if (gopay !== bsi) await db.accounts.update(gopay, { initialBalance: 200_000 });

  const now = new Date();
  const txs: Transaction[] = [];
  const mk = (daysAgo: number, hour: number, p: Partial<Transaction>): Transaction => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo, hour, Math.floor(Math.random() * 60));
    return {
      status: 'done', source: 'gmail', accountId: gopay, kind: 'expense', amount: 0, counterparty: '',
      date: d.toISOString(), items: [], note: '', photoIds: [], createdAt: d.toISOString(), forWhom: 'self', ...p
    };
  };
  const foods = [['MIE GACOAN', 68000, 'couple'], ['WARUNG PADANG SEDERHANA', 25000, 'self'], ['KOPI KENANGAN', 22000, 'self'], ['MCDONALDS', 54000, 'couple'], ['WARTEG BAHARI', 18000, 'self']] as const;

  for (let d = 44; d >= 1; d--) {
    const f = foods[d % foods.length];
    txs.push(mk(d, 12, { counterparty: f[0], amount: f[1], categoryId: cat('Makan/Minum'), forWhom: f[2] }));
    if (d % 3 === 0) txs.push(mk(d, 7, { accountId: bsi, counterparty: 'SPBU PERTAMINA 34.123', amount: 30000, categoryId: cat('Bensin') }));
    if (d % 7 === 2) txs.push(mk(d, 16, {
      counterparty: 'INDOMARET', amount: 76000, categoryId: cat('Makan/Minum'),
      items: [{ name: 'Kopi botol', price: 9000 }, { name: 'Roti tawar', price: 18000 }, { name: 'Snack', price: 36000 }, { name: 'Lain-lain', price: 13000 }]
    }));
    if (d % 7 === 0) {
      txs.push(mk(d, 9, { accountId: bsi, counterparty: 'Top up GoPay', amount: 400000, transfer: true, categoryId: undefined, forWhom: undefined }));
      txs.push(mk(d, 9, { accountId: gopay, kind: 'income', counterparty: 'Top up dari BSI', amount: 400000, transfer: true, categoryId: undefined, forWhom: undefined }));
    }
    if (d % 10 === 5) txs.push(mk(d, 10, { accountId: bsi, counterparty: 'FOTOKOPI JAYA', amount: 45000, categoryId: cat('Keperluan Kuliah/Kerja') }));
  }
  txs.push(mk(20, 9, { accountId: bsi, counterparty: 'BENGKEL AHASS', amount: 185000, categoryId: cat('Service Kendaraan') }));
  txs.push(mk(15, 20, { accountId: bsi, counterparty: 'BIBIT REKSADANA', amount: 300000, categoryId: cat('Investasi') }));
  // uang bulanan tanggal 1
  for (const m of [1, 0]) {
    const d = new Date(now.getFullYear(), now.getMonth() - m, 1, 8);
    if (d <= now) txs.push({ ...mk(0, 8, {}), date: d.toISOString(), createdAt: d.toISOString(), accountId: bsi, kind: 'income', amount: 3_000_000, counterparty: 'Transfer dari ORANG TUA', categoryId: cat('Uang Bulanan/Gaji', 'income'), forWhom: undefined });
  }
  // inbox (belum dicek)
  txs.push(mk(0, 7, { status: 'inbox', accountId: bsi, counterparty: 'SPBU PERTAMINA 34.567', amount: 30000, categoryId: undefined, forWhom: undefined, sourceId: 'demo-1' }));
  txs.push(mk(1, 19, { status: 'inbox', counterparty: 'MIE GACOAN', amount: 72000, categoryId: undefined, forWhom: undefined, sourceId: 'demo-2' }));
  txs.push(mk(1, 12, { status: 'inbox', accountId: bsi, counterparty: 'Top up GoPay', amount: 100000, categoryId: undefined, forWhom: undefined, sourceId: 'demo-3' }));
  txs.push(mk(2, 16, { status: 'inbox', counterparty: 'ALFAMART', amount: 145500, categoryId: undefined, forWhom: undefined, sourceId: 'demo-4' }));
  txs.push(mk(3, 10, { status: 'inbox', accountId: bsi, kind: 'income', counterparty: 'Transfer dari ANDI P', amount: 250000, categoryId: undefined, forWhom: undefined, sourceId: 'demo-5' }));
  await db.transactions.bulkAdd(txs);

  // aturan merchant dari data contoh
  for (const t of txs.filter((x) => x.status === 'done')) await learnFrom(t);
  await db.merchantRules.put({ key: 'TOP UP GOPAY', transfer: true, hits: 1, updatedAt: now.toISOString() });

  await db.recurringIncome.add({ name: 'Uang bulanan', amount: 3_000_000, dayOfMonth: 1, accountId: bsi });
  const budgets: [string, number][] = [['Makan/Minum', 1_200_000], ['Bensin', 300_000], ['Keperluan Kuliah/Kerja', 150_000]];
  for (const [n, v] of budgets) { const id = cat(n); if (id) await db.budgets.put({ categoryId: id, monthlyAmount: v }); }

  const inDays = (n: number) => toYMD(new Date(now.getFullYear(), now.getMonth(), now.getDate() + n));
  await db.plans.bulkAdd([
    { name: 'Bunga', icon: '🌸', target: 150_000, dueDate: inDays(7), forWhom: 'couple', note: '', status: 'active', realizedTxIds: [], createdAt: now.toISOString() },
    { name: 'Kado ultah', icon: '🎁', target: 500_000, dueDate: inDays(22), forWhom: 'couple', note: 'Ide: jam tangan', status: 'active', realizedTxIds: [], createdAt: now.toISOString() },
    { name: 'Sepatu lari', icon: '👟', target: 1_200_000, forWhom: 'self', note: '', status: 'active', realizedTxIds: [], createdAt: now.toISOString() }
  ]);
  await setMeta('dailyEstimate', 80000);
}
