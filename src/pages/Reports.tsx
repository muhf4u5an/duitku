import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArcElement, BarElement, CategoryScale, Chart as ChartJS, LinearScale, Tooltip } from 'chart.js';
import { Bar as BarChart, Doughnut } from 'react-chartjs-2';
import { useStore } from '../hooks';
import type { ForWhom } from '../types';
import { Bar, Empty, TxRow } from '../components/ui';
import { MONTHS_SHORT, monthKey, monthLabel, num, rp, rpShort, shiftMonth } from '../lib/format';
import { inMonth, isReportable, monthTotals, spendByCategory } from '../lib/stats';

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip);

export default function Reports() {
  const store = useStore();
  const nav = useNavigate();
  const [month, setMonth] = useState(monthKey(new Date()));
  const [who, setWho] = useState<ForWhom | 'all'>('all');
  const [openCat, setOpenCat] = useState<number | null>(null);
  const [q, setQ] = useState('');

  const data = useMemo(() => {
    if (!store) return null;
    const filter = who === 'all' ? undefined : who;
    const byCat = [...spendByCategory(store.transactions, month, filter).entries()]
      .map(([id, v]) => ({ cat: store.catById.get(id)!, v }))
      .filter((x) => x.cat)
      .sort((a, b) => b.v - a.v);
    const total = byCat.reduce((s, x) => s + x.v, 0);
    const all = [...spendByCategory(store.transactions, month).values()].reduce((a, b) => a + b, 0);
    const couple = [...spendByCategory(store.transactions, month, 'couple').values()].reduce((a, b) => a + b, 0);
    const trend = Array.from({ length: 6 }, (_, i) => {
      const k = shiftMonth(month, i - 5);
      return { k, ...monthTotals(store.transactions, k) };
    });
    const spendAll = spendByCategory(store.transactions, month);
    const budgets = store.budgets
      .filter((b) => b.monthlyAmount > 0 && store.catById.get(b.categoryId))
      .map((b) => ({ cat: store.catById.get(b.categoryId)!, budget: b.monthlyAmount, used: spendAll.get(b.categoryId) ?? 0 }));
    const donePlans = store.plans.filter((p) => p.status === 'done').sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? '')).slice(0, 5);
    return { byCat, total, all, couple, trend, budgets, donePlans };
  }, [store, month, who]);

  const itemSearch = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!store || query.length < 2) return null;
    let count = 0, sum = 0, monthCount = 0, monthSum = 0;
    for (const t of store.transactions) {
      if (t.status !== 'done') continue;
      for (const it of t.items) {
        if (!it.name.toLowerCase().includes(query)) continue;
        count++; sum += it.price;
        if (inMonth(t, month)) { monthCount++; monthSum += it.price; }
      }
    }
    return { count, sum, monthCount, monthSum };
  }, [store, q, month]);

  if (!store || !data) return null;
  const muted = getComputedStyle(document.documentElement).getPropertyValue('--muted').trim() || '#7A7990';

  return (
    <div className="page">
      <div className="hdr">
        <button className="iconbtn" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Bulan sebelumnya">‹</button>
        <div className="center"><div className="sub">Laporan</div><h1 style={{ fontSize: 22 }}>{monthLabel(month)}</h1></div>
        <button className="iconbtn" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Bulan berikutnya">›</button>
      </div>
      <div className="seg">
        <button className={who === 'all' ? 'on' : ''} onClick={() => setWho('all')}>Semua</button>
        <button className={who === 'self' ? 'on' : ''} onClick={() => setWho('self')}>👤 Sendiri</button>
        <button className={who === 'couple' ? 'on' : ''} onClick={() => setWho('couple')}>💑 Berdua</button>
      </div>

      <div className="card">
        <h3>Pengeluaran per kategori</h3>
        {data.byCat.length === 0 ? (
          <Empty icon="📊" title="Belum ada data" text="Rapikan transaksi di Inbox supaya muncul di sini." />
        ) : (
          <div className="row" style={{ gap: 14, alignItems: 'center' }}>
            <div style={{ width: 140, height: 140, position: 'relative', flex: '0 0 auto' }}>
              <Doughnut
                data={{ labels: data.byCat.map((x) => x.cat.name), datasets: [{ data: data.byCat.map((x) => x.v), backgroundColor: data.byCat.map((x) => x.cat.color), borderWidth: 0 }] }}
                options={{ cutout: '68%', plugins: { tooltip: { callbacks: { label: (c) => ` ${rp(c.parsed)}` } } }, onClick: (_, el) => el[0] && setOpenCat(data.byCat[el[0].index].cat.id!) }}
              />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <b>{rpShort(data.total)}</b><span className="tiny muted">total keluar</span>
              </div>
            </div>
            <div className="legend">
              {data.byCat.map((x) => (
                <button key={x.cat.id} onClick={() => setOpenCat(openCat === x.cat.id ? null : x.cat.id!)}>
                  <i style={{ background: x.cat.color }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.cat.icon} {x.cat.name}</span>
                  <span className="v">{Math.round((x.v / data.total) * 100)}%</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {openCat != null && (
          <div className="mt12">
            <div className="between small bold"><span>{store.catById.get(openCat)?.icon} {store.catById.get(openCat)?.name}</span><button className="link" onClick={() => setOpenCat(null)}>Tutup</button></div>
            {store.transactions
              .filter((t) => isReportable(t) && t.categoryId === openCat && inMonth(t, month) && (who === 'all' || t.forWhom === who))
              .map((t) => (
                <div key={t.id}>
                  <TxRow tx={t} account={store.accById.get(t.accountId)} cat={store.catById.get(openCat)} onClick={() => nav(`/tx/${t.id}`)} />
                  {t.items.length > 1 && (
                    <div className="tiny muted" style={{ margin: '-4px 0 8px 49px' }}>{t.items.map((i) => `${i.name} ${num(i.price)}`).join(' · ')}</div>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>

      <div className="card row">
        <div className="cat" style={{ background: 'var(--couple-soft)' }}>💑</div>
        <div className="grow">
          <div className="small bold">Berdua bulan ini</div>
          <div className="tiny muted">{data.all ? Math.round((data.couple / data.all) * 100) : 0}% dari total pengeluaran</div>
        </div>
        <b style={{ color: 'var(--couple)' }}>{rp(data.couple)}</b>
      </div>

      <div className="card">
        <h3>Tren 6 bulan <span className="tiny muted" style={{ fontWeight: 500 }}><span className="pos">■</span> masuk <span className="neg">■</span> keluar</span></h3>
        <div style={{ height: 170 }}>
          <BarChart
            data={{
              labels: data.trend.map((t) => MONTHS_SHORT[Number(t.k.split('-')[1]) - 1]),
              datasets: [
                { label: 'Masuk', data: data.trend.map((t) => t.income), backgroundColor: '#16A085', borderRadius: 5, maxBarThickness: 14 },
                { label: 'Keluar', data: data.trend.map((t) => t.expense), backgroundColor: '#E8505B', borderRadius: 5, maxBarThickness: 14 }
              ]
            }}
            options={{
              maintainAspectRatio: false,
              scales: {
                x: { grid: { display: false }, ticks: { color: muted } },
                y: { grid: { display: false }, border: { display: false }, ticks: { color: muted, callback: (v) => rpShort(Number(v)), maxTicksLimit: 4 } }
              },
              plugins: { tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${rp(c.parsed.y ?? 0)}` } } }
            }}
          />
        </div>
      </div>

      {data.budgets.length > 0 && (
        <div className="card">
          <h3>Budget vs aktual</h3>
          {data.budgets.map((b) => (
            <div className="bud" key={b.cat.id}>
              <div className="r"><span>{b.cat.icon} {b.cat.name}</span><span><b className={b.used > b.budget ? 'neg' : ''}>{rpShort(b.used)}</b> / {rpShort(b.budget)}</span></div>
              <Bar ratio={b.used / b.budget} />
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <h3>Cari item</h3>
        <input className="inp" placeholder="🔍 kopi" value={q} onChange={(e) => setQ(e.target.value)} />
        {itemSearch && (
          itemSearch.count === 0 ? <div className="small muted mt8">Tidak ada item "{q}" di rincian transaksi.</div> : (
            <div className="mt12 small">
              <div className="between"><span>{monthLabel(month)}: {itemSearch.monthCount}×</span><b className="neg">{rp(itemSearch.monthSum)}</b></div>
              <div className="between mt8"><span className="muted">Sepanjang waktu: {itemSearch.count}×</span><b>{rp(itemSearch.sum)}</b></div>
            </div>
          )
        )}
      </div>

      {data.donePlans.length > 0 && (
        <div className="card">
          <h3>Rencana selesai: budget vs aktual</h3>
          {data.donePlans.map((p) => {
            const diff = p.target - (p.actualAmount ?? 0);
            return (
              <button key={p.id} className="tx" onClick={() => nav(`/plans/${p.id}`)}>
                <div className="cat" style={{ background: 'var(--primary-soft)' }}>{p.icon}</div>
                <div className="grow"><div className="nm">{p.name}</div><div className="ds">Budget {rp(p.target)} · aktual {rp(p.actualAmount ?? 0)}</div></div>
                <div className={`am ${diff >= 0 ? 'pos' : 'neg'}`}>{diff >= 0 ? 'hemat ' : 'lebih '}{rpShort(Math.abs(diff))}</div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
