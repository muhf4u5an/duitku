import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../db';
import { useStore } from '../hooks';
import { AmountInput, BackHeader, Sheet, TxRow, useToast } from '../components/ui';
import { dateLong, parseYMD, rp } from '../lib/format';
import { computeProjection } from '../lib/planCalc';
import { PlanCard } from './Plans';

export default function PlanDetail() {
  const { id } = useParams();
  const planId = Number(id);
  const store = useStore();
  const nav = useNavigate();
  const toast = useToast();
  const [doneSheet, setDoneSheet] = useState(false);
  const [actual, setActual] = useState(0);
  const [delSheet, setDelSheet] = useState(false);

  if (!store) return null;
  const plan = store.plans.find((p) => p.id === planId);
  if (!plan) return <div className="page no-tab"><BackHeader title="Rencana" /><div className="empty">Rencana tidak ditemukan.</div></div>;
  const proj = computeProjection(store);
  const p = proj.items.find((x) => x.plan.id === planId);
  const linked = store.transactions.filter((t) => t.planId === planId && t.status !== 'ignored');

  return (
    <div className="page no-tab">
      <BackHeader title="Detail rencana" right={<button className="link" onClick={() => nav(`/plans/${planId}/edit`)}>Ubah</button>} />

      {p && <PlanCard p={p} onClick={() => {}} />}

      {p && p.days != null && (
        <div className="card">
          <h3>Rincian perhitungan</h3>
          <table className="calc">
            <tbody>
              <tr><td>Saldo sekarang (semua akun)</td><td>{rp(proj.balance)}</td></tr>
              <tr><td>＋ Pemasukan rutin sampai {dateLong(parseYMD(plan.dueDate!))}</td><td className="pos">{rp(p.incomeUntil)}</td></tr>
              <tr><td>− Perkiraan pengeluaran ({p.days} hari × {rp(proj.stats.mu)})</td><td className="neg">{rp(-p.spendUntil)}</td></tr>
              <tr><td>− Rencana yang jatuh tempo lebih dulu</td><td className="neg">{rp(-p.prevPlans)}</td></tr>
              <tr className="total"><td>= Proyeksi saldo saat tenggat</td><td>{rp(p.projected)}</td></tr>
            </tbody>
          </table>
          <div className="small muted mt12">
            Kesiapan = proyeksi ÷ target = {rp(p.projected)} ÷ {rp(plan.target)} = <b>{Math.round(p.readiness * 100)}%</b>.
            <br />Peluang dihitung dari naik-turunnya pengeluaran harianmu (σ = {rp(proj.stats.sigma)}/hari) dengan distribusi normal: kemungkinan saldo saat tenggat ≥ target = <b>{Math.round((p.probability ?? 0) * 100)}%</b>.
            {proj.stats.source === 'estimate' && <><br />⚠️ Masih memakai estimasi harian karena riwayat belum 14 hari.</>}
          </div>
        </div>
      )}

      {p && p.days == null && (
        <div className="card">
          <h3>Rincian perhitungan</h3>
          <table className="calc">
            <tbody>
              <tr><td>Saldo sekarang</td><td>{rp(proj.balance)}</td></tr>
              <tr><td>− Rencana lain yang didahulukan</td><td className="neg">{rp(-p.prevPlans)}</td></tr>
              <tr className="total"><td>= Bisa dipakai sekarang</td><td>{rp(p.projected)}</td></tr>
            </tbody>
          </table>
          <div className="small muted mt12">
            Perkiraan tanggal dicari dengan mensimulasikan saldo harian: + pemasukan rutin, − rata-rata {rp(proj.stats.mu)}/hari, sampai saldo cukup untuk {rp(plan.target)}.
          </div>
        </div>
      )}

      {plan.status !== 'active' && (
        <div className="card">
          <h3>{plan.status === 'done' ? '✅ Terealisasi' : '✖️ Dibatalkan'}</h3>
          {plan.status === 'done' && (
            <table className="calc">
              <tbody>
                <tr><td>Budget</td><td>{rp(plan.target)}</td></tr>
                <tr><td>Aktual</td><td>{rp(plan.actualAmount ?? 0)}</td></tr>
                <tr className="total"><td>{(plan.actualAmount ?? 0) <= plan.target ? 'Hemat' : 'Lebih dari budget'}</td>
                  <td className={(plan.actualAmount ?? 0) <= plan.target ? 'pos' : 'neg'}>{rp(Math.abs(plan.target - (plan.actualAmount ?? 0)))}</td></tr>
              </tbody>
            </table>
          )}
        </div>
      )}

      {linked.length > 0 && (
        <div className="card">
          <h3>Transaksi realisasi</h3>
          {linked.map((t) => <TxRow key={t.id} tx={t} account={store.accById.get(t.accountId)} cat={t.categoryId != null ? store.catById.get(t.categoryId) : undefined} onClick={() => nav(`/tx/${t.id}`)} />)}
        </div>
      )}

      {plan.note && <div className="card"><h3>Catatan</h3><div className="small">{plan.note}</div></div>}

      {plan.status === 'active' ? (
        <>
          <div className="tiny muted mt16 center">Cara terbaik: saat transaksinya muncul di Inbox, pilih rencana ini di bagian "Realisasi rencana?".</div>
          <div className="btnrow">
            <button className="btn ghost" onClick={async () => { await db.plans.update(planId, { status: 'cancelled', doneAt: new Date().toISOString() }); toast('Rencana dibatalkan'); }}>Batalkan</button>
            <button className="btn" onClick={() => { setActual(plan.target); setDoneSheet(true); }}>Tandai selesai</button>
          </div>
        </>
      ) : (
        <div className="btnrow">
          <button className="btn ghost" onClick={async () => { await db.plans.update(planId, { status: 'active', doneAt: undefined }); toast('Rencana diaktifkan lagi'); }}>Aktifkan lagi</button>
        </div>
      )}
      <button className="btn danger mt12" onClick={() => setDelSheet(true)}>Hapus rencana</button>

      <Sheet open={doneSheet} onClose={() => setDoneSheet(false)}>
        <h2>Tandai selesai</h2>
        <div className="small muted">Berapa yang sebenarnya kamu keluarkan? Ini hanya mencatat budget vs aktual. Transaksinya tetap dicatat terpisah.</div>
        <div className="field"><label>Aktual (Rp)</label><AmountInput value={actual} onChange={setActual} className="inp amount" /></div>
        <div className="btnrow">
          <button className="btn ghost" onClick={() => setDoneSheet(false)}>Batal</button>
          <button className="btn" onClick={async () => {
            await db.plans.update(planId, { status: 'done', actualAmount: actual, doneAt: new Date().toISOString() });
            setDoneSheet(false);
            toast('Rencana selesai 🎉');
          }}>Simpan</button>
        </div>
      </Sheet>

      <Sheet open={delSheet} onClose={() => setDelSheet(false)}>
        <h2>Hapus rencana "{plan.name}"?</h2>
        <div className="small muted">Rencana dihapus permanen. Transaksi yang terhubung tetap ada, hanya tautannya yang dilepas.</div>
        <div className="btnrow">
          <button className="btn ghost" onClick={() => setDelSheet(false)}>Batal</button>
          <button className="btn danger" onClick={async () => {
            await db.transaction('rw', db.plans, db.transactions, async () => {
              await db.transactions.where('planId').equals(planId).modify({ planId: undefined });
              await db.plans.delete(planId);
            });
            toast('Rencana dihapus');
            nav('/plans', { replace: true });
          }}>Hapus</button>
        </div>
      </Sheet>
    </div>
  );
}
