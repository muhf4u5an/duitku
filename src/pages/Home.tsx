import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useStore } from '../hooks';
import { Bar, TxRow } from '../components/ui';
import { MONTHS, daysBetween, monthKey, rp, rpShort } from '../lib/format';
import { accountBalances, monthTotals, spendByCategory } from '../lib/stats';
import { computeProjection, STATUS_COLOR } from '../lib/planCalc';

function greeting() {
  const h = new Date().getHours();
  if (h < 11) return 'Selamat pagi';
  if (h < 15) return 'Selamat siang';
  if (h < 19) return 'Selamat sore';
  return 'Selamat malam';
}

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

export default function Home() {
  const store = useStore();
  const nav = useNavigate();
  const lastBackup = useLiveQuery(async () => ((await db.meta.get('lastBackupAt'))?.value as string | undefined) ?? '', []);
  if (!store || lastBackup === undefined) return null;

  const now = new Date();
  const mk = monthKey(now);
  const balances = accountBalances(store.accounts, store.transactions);
  const total = [...balances.values()].reduce((a, b) => a + b, 0);
  const totals = monthTotals(store.transactions, mk);
  const inboxCount = store.transactions.filter((t) => t.status === 'inbox').length;
  const spend = spendByCategory(store.transactions, mk);
  const budgets = store.budgets
    .filter((b) => b.monthlyAmount > 0 && store.catById.get(b.categoryId) && !store.catById.get(b.categoryId)!.archived)
    .map((b) => ({ b, cat: store.catById.get(b.categoryId)!, used: spend.get(b.categoryId) ?? 0 }))
    .sort((x, y) => y.used / y.b.monthlyAmount - x.used / x.b.monthlyAmount)
    .slice(0, 3);
  const proj = computeProjection(store, now);
  const nextPlan = proj.items[0];
  const recent = store.transactions.filter((t) => t.status !== 'ignored').slice(0, 5);
  const needsSetup = store.transactions.length === 0 && store.accounts.every((a) => a.initialBalance === 0);
  const backupDue = store.transactions.length >= 5 && (!lastBackup || daysBetween(new Date(lastBackup), now) >= 7);

  return (
    <div className="page">
      <div className="hdr">
        <div><div className="sub">{greeting()} 👋</div><h1>{MONTHS[now.getMonth()]}</h1></div>
        <button className="iconbtn" onClick={() => nav('/settings')} aria-label="Pengaturan">⚙️</button>
      </div>

      {isIOS && !isStandalone && (
        <div className="banner" style={{ background: 'var(--primary-soft)', marginTop: 0, marginBottom: 12 }}>
          📲 <div className="small"><b>Pasang ke Home Screen</b><br />Ketuk tombol Share <b>⬆︎</b> di Safari → <b>Add to Home Screen</b>. Data jadi lebih aman dan app bisa dibuka offline.</div>
        </div>
      )}

      <div className="balance">
        <div className="t">Total saldo</div>
        <div className="v">{rp(total)}</div>
        <div className="accts">
          {store.accounts.map((a) => (
            <div className="acct" key={a.id}><div className="n">{a.icon} {a.name}</div><div className="a">{rp(balances.get(a.id!) ?? 0)}</div></div>
          ))}
        </div>
      </div>

      {needsSetup && (
        <button className="banner" style={{ background: 'var(--primary-soft)' }} onClick={() => nav('/settings#accounts')}>
          👋 <div><b>Mulai dari sini</b><br /><span className="small muted">Isi saldo awal BSI & GoPay kamu</span></div>
          <span className="go" style={{ color: 'var(--primary)' }}>Atur →</span>
        </button>
      )}

      {inboxCount > 0 && (
        <button className="banner" style={{ background: 'var(--warn-soft)' }} onClick={() => nav('/inbox')}>
          📥 <div><b>{inboxCount} transaksi</b><br /><span className="small muted">menunggu kamu cek</span></div>
          <span className="go warn">Cek →</span>
        </button>
      )}

      {backupDue && (
        <button className="banner" style={{ background: 'var(--out-soft)' }} onClick={() => nav('/settings#backup')}>
          💾 <div><b>Waktunya backup</b><br /><span className="small muted">{lastBackup ? 'Backup terakhir lebih dari seminggu lalu' : 'Kamu belum pernah backup'}</span></div>
          <span className="go neg">Backup →</span>
        </button>
      )}

      <div className="card">
        <h3>Bulan ini</h3>
        <div className="trio">
          <div style={{ background: 'var(--in-soft)' }}><div className="k">Masuk</div><div className="x pos">{rpShort(totals.income)}</div></div>
          <div style={{ background: 'var(--out-soft)' }}><div className="k">Keluar</div><div className="x neg">{rpShort(totals.expense)}</div></div>
          <div style={{ background: 'var(--primary-soft)' }}><div className="k">Selisih</div><div className="x" style={{ color: 'var(--primary)' }}>{totals.net >= 0 ? '+' : ''}{rpShort(totals.net)}</div></div>
        </div>
      </div>

      <div className="card">
        <h3>Budget <button className="link" onClick={() => nav('/settings#budgets')}>{budgets.length ? 'Atur' : 'Buat budget'}</button></h3>
        {budgets.length === 0 && <div className="small muted">Belum ada budget. Atur batas bulanan per kategori supaya pengeluaranmu terkontrol.</div>}
        {budgets.map(({ b, cat, used }) => (
          <div className="bud" key={b.categoryId}>
            <div className="r"><span>{cat.icon} {cat.name}</span><span><b>{rpShort(used)}</b> / {rpShort(b.monthlyAmount)}</span></div>
            <Bar ratio={used / b.monthlyAmount} />
          </div>
        ))}
      </div>

      <div className="card">
        <h3>Rencana terdekat <button className="link" onClick={() => nav('/plans')}>Semua</button></h3>
        {!nextPlan && <div className="small muted">Belum ada rencana. Catat pengeluaran masa depan (kado, bunga, barang incaran) dan lihat peluang tercapainya.</div>}
        {nextPlan && (
          <button className="row" style={{ width: '100%', textAlign: 'left' }} onClick={() => nav(`/plans/${nextPlan.plan.id}`)}>
            <div className="cat" style={{ background: nextPlan.plan.forWhom === 'couple' ? 'var(--couple-soft)' : 'var(--primary-soft)' }}>{nextPlan.plan.icon}</div>
            <div className="grow">
              <div className="bold small">{nextPlan.plan.name}</div>
              <div className="tiny muted">{nextPlan.days != null ? `${nextPlan.days} hari lagi` : 'Tanpa tanggal'} · {rp(nextPlan.plan.target)}</div>
              <div className="mt8"><Bar ratio={nextPlan.readiness} color={STATUS_COLOR[nextPlan.status]} /></div>
            </div>
            <div style={{ textAlign: 'right' }}><b style={{ color: STATUS_COLOR[nextPlan.status] }}>{Math.round(nextPlan.readiness * 100)}%</b><div className="tiny muted">kesiapan</div></div>
          </button>
        )}
      </div>

      <div className="card">
        <h3>Terakhir <button className="link" onClick={() => nav('/history')}>Riwayat</button></h3>
        {recent.length === 0 && <div className="small muted">Belum ada transaksi. Ketuk ＋ di bawah untuk mencatat.</div>}
        {recent.map((t) => (
          <TxRow key={t.id} tx={t} account={store.accById.get(t.accountId)} cat={t.categoryId != null ? store.catById.get(t.categoryId) : undefined} onClick={() => nav(`/tx/${t.id}`)} />
        ))}
      </div>
    </div>
  );
}
