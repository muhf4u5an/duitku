import type { Account, Category, Transaction } from '../types';
import { daysBetween, startOfDay } from './format';

/** Ikut menghitung saldo (semua kecuali yang diabaikan) */
export function affectsBalance(t: Transaction) {
  return t.status !== 'ignored';
}

/** Arus kas nyata: bukan transfer, bukan koreksi saldo, bukan diabaikan */
export function isCashflow(t: Transaction) {
  return t.status !== 'ignored' && !t.transfer && t.source !== 'adjustment';
}

/** Masuk laporan per kategori: sudah dirapikan dan punya kategori */
export function isReportable(t: Transaction) {
  return t.status === 'done' && !t.transfer && t.source !== 'adjustment' && t.categoryId != null;
}

export function signed(t: Transaction) {
  return t.kind === 'income' ? t.amount : -t.amount;
}

export function accountBalances(accounts: Account[], txs: Transaction[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const a of accounts) m.set(a.id!, a.initialBalance);
  for (const t of txs) {
    if (!affectsBalance(t)) continue;
    m.set(t.accountId, (m.get(t.accountId) ?? 0) + signed(t));
  }
  return m;
}

export function totalBalance(accounts: Account[], txs: Transaction[]) {
  let s = 0;
  for (const v of accountBalances(accounts, txs).values()) s += v;
  return s;
}

export function inMonth(t: Transaction, key: string) {
  const d = new Date(t.date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === key;
}

export function monthTotals(txs: Transaction[], key: string) {
  let income = 0;
  let expense = 0;
  for (const t of txs) {
    if (!isCashflow(t) || !inMonth(t, key)) continue;
    if (t.kind === 'income') income += t.amount;
    else expense += t.amount;
  }
  return { income, expense, net: income - expense };
}

/** Pengeluaran per kategori pada bulan tertentu */
export function spendByCategory(txs: Transaction[], key: string, forWhom?: 'self' | 'couple') {
  const m = new Map<number, number>();
  for (const t of txs) {
    if (!isReportable(t) || t.kind !== 'expense' || !inMonth(t, key)) continue;
    if (forWhom && t.forWhom !== forWhom) continue;
    m.set(t.categoryId!, (m.get(t.categoryId!) ?? 0) + t.amount);
  }
  return m;
}

export interface DailyStats {
  mu: number;
  sigma: number;
  days: number;
  source: 'history' | 'estimate';
}

export const MIN_HISTORY_DAYS = 14;
const WINDOW = 30;

/**
 * Rata-rata (μ) dan standar deviasi (σ) pengeluaran harian, 30 hari terakhir.
 * Tidak termasuk: transfer, koreksi saldo, kategori bukan konsumsi (Investasi), realisasi rencana.
 */
export function dailySpendStats(txs: Transaction[], categories: Category[], today: Date, estimate: number): DailyStats {
  const nonConsumption = new Set(categories.filter((c) => !c.isConsumption).map((c) => c.id));
  const relevant = txs.filter((t) => t.source !== 'adjustment' && t.status !== 'ignored');
  if (relevant.length === 0) return fallback(estimate, 0);
  const first = relevant.reduce((min, t) => (t.date < min ? t.date : min), relevant[0].date);
  const historyDays = Math.min(WINDOW, daysBetween(new Date(first), today) + 1);
  if (historyDays < MIN_HISTORY_DAYS) return fallback(estimate, historyDays);

  const daily = new Array(historyDays).fill(0);
  const t0 = startOfDay(today);
  for (const t of relevant) {
    if (t.kind !== 'expense' || t.transfer || t.planId != null) continue;
    if (t.categoryId != null && nonConsumption.has(t.categoryId)) continue;
    const ago = daysBetween(new Date(t.date), t0);
    if (ago < 0 || ago >= historyDays) continue;
    daily[ago] += t.amount;
  }
  const mu = daily.reduce((a, b) => a + b, 0) / historyDays;
  const variance = daily.reduce((a, b) => a + (b - mu) ** 2, 0) / Math.max(1, historyDays - 1);
  return { mu, sigma: Math.sqrt(variance), days: historyDays, source: 'history' };
}

function fallback(estimate: number, days: number): DailyStats {
  return { mu: estimate, sigma: estimate * 0.6, days, source: 'estimate' };
}
