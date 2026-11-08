import type { Store } from '../hooks';
import { projectPlans, type ProjectionResult } from './projection';
import { dailySpendStats, totalBalance, type DailyStats } from './stats';

export interface FullProjection extends ProjectionResult {
  balance: number;
  stats: DailyStats;
  monthlyIncome: number;
}

/** Gabungkan data toko + statistik harian + proyeksi rencana. */
export function computeProjection(store: Store, today = new Date()): FullProjection {
  const balance = totalBalance(store.accounts, store.transactions);
  const stats = dailySpendStats(store.transactions, store.categories, today, store.dailyEstimate);
  const result = projectPlans({
    today, balance,
    incomes: store.incomes.map((i) => ({ amount: i.amount, dayOfMonth: i.dayOfMonth })),
    mu: stats.mu, sigma: stats.sigma, plans: store.plans
  });
  return { ...result, balance, stats, monthlyIncome: store.incomes.reduce((s, i) => s + i.amount, 0) };
}

export const STATUS_COLOR = { green: 'var(--in)', yellow: 'var(--warn)', red: 'var(--out)' } as const;
export const STATUS_LABEL = { green: '🟢 Aman', yellow: '🟡 Waspada', red: '🔴 Kurang' } as const;
