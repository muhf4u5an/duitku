import { useNavigate } from 'react-router-dom';
import { useStore } from '../hooks';
import { Bar, Empty } from '../components/ui';
import { dateLong, parseYMD, rp, rpShort } from '../lib/format';
import { computeProjection, STATUS_COLOR, STATUS_LABEL } from '../lib/planCalc';
import type { PlanProjection } from '../lib/projection';

export function PlanCard({ p, onClick }: { p: PlanProjection; onClick: () => void }) {
  const color = STATUS_COLOR[p.status];
  const due = p.plan.dueDate ? parseYMD(p.plan.dueDate) : null;
  return (
    <button className="plan" onClick={onClick}>
      <div className="row">
        <div className="cat" style={{ background: p.plan.forWhom === 'couple' ? 'var(--couple-soft)' : 'var(--primary-soft)' }}>{p.plan.icon}</div>
        <div className="grow">
          <div className="bold" style={{ fontSize: 15 }}>{p.plan.name}</div>
          <div className="tiny muted">
            {due ? `${dateLong(due)} · ${p.days === 0 ? 'hari ini' : `${p.days} hari lagi`}` : 'Tanpa tanggal'} · {p.plan.forWhom === 'couple' ? '💑' : '👤'}
          </div>
        </div>
        <div className="pct"><b style={{ color }}>{Math.round(p.readiness * 100)}%</b><div className="tiny muted">kesiapan</div></div>
      </div>
      <div className="mt12"><Bar ratio={p.readiness} color={color} /></div>
      <div className="stats">
        <div><div className="k">Target</div><div className="x">{rpShort(p.plan.target)}</div></div>
        {p.probability != null ? (
          <>
            <div><div className="k">Peluang</div><div className="x" style={{ color }}>{Math.round(p.probability * 100)}%</div></div>
            {p.shortfall > 0
              ? <div><div className="k">Kurang</div><div className="x neg">{rpShort(p.shortfall)}</div></div>
              : <div><div className="k">Status</div><div className="x" style={{ color }}>{STATUS_LABEL[p.status]}</div></div>}
          </>
        ) : (
          <div style={{ flex: 2 }}>
            <div className="k">Perkiraan tercapai</div>
            <div className="x" style={{ color }}>{p.readiness >= 1 ? 'Sudah bisa sekarang' : p.estimatedDate ? `~ ${dateLong(p.estimatedDate)}` : 'Belum terjangkau'}</div>
          </div>
        )}
      </div>
      {p.probability != null && p.shortfall > 0 && (
        <div className="advice" style={{ background: 'var(--out-soft)', color: 'var(--out)' }}>
          💡 Hemat <b>{rp(Math.ceil(p.savePerDay))}/hari</b> atau tambah dana {rp(p.shortfall)}
        </div>
      )}
    </button>
  );
}

export default function Plans() {
  const store = useStore();
  const nav = useNavigate();
  if (!store) return null;
  const proj = computeProjection(store);
  const done = store.plans.filter((p) => p.status !== 'active').sort((a, b) => (b.doneAt ?? b.createdAt).localeCompare(a.doneAt ?? a.createdAt));

  return (
    <div className="page">
      <div className="hdr">
        <div><div className="sub">Proyeksi otomatis dari polamu</div><h1>Rencana</h1></div>
        <button className="iconbtn" onClick={() => nav('/plans/new')} aria-label="Rencana baru">＋</button>
      </div>

      <div className="card" style={{ marginTop: 0 }}>
        <div className="small muted">Saldo bebas setelah semua rencana (per {dateLong(proj.freeBalanceDate)})</div>
        <div className={`bold ${proj.freeBalance < 0 ? 'neg' : 'pos'}`} style={{ fontSize: 26, margin: '2px 0 8px' }}>{rp(proj.freeBalance)}</div>
        <div className="chips">
          <button className="pill" style={{ background: 'var(--in-soft)', color: 'var(--in)' }} onClick={() => nav('/settings#income')}>
            💰 {store.incomes.length ? store.incomes.map((i) => `${rpShort(i.amount)} tgl ${i.dayOfMonth}`).join(', ') : 'Atur pemasukan rutin'}
          </button>
          <button className="pill" style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }} onClick={() => nav('/settings#estimate')}>
            📉 {proj.stats.source === 'estimate' ? 'estimasi' : 'rata-rata'} {rpShort(proj.stats.mu)}/hari
          </button>
          <button className="pill" style={{ background: 'var(--field)', color: 'var(--text)' }} onClick={() => nav('/add?kind=income&preset=dana')}>＋ Tambah dana</button>
        </div>
        {proj.stats.source === 'estimate' && (
          <div className="tiny muted mt8">Riwayatmu belum 14 hari, jadi pengeluaran harian memakai estimasi yang kamu isi. Setelah itu dihitung otomatis dari data asli.</div>
        )}
      </div>

      {proj.items.length === 0 && (
        <Empty icon="🎯" title="Belum ada rencana" text="Catat pengeluaran masa depan: kado, bunga, atau barang incaran.">
          <button className="btn sm mt12" onClick={() => nav('/plans/new')}>＋ Buat rencana</button>
        </Empty>
      )}
      {proj.items.map((p) => <PlanCard key={p.plan.id} p={p} onClick={() => nav(`/plans/${p.plan.id}`)} />)}
      {proj.items.length > 0 && <div className="tiny muted center mt12">Ketuk rencana untuk melihat rincian perhitungannya</div>}

      {done.length > 0 && (
        <div className="card">
          <h3>Selesai & dibatalkan</h3>
          {done.map((p) => (
            <button key={p.id} className="tx" onClick={() => nav(`/plans/${p.id}`)}>
              <div className="cat" style={{ background: 'var(--field)' }}>{p.icon}</div>
              <div className="grow">
                <div className="nm">{p.name}</div>
                <div className="ds">{p.status === 'cancelled' ? 'Dibatalkan' : `Budget ${rp(p.target)} · aktual ${rp(p.actualAmount ?? 0)}`}</div>
              </div>
              {p.status === 'done' && (
                <div className={`am ${(p.actualAmount ?? 0) <= p.target ? 'pos' : 'neg'}`}>
                  {(p.actualAmount ?? 0) <= p.target ? '✓' : '+'}{(p.actualAmount ?? 0) > p.target ? rpShort((p.actualAmount ?? 0) - p.target) : ''}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
