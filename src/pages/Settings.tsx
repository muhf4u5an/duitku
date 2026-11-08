import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, ensureSeed, getMeta, setMeta } from '../db';
import { useStore, type Store } from '../hooks';
import type { Account, Category, RecurringIncome } from '../types';
import { AmountInput, BackHeader, Sheet, useToast } from '../components/ui';
import { CategoryEditor } from '../components/CategoryEditor';
import { PinPad } from '../components/LockScreen';
import { dateLong, relDay, rp, timeHM, tint } from '../lib/format';
import { accountBalances } from '../lib/stats';
import { applyTheme, type ThemePref } from '../lib/theme';
import { hasPin, removePin, setPin } from '../lib/pin';
import { getGmailConfig, syncGmail, testGmail, type GmailConfig } from '../lib/importer';
import { restoreBackup, shareBackup, wipeAll } from '../lib/backup';
import { loadSampleData } from '../lib/sampleData';

const SCtx = createContext<Store>(null!);
const useS = () => useContext(SCtx);

export default function Settings() {
  const store = useStore();
  const loc = useLocation();

  useEffect(() => {
    if (!store || !loc.hash) return;
    document.getElementById(loc.hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [!!store, loc.hash]);

  if (!store) return null;
  return (
    <SCtx.Provider value={store}>
      <div className="page no-tab">
        <BackHeader title="Pengaturan" />
        <AccountsSection />
        <CategoriesSection />
        <BudgetsSection />
        <IncomeSection />
        <EstimateSection />
        <GmailSection />
        <SecuritySection />
        <BackupSection />
        <DataSection />
        <div className="tiny muted center mt16">DuitKu v0.1 · semua data tersimpan di perangkat ini</div>
      </div>
    </SCtx.Provider>
  );
}

/* ---------------- Akun & saldo ---------------- */
function AccountsSection() {
  const store = useS();
  const toast = useToast();
  const balances = accountBalances(store.accounts, store.transactions);
  const [edit, setEdit] = useState<Account | null>(null);
  const [fix, setFix] = useState<Account | null>(null);
  const [actual, setActual] = useState(0);

  return (
    <div className="card" id="accounts">
      <h3>🏦 Akun & saldo <button className="link" onClick={() => setEdit({ name: '', icon: '🏦', color: '#636E72', initialBalance: 0, order: store.accounts.length })}>＋ Akun</button></h3>
      {store.accounts.map((a) => (
        <div className="setrow" key={a.id}>
          <div className="cat" style={{ background: tint(a.color) }}>{a.icon}</div>
          <div className="grow">
            <div className="bold small">{a.name}</div>
            <div className="tiny muted">Saldo awal {rp(a.initialBalance)} · sekarang <b>{rp(balances.get(a.id!) ?? 0)}</b></div>
          </div>
          <button className="link" onClick={() => setEdit(a)}>Ubah</button>
          <button className="link" onClick={() => { setFix(a); setActual(balances.get(a.id!) ?? 0); }}>Koreksi</button>
        </div>
      ))}
      <div className="tiny muted mt8">Koreksi saldo: kalau angka di app beda dengan saldo asli di m-banking/GoPay, isi saldo aslinya. Selisihnya dicatat sebagai penyesuaian dan tidak masuk laporan.</div>

      <Sheet open={!!edit} onClose={() => setEdit(null)}>
        {edit && <AccountForm acc={edit} onDone={() => setEdit(null)} />}
      </Sheet>

      <Sheet open={!!fix} onClose={() => setFix(null)}>
        {fix && (
          <>
            <h2>Koreksi saldo {fix.name}</h2>
            <div className="small muted">Saldo di app: {rp(balances.get(fix.id!) ?? 0)}. Berapa saldo aslinya sekarang?</div>
            <div className="field"><AmountInput value={actual} onChange={setActual} className="inp amount" /></div>
            <div className="btnrow">
              <button className="btn ghost" onClick={() => setFix(null)}>Batal</button>
              <button className="btn" onClick={async () => {
                const diff = actual - (balances.get(fix.id!) ?? 0);
                if (diff !== 0) {
                  const now = new Date().toISOString();
                  await db.transactions.add({ status: 'done', source: 'adjustment', accountId: fix.id!, kind: diff > 0 ? 'income' : 'expense', amount: Math.abs(diff), counterparty: 'Koreksi saldo', date: now, items: [], note: '', photoIds: [], createdAt: now });
                }
                setFix(null);
                toast(diff === 0 ? 'Saldo sudah cocok' : `Saldo dikoreksi ${diff > 0 ? '+' : ''}${rp(diff)}`);
              }}>Simpan</button>
            </div>
          </>
        )}
      </Sheet>
    </div>
  );
}

function AccountForm({ acc, onDone }: { acc: Account; onDone: () => void }) {
  const [name, setName] = useState(acc.name);
  const [icon, setIcon] = useState(acc.icon);
  const [initial, setInitial] = useState(Math.abs(acc.initialBalance));
  const [neg, setNeg] = useState(acc.initialBalance < 0);
  return (
    <>
      <h2>{acc.id ? `Ubah ${acc.name}` : 'Akun baru'}</h2>
      <div className="field"><label>Nama akun</label><input className="inp" value={name} onChange={(e) => setName(e.target.value)} placeholder="BSI" /></div>
      <div className="field"><label>Ikon</label>
        <div className="chips">{['🏦', '💙', '💚', '💳', '👛', '📱'].map((e) => <button key={e} className={`chip ${icon === e ? 'on' : ''}`} onClick={() => setIcon(e)}>{e}</button>)}</div>
      </div>
      <div className="field"><label>Saldo awal (saat mulai pakai app)</label><AmountInput value={initial} onChange={setInitial} /></div>
      <label className="row small mt8"><input type="checkbox" checked={neg} onChange={(e) => setNeg(e.target.checked)} /> Saldo minus</label>
      <div className="btnrow">
        <button className="btn ghost" onClick={onDone}>Batal</button>
        <button className="btn" onClick={async () => {
          if (!name.trim()) return;
          const value = neg ? -initial : initial;
          if (acc.id) await db.accounts.update(acc.id, { name: name.trim(), icon, initialBalance: value });
          else await db.accounts.add({ ...acc, name: name.trim(), icon, initialBalance: value });
          onDone();
        }}>Simpan</button>
      </div>
    </>
  );
}

/* ---------------- Kategori ---------------- */
function CategoriesSection() {
  const store = useS();
  const [editor, setEditor] = useState<{ kind: 'expense' | 'income'; cat?: Category } | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const list = (kind: 'expense' | 'income') => store.categories.filter((c) => c.kind === kind && (showArchived || !c.archived));
  const row = (c: Category) => (
    <div className="setrow" key={c.id} style={{ opacity: c.archived ? 0.5 : 1 }}>
      <div className="cat" style={{ background: tint(c.color) }}>{c.icon}</div>
      <div className="grow small bold">{c.name}{!c.isConsumption && <span className="tiny muted" style={{ fontWeight: 500 }}> · bukan konsumsi</span>}</div>
      <button className="link" onClick={() => setEditor({ kind: c.kind, cat: c })}>Ubah</button>
      <button className="link" onClick={() => db.categories.update(c.id!, { archived: !c.archived })}>{c.archived ? 'Pulihkan' : 'Arsipkan'}</button>
    </div>
  );
  return (
    <div className="card" id="categories">
      <h3>🏷️ Kategori pengeluaran <button className="link" onClick={() => setEditor({ kind: 'expense' })}>＋ Baru</button></h3>
      {list('expense').map(row)}
      <h3 className="mt16">💰 Kategori pemasukan <button className="link" onClick={() => setEditor({ kind: 'income' })}>＋ Baru</button></h3>
      {list('income').map(row)}
      <button className="link mt8" onClick={() => setShowArchived(!showArchived)}>{showArchived ? 'Sembunyikan' : 'Tampilkan'} yang diarsipkan</button>
      <CategoryEditor open={!!editor} onClose={() => setEditor(null)} kind={editor?.kind ?? 'expense'} initial={editor?.cat} />
    </div>
  );
}

/* ---------------- Budget ---------------- */
function BudgetsSection() {
  const store = useS();
  const toast = useToast();
  const budgetMap = new Map(store.budgets.map((b) => [b.categoryId, b.monthlyAmount]));
  const [draft, setDraft] = useState<Record<number, number>>({});
  const cats = store.categories.filter((c) => c.kind === 'expense' && !c.archived);
  return (
    <div className="card" id="budgets">
      <h3>📊 Budget bulanan per kategori</h3>
      {cats.map((c) => (
        <div className="item" key={c.id}>
          <div className="cat" style={{ background: tint(c.color) }}>{c.icon}</div>
          <div className="grow small">{c.name}</div>
          <AmountInput className="inp right p" placeholder="tanpa budget" value={draft[c.id!] ?? budgetMap.get(c.id!) ?? 0} onChange={(n) => setDraft({ ...draft, [c.id!]: n })} />
        </div>
      ))}
      <button className="btn sm mt8" onClick={async () => {
        for (const [id, v] of Object.entries(draft)) {
          if (v > 0) await db.budgets.put({ categoryId: Number(id), monthlyAmount: v });
          else await db.budgets.delete(Number(id));
        }
        setDraft({});
        toast('Budget disimpan');
      }}>Simpan budget</button>
    </div>
  );
}

/* ---------------- Pemasukan rutin ---------------- */
function IncomeSection() {
  const store = useS();
  const [edit, setEdit] = useState<RecurringIncome | null>(null);
  return (
    <div className="card" id="income">
      <h3>💵 Pemasukan rutin <button className="link" onClick={() => setEdit({ name: 'Uang bulanan', amount: 0, dayOfMonth: 1, accountId: store.accounts[0]?.id ?? 1 })}>＋ Tambah</button></h3>
      {store.incomes.length === 0 && <div className="small muted">Misal uang bulanan atau gaji. Dipakai untuk menghitung peluang rencana.</div>}
      {store.incomes.map((i) => (
        <div className="setrow" key={i.id}>
          <div className="cat" style={{ background: 'var(--in-soft)' }}>💰</div>
          <div className="grow"><div className="small bold">{i.name}</div><div className="tiny muted">{rp(i.amount)} · tiap tanggal {i.dayOfMonth} · {store.accById.get(i.accountId)?.name}</div></div>
          <button className="link" onClick={() => setEdit(i)}>Ubah</button>
        </div>
      ))}
      <Sheet open={!!edit} onClose={() => setEdit(null)}>
        {edit && <IncomeForm inc={edit} onDone={() => setEdit(null)} />}
      </Sheet>
    </div>
  );
}

function IncomeForm({ inc, onDone }: { inc: RecurringIncome; onDone: () => void }) {
  const store = useS();
  const [v, setV] = useState(inc);
  return (
    <>
      <h2>{inc.id ? 'Ubah pemasukan rutin' : 'Pemasukan rutin baru'}</h2>
      <div className="field"><label>Nama</label><input className="inp" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></div>
      <div className="field"><label>Nominal per bulan</label><AmountInput value={v.amount} onChange={(n) => setV({ ...v, amount: n })} /></div>
      <div className="field"><label>Masuk tiap tanggal</label>
        <select className="inp" value={v.dayOfMonth} onChange={(e) => setV({ ...v, dayOfMonth: Number(e.target.value) })}>
          {Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
        </select>
      </div>
      <div className="field"><label>Ke akun</label>
        <div className="chips">{store.accounts.map((a) => <button key={a.id} className={`chip ${v.accountId === a.id ? 'on' : ''}`} onClick={() => setV({ ...v, accountId: a.id! })}>{a.icon} {a.name}</button>)}</div>
      </div>
      <div className="btnrow">
        {inc.id && <button className="btn danger" onClick={async () => { await db.recurringIncome.delete(inc.id!); onDone(); }}>Hapus</button>}
        <button className="btn" onClick={async () => { if (!v.amount) return; await db.recurringIncome.put(v); onDone(); }}>Simpan</button>
      </div>
    </>
  );
}

/* ---------------- Estimasi harian ---------------- */
function EstimateSection() {
  const store = useS();
  const toast = useToast();
  const [v, setV] = useState(store.dailyEstimate);
  return (
    <div className="card" id="estimate">
      <h3>📉 Estimasi pengeluaran harian</h3>
      <div className="small muted">Dipakai untuk menghitung rencana selama riwayatmu belum 14 hari. Setelah itu app menghitung rata-ratanya sendiri.</div>
      <div className="row mt8">
        <AmountInput value={v} onChange={setV} />
        <button className="btn sm" onClick={async () => { await setMeta('dailyEstimate', v); toast('Estimasi disimpan'); }}>Simpan</button>
      </div>
    </div>
  );
}

/* ---------------- Gmail ---------------- */
function GmailSection() {
  const toast = useToast();
  const [cfg, setCfg] = useState<GmailConfig>({ url: '', token: '' });
  const [busy, setBusy] = useState(false);
  const lastSync = useLiveQuery(async () => (await db.meta.get('lastSyncAt'))?.value as string | undefined, []);
  useEffect(() => {
    getGmailConfig().then((c) => c && setCfg(c));
  }, []);

  return (
    <div className="card" id="gmail">
      <h3>📧 Impor otomatis dari Gmail</h3>
      <div className="small muted">
        Pasang Google Apps Script di akun Google-mu (panduan: <b>apps-script/README.md</b>), lalu tempel URL web app dan token rahasianya di sini.
      </div>
      <div className="field"><label>URL web app</label><input className="inp" value={cfg.url} onChange={(e) => setCfg({ ...cfg, url: e.target.value.trim() })} placeholder="https://script.google.com/macros/s/…/exec" /></div>
      <div className="field"><label>Token rahasia</label><input className="inp" value={cfg.token} onChange={(e) => setCfg({ ...cfg, token: e.target.value.trim() })} placeholder="token dari log setup" /></div>
      <div className="btnrow">
        <button className="btn ghost" disabled={busy} onClick={async () => {
          if (!cfg.url.startsWith('https://script.google.com/')) return toast('URL harus diawali https://script.google.com/');
          setBusy(true);
          try {
            const n = await testGmail(cfg);
            await setMeta('gmail', cfg);
            toast(`Tersambung ✓ (${n} baris di Sheet)`);
          } catch (e) {
            toast(`Gagal: ${(e as Error).message}`);
          } finally { setBusy(false); }
        }}>Simpan & tes</button>
        <button className="btn" disabled={busy} onClick={async () => {
          setBusy(true);
          try { const n = await syncGmail(); toast(n ? `${n} transaksi baru` : 'Belum ada transaksi baru'); }
          catch (e) { toast(`Gagal: ${(e as Error).message}`); }
          finally { setBusy(false); }
        }}>Sinkron sekarang</button>
      </div>
      {lastSync && <div className="tiny muted mt8">Sinkron terakhir: {relDay(lastSync)} {timeHM(lastSync)}</div>}
      {cfg.url && <button className="link mt8" onClick={async () => { await db.meta.delete('gmail'); setCfg({ url: '', token: '' }); toast('Koneksi Gmail dilepas'); }}>Lepas koneksi</button>}
    </div>
  );
}

/* ---------------- Keamanan & tema ---------------- */
function SecuritySection() {
  const toast = useToast();
  const pinOn = useLiveQuery(() => hasPin(), []);
  const theme = useLiveQuery(() => getMeta<ThemePref>('theme', 'system'), []);
  const [pinSheet, setPinSheet] = useState(false);
  const [first, setFirst] = useState<string | null>(null);
  const [err, setErr] = useState<string>();

  const setTheme = async (t: ThemePref) => { await setMeta('theme', t); applyTheme(t); };

  return (
    <div className="card" id="security">
      <h3>🔒 Keamanan & tampilan</h3>
      <div className="setrow">
        <div className="grow"><div className="small bold">Kunci PIN</div><div className="tiny muted">{pinOn ? 'Aktif: diminta saat app dibuka / setelah 5 menit' : 'Tidak aktif'}</div></div>
        <button className="link" onClick={() => { setFirst(null); setErr(undefined); setPinSheet(true); }}>{pinOn ? 'Ganti' : 'Aktifkan'}</button>
        {pinOn && <button className="link" onClick={async () => { await removePin(); toast('PIN dimatikan'); }}>Matikan</button>}
      </div>
      <div className="setrow" style={{ display: 'block' }}>
        <div className="small bold" style={{ marginBottom: 8 }}>Tema</div>
        <div className="seg">
          {(['system', 'light', 'dark'] as ThemePref[]).map((t) => (
            <button key={t} className={theme === t ? 'on' : ''} onClick={() => setTheme(t)}>{t === 'system' ? 'Ikut HP' : t === 'light' ? 'Terang' : 'Gelap'}</button>
          ))}
        </div>
      </div>
      <div className="tiny muted mt8">PIN mengunci tampilan app. Kalau lupa PIN, satu-satunya cara adalah menghapus data app lalu memulihkan dari backup.</div>
      <Sheet open={pinSheet} onClose={() => setPinSheet(false)}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 0' }}>
          <PinPad
            title={first ? 'Ulangi PIN' : 'Buat PIN 4 angka'}
            error={err}
            onComplete={async (p) => {
              if (!first) { setFirst(p); setErr(undefined); return; }
              if (p !== first) { setFirst(null); setErr('PIN tidak sama, ulangi dari awal'); return; }
              await setPin(p);
              setPinSheet(false);
              toast('PIN aktif');
            }}
          />
        </div>
      </Sheet>
    </div>
  );
}

/* ---------------- Backup ---------------- */
function BackupSection() {
  const toast = useToast();
  const lastBackup = useLiveQuery(async () => (await db.meta.get('lastBackupAt'))?.value as string | undefined, []);
  const [usage, setUsage] = useState<string>();
  const [pending, setPending] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    navigator.storage?.estimate?.().then((e) => {
      if (e.usage != null) setUsage(`${(e.usage / 1024 / 1024).toFixed(1)} MB`);
    });
  }, []);

  return (
    <div className="card" id="backup">
      <h3>💾 Backup & pulihkan</h3>
      <div className="small muted">
        Data hanya tersimpan di perangkat ini. Backup rutin ke iCloud Drive/Files supaya aman kalau HP hilang atau ganti HP.
        {usage && <> Terpakai: {usage}.</>}
      </div>
      <div className="small mt8">Backup terakhir: <b>{lastBackup ? dateLong(new Date(lastBackup)) : 'belum pernah'}</b></div>
      <div className="btnrow">
        <button className="btn" onClick={async () => {
          try {
            const r = await shareBackup();
            toast(r === 'shared' ? 'Backup dibuat. Simpan ke Files/iCloud' : 'File backup diunduh');
          } catch { /* dibatalkan */ }
        }}>Buat backup</button>
        <button className="btn ghost" onClick={() => fileRef.current?.click()}>Pulihkan</button>
      </div>
      <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { setPending(e.target.files?.[0] ?? null); e.target.value = ''; }} />
      <Sheet open={!!pending} onClose={() => setPending(null)}>
        <h2>Pulihkan dari backup?</h2>
        <div className="small muted">Semua data di perangkat ini akan <b>diganti</b> dengan isi file <b>{pending?.name}</b>. Data yang belum ada di backup itu akan hilang.</div>
        <div className="btnrow">
          <button className="btn ghost" onClick={() => setPending(null)}>Batal</button>
          <button className="btn" onClick={async () => {
            try {
              const r = await restoreBackup(pending!);
              toast(`Dipulihkan: ${r.transactions} transaksi, ${r.photos} foto`);
            } catch (e) { toast((e as Error).message); }
            setPending(null);
          }}>Pulihkan</button>
        </div>
      </Sheet>
    </div>
  );
}

/* ---------------- Data ---------------- */
function DataSection() {
  const store = useS();
  const toast = useToast();
  const [wipe, setWipe] = useState(false);
  return (
    <div className="card" id="data">
      <h3>🧪 Data</h3>
      {store.transactions.length === 0 && (
        <button className="btn ghost" onClick={async () => { await loadSampleData(); toast('Data contoh dimuat'); }}>Isi data contoh (untuk mencoba)</button>
      )}
      <button className="btn danger mt8" onClick={() => setWipe(true)}>Hapus semua data</button>
      <Sheet open={wipe} onClose={() => setWipe(false)}>
        <h2>Hapus semua data?</h2>
        <div className="small muted">Semua transaksi, foto, rencana, dan pengaturan di perangkat ini akan dihapus permanen dan <b>tidak bisa dikembalikan</b>, kecuali kamu punya file backup.</div>
        <div className="btnrow">
          <button className="btn ghost" onClick={() => setWipe(false)}>Batal</button>
          <button className="btn danger" onClick={async () => {
            await wipeAll();
            await ensureSeed();
            applyTheme('system');
            setWipe(false);
            toast('Semua data dihapus');
          }}>Hapus permanen</button>
        </div>
      </Sheet>
    </div>
  );
}
