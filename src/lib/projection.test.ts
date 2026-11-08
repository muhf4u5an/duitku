import { describe, expect, it } from 'vitest';
import { incomeBetween, normalCdf, projectPlans } from './projection';
import { dailySpendStats } from './stats';
import { merchantKey } from './merchantRules';
import { parseAmount, rp, rpShort } from './format';
import type { Category, Plan, Transaction } from '../types';

const plan = (p: Partial<Plan>): Plan => ({
  name: 'x', icon: '🎯', target: 0, forWhom: 'self', note: '', status: 'active',
  realizedTxIds: [], createdAt: '2026-11-01T00:00:00.000Z', ...p
});

describe('projectPlans', () => {
  const today = new Date(2026, 10, 8); // 8 Nov 2026

  it('cocok dengan contoh di rencana (bunga & kado)', () => {
    const r = projectPlans({
      today, balance: 2_000_000, incomes: [{ amount: 3_000_000, dayOfMonth: 1 }], mu: 80_000, sigma: 40_000,
      plans: [
        plan({ id: 1, name: 'Bunga', target: 150_000, dueDate: '2026-11-15' }),
        plan({ id: 2, name: 'Kado', target: 500_000, dueDate: '2026-11-30' })
      ]
    });
    const [bunga, kado] = r.items;
    expect(bunga.days).toBe(7);
    expect(bunga.projected).toBe(1_440_000);
    expect(bunga.readiness).toBe(1);
    expect(bunga.status).toBe('green');

    expect(kado.days).toBe(22);
    expect(kado.prevPlans).toBe(150_000);
    expect(kado.projected).toBe(90_000);
    expect(Math.round(kado.readiness * 100)).toBe(18);
    expect(kado.shortfall).toBe(410_000);
    expect(Math.round(kado.savePerDay)).toBe(18_636);
    expect(kado.status).toBe('red');

    expect(r.freeBalance).toBe(-410_000);
  });

  it('memasukkan pemasukan rutin yang jatuh sebelum tenggat', () => {
    const r = projectPlans({
      today, balance: 500_000, incomes: [{ amount: 3_000_000, dayOfMonth: 1 }], mu: 50_000, sigma: 0,
      plans: [plan({ target: 1_000_000, dueDate: '2026-12-05' })]
    });
    // 27 hari: 500rb + 3jt − 27×50rb = 2.150.000
    expect(r.items[0].projected).toBe(2_150_000);
    expect(r.items[0].probability).toBe(1);
  });

  it('wishlist tanpa tanggal mendapat perkiraan tanggal', () => {
    const r = projectPlans({
      today, balance: 200_000, incomes: [{ amount: 3_000_000, dayOfMonth: 1 }], mu: 50_000, sigma: 10_000,
      plans: [plan({ target: 1_200_000 })]
    });
    const w = r.items[0];
    expect(w.days).toBeNull();
    expect(w.estimatedDate?.getMonth()).toBe(11); // Desember (setelah uang bulanan masuk)
    expect(w.status).toBe('yellow');
  });
});

describe('helper', () => {
  it('incomeBetween menangani tanggal 31 di bulan pendek', () => {
    expect(incomeBetween([{ amount: 100, dayOfMonth: 31 }], new Date(2026, 1, 1), new Date(2026, 2, 1))).toBe(100);
  });
  it('normalCdf', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 5);
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 3);
    expect(normalCdf(-1.96)).toBeCloseTo(0.025, 3);
  });
  it('merchantKey membuang kata berangka', () => {
    expect(merchantKey('SPBU PERTAMINA 34.123')).toBe('SPBU PERTAMINA');
    expect(merchantKey('Spbu Pertamina 34.999')).toBe('SPBU PERTAMINA');
  });
  it('format Rupiah', () => {
    expect(rp(45000)).toBe('Rp45.000');
    expect(rpShort(1_250_000)).toBe('1,25 jt');
    expect(rpShort(450_000)).toBe('450rb');
    expect(parseAmount('Rp 12.500')).toBe(12500);
  });
});

describe('dailySpendStats', () => {
  const cats: Category[] = [
    { id: 1, name: 'Makan', icon: '', color: '', kind: 'expense', isConsumption: true, archived: false, order: 0 },
    { id: 2, name: 'Investasi', icon: '', color: '', kind: 'expense', isConsumption: false, archived: false, order: 1 }
  ];
  const tx = (daysAgo: number, amount: number, categoryId = 1): Transaction => {
    const d = new Date(2026, 10, 30 - daysAgo, 12);
    return { status: 'done', source: 'manual', accountId: 1, kind: 'expense', amount, counterparty: '', date: d.toISOString(), categoryId, items: [], note: '', photoIds: [], createdAt: d.toISOString() };
  };

  it('pakai estimasi kalau riwayat < 14 hari', () => {
    const s = dailySpendStats([tx(2, 10000)], cats, new Date(2026, 10, 30), 70000);
    expect(s.source).toBe('estimate');
    expect(s.mu).toBe(70000);
  });

  it('mengabaikan investasi dan menghitung rata-rata 30 hari', () => {
    const txs = [tx(29, 0), ...Array.from({ length: 30 }, (_, i) => tx(i, 60000)), tx(3, 5_000_000, 2)];
    const s = dailySpendStats(txs, cats, new Date(2026, 10, 30), 0);
    expect(s.source).toBe('history');
    expect(s.mu).toBe(60000);
    expect(s.sigma).toBe(0);
  });
});
