/**
 * Logika Rencana & Target. Tanpa AI, cuma statistik dasar:
 *  - Proyeksi saldo:  B = Saldo + Pemasukan_rutin − n·μ − Rencana_sebelumnya
 *  - Kesiapan       = clamp(B / target, 0..1)
 *  - Peluang        = Φ((B − target) / (σ·√n))   (distribusi normal)
 * Rencana berbatas tanggal dialokasikan berurutan (tenggat terdekat dulu, mirip MRP netting).
 */
import type { Plan } from '../types';
import { daysBetween, startOfDay, parseYMD } from './format';

export interface IncomeRule {
  amount: number;
  dayOfMonth: number;
}

export interface ProjectionInput {
  today: Date;
  balance: number;
  incomes: IncomeRule[];
  mu: number;
  sigma: number;
  plans: Plan[];
}

export type PlanStatusColor = 'green' | 'yellow' | 'red';

export interface PlanProjection {
  plan: Plan;
  /** hari sampai tenggat (null untuk wishlist) */
  days: number | null;
  incomeUntil: number;
  spendUntil: number;
  prevPlans: number;
  projected: number;
  readiness: number;
  probability: number | null;
  shortfall: number;
  savePerDay: number;
  status: PlanStatusColor;
  /** perkiraan tanggal tercapai, khusus wishlist */
  estimatedDate?: Date | null;
}

export interface ProjectionResult {
  items: PlanProjection[];
  freeBalance: number;
  freeBalanceDate: Date;
}

const MAX_SEARCH_DAYS = 730;

/** Total pemasukan rutin yang jatuh di (from, to] */
export function incomeBetween(incomes: IncomeRule[], from: Date, to: Date): number {
  const a = startOfDay(from).getTime();
  const b = startOfDay(to).getTime();
  if (b <= a || incomes.length === 0) return 0;
  let total = 0;
  const cur = new Date(from.getFullYear(), from.getMonth(), 1);
  const end = new Date(to.getFullYear(), to.getMonth(), 1);
  while (cur.getTime() <= end.getTime()) {
    const y = cur.getFullYear();
    const m = cur.getMonth();
    const dim = new Date(y, m + 1, 0).getDate();
    for (const inc of incomes) {
      const occ = new Date(y, m, Math.min(Math.max(1, inc.dayOfMonth), dim)).getTime();
      if (occ > a && occ <= b) total += inc.amount;
    }
    cur.setMonth(cur.getMonth() + 1);
  }
  return total;
}

/** CDF distribusi normal standar (pendekatan Abramowitz–Stegun 7.1.26) */
export function normalCdf(z: number): number {
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

function statusFromProbability(p: number): PlanStatusColor {
  if (p >= 0.8) return 'green';
  if (p >= 0.5) return 'yellow';
  return 'red';
}

function addDays(d: Date, n: number): Date {
  const r = startOfDay(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function projectPlans(input: ProjectionInput): ProjectionResult {
  const { today, balance, incomes, mu, sigma } = input;
  const active = input.plans.filter((p) => p.status === 'active');
  const dated = active.filter((p) => p.dueDate).sort((a, b) => a.dueDate!.localeCompare(b.dueDate!));
  const undated = active.filter((p) => !p.dueDate).sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const items: PlanProjection[] = [];
  let prev = 0;

  for (const plan of dated) {
    const due = parseYMD(plan.dueDate!);
    const n = Math.max(0, daysBetween(today, due));
    const incomeUntil = incomeBetween(incomes, today, due);
    const spendUntil = n * mu;
    const projected = balance + incomeUntil - spendUntil - prev;
    const readiness = plan.target > 0 ? clamp01(projected / plan.target) : 1;
    const sd = sigma * Math.sqrt(n);
    const probability = sd > 0 ? normalCdf((projected - plan.target) / sd) : projected >= plan.target ? 1 : 0;
    const shortfall = Math.max(0, plan.target - projected);
    items.push({
      plan, days: n, incomeUntil, spendUntil, prevPlans: prev, projected, readiness, probability,
      shortfall, savePerDay: n > 0 ? shortfall / n : shortfall, status: statusFromProbability(probability)
    });
    prev += plan.target;
  }

  const datedTotal = prev;
  let undatedPrev = 0;
  for (const plan of undated) {
    const committed = datedTotal + undatedPrev;
    const now = balance - committed;
    let estimatedDate: Date | null = null;
    for (let n = 0; n <= MAX_SEARCH_DAYS; n++) {
      const d = addDays(today, n);
      const b = balance + incomeBetween(incomes, today, d) - n * mu - committed;
      if (b >= plan.target) {
        estimatedDate = d;
        break;
      }
    }
    const readiness = plan.target > 0 ? clamp01(now / plan.target) : 1;
    const shortfall = Math.max(0, plan.target - now);
    items.push({
      plan, days: null, incomeUntil: 0, spendUntil: 0, prevPlans: committed, projected: now, readiness,
      probability: null, shortfall, savePerDay: 0,
      status: readiness >= 1 ? 'green' : estimatedDate ? 'yellow' : 'red',
      estimatedDate
    });
    undatedPrev += plan.target;
  }

  let freeBalanceDate: Date;
  if (dated.length) freeBalanceDate = parseYMD(dated[dated.length - 1].dueDate!);
  else freeBalanceDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  if (freeBalanceDate.getTime() < startOfDay(today).getTime()) freeBalanceDate = startOfDay(today);
  const nFree = Math.max(0, daysBetween(today, freeBalanceDate));
  const freeBalance = balance + incomeBetween(incomes, today, freeBalanceDate) - nFree * mu - datedTotal;

  return { items, freeBalance, freeBalanceDate };
}
