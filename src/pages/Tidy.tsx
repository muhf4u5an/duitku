import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../db';
import { useStore } from '../hooks';
import type { ForWhom, Item, Kind, Photo, Transaction } from '../types';
import { AmountInput, BackHeader, BlobImg, CatIcon, Sheet, useToast } from '../components/ui';
import { CategoryEditor } from '../components/CategoryEditor';
import { dateShort, num, rp, timeHM, tint, toLocalInput } from '../lib/format';
import { compressImage } from '../lib/image';
import { getRule } from '../lib/merchantRules';
import { deleteTx, saveTidy, setStatus } from '../lib/txService';

type Step = 'who' | 'cat' | 'details';

export default function Tidy() {
  const { id } = useParams();
  const txId = Number(id);
  const store = useStore();
  const nav = useNavigate();
  const toast = useToast();

  const [tx, setTx] = useState<Transaction | null>(null);
  const [step, setStep] = useState<Step>('details');
  const [forWhom, setForWhom] = useState<ForWhom | undefined>();
  const [categoryId, setCategoryId] = useState<number | undefined>();
  const [transfer, setTransfer] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [note, setNote] = useState('');
  const [planId, setPlanId] = useState<number | undefined>();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [newPhotos, setNewPhotos] = useState<Blob[]>([]);
  const [removed, setRemoved] = useState<number[]>([]);
  const [suggested, setSuggested] = useState(false);
  // detail dasar (bisa diubah)
  const [amount, setAmount] = useState(0);
  const [kind, setKind] = useState<Kind>('expense');
  const [accountId, setAccountId] = useState(0);
  const [counterparty, setCounterparty] = useState('');
  const [date, setDate] = useState('');
  const [editBasic, setEditBasic] = useState(false);
  const [newCat, setNewCat] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const t = await db.transactions.get(txId);
      if (!t) return;
      setTx(t);
      setForWhom(t.forWhom);
      setCategoryId(t.categoryId);
      setTransfer(!!t.transfer);
      setItems(t.items.length ? t.items : [{ name: '', price: 0 }]);
      setNote(t.note);
      setPlanId(t.planId);
      setAmount(t.amount);
      setKind(t.kind);
      setAccountId(t.accountId);
      setCounterparty(t.counterparty);
      setDate(toLocalInput(t.date));
      setPhotos((await db.photos.bulkGet(t.photoIds)).filter(Boolean) as Photo[]);
      if (t.status !== 'done') {
        if (t.categoryId == null && !t.transfer) {
          const rule = await getRule(t.counterparty);
          if (rule) {
            setCategoryId(rule.categoryId);
            setForWhom(rule.forWhom);
            setTransfer(!!rule.transfer);
            setSuggested(true);
          }
        }
        setStep(t.kind === 'income' ? (t.categoryId != null ? 'details' : 'cat') : 'who');
      }
    })();
  }, [txId]);

  const cats = useMemo(() => store?.categories.filter((c) => c.kind === kind && !c.archived) ?? [], [store, kind]);
  const activePlans = useMemo(() => store?.plans.filter((p) => p.status === 'active' || p.id === tx?.planId) ?? [], [store, tx]);

  if (!store || !tx) return null;

  const cat = categoryId != null ? store.catById.get(categoryId) : undefined;
  const account = store.accById.get(accountId);
  const itemTotal = items.reduce((s, i) => s + (i.price || 0), 0);
  const diff = amount - itemTotal;
  const hasItems = items.some((i) => i.price > 0);
  const steps: Step[] = kind === 'income' || transfer ? ['cat', 'details'] : ['who', 'cat', 'details'];
  const stepIdx = steps.indexOf(step);

  const pickWho = (w: ForWhom) => { setForWhom(w); setStep('cat'); };
  const pickCat = (cid: number) => { setCategoryId(cid); setTransfer(false); setStep('details'); };
  const pickTransfer = () => { setTransfer(true); setCategoryId(undefined); setPlanId(undefined); setStep('details'); };

  const onPhoto = async (files: FileList | null) => {
    if (!files) return;
    const blobs = await Promise.all(Array.from(files).map((f) => compressImage(f)));
    setNewPhotos((p) => [...p, ...blobs]);
  };

  const save = async () => {
    if (!transfer && categoryId == null) { setStep('cat'); return; }
    if (!amount) { setEditBasic(true); return; }
    setSaving(true);
    try {
      await saveTidy(txId, {
        forWhom: kind === 'income' ? undefined : forWhom ?? 'self',
        categoryId, transfer, items, note, planId: kind === 'expense' ? planId : undefined,
        newPhotos, removedPhotoIds: removed,
        patch: { amount, kind, accountId, counterparty: counterparty.trim(), date: new Date(date).toISOString() }
      });
      toast('Tersimpan');
      nav(-1);
    } finally {
      setSaving(false);
    }
  };

  const header = (
    <div className="card row" style={{ marginTop: 0 }}>
      <CatIcon cat={cat} size="lg" fallback={transfer ? '🔁' : kind === 'income' ? '💰' : '🧾'} />
      <div className="grow">
        <div className="bold" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{counterparty || 'Tanpa nama'}</div>
        <div className="tiny muted">{account?.icon} {account?.name} · {dateShort(new Date(date).toISOString())} {timeHM(new Date(date).toISOString())}</div>
      </div>
      <div className={`bold ${kind === 'income' ? 'pos' : 'neg'}`} style={{ fontSize: 17 }}>{kind === 'income' ? '+' : '−'}{num(amount)}</div>
    </div>
  );

  return (
    <div className="page no-tab">
      <BackHeader title={tx.status === 'done' ? 'Ubah transaksi' : 'Rapikan'} />
      <div className="steps">{steps.map((s, i) => <i key={s} className={i <= stepIdx ? 'd' : ''} />)}</div>
      {header}

      {step === 'who' && (
        <>
          <div className="h3 mt16">Untuk siapa?</div>
          <div className="bigchoice">
            <button className={forWhom === 'self' ? 'on' : ''} onClick={() => pickWho('self')}><span className="e">👤</span>Diri sendiri</button>
            <button className={forWhom === 'couple' ? 'on' : ''} onClick={() => pickWho('couple')}><span className="e">💑</span>Berdua</button>
          </div>
          {suggested && <div className="small muted center mt12">Pilihan bertanda adalah saran dari transaksi sebelumnya</div>}
        </>
      )}

      {step === 'cat' && (
        <>
          <div className="h3 mt16">Kategori</div>
          <div className="catgrid">
            {cats.map((c) => (
              <button key={c.id} className={categoryId === c.id && !transfer ? 'on' : ''} onClick={() => pickCat(c.id!)}>
                <div className="cat" style={{ background: tint(c.color) }}>{c.icon}</div>{c.name}
              </button>
            ))}
            <button onClick={() => setNewCat(true)}><div className="cat" style={{ background: 'var(--field)' }}>➕</div>Kategori baru</button>
            <button className={transfer ? 'on' : ''} onClick={pickTransfer}><div className="cat" style={{ background: 'var(--field)' }}>🔁</div>Transfer / top-up</button>
          </div>
          <div className="tiny muted mt12">🔁 Transfer / top-up: pindah uang antar akunmu sendiri. Saldo tetap dihitung, tapi tidak masuk laporan pengeluaran.</div>
          {kind === 'expense' && <button className="btn ghost mt16" onClick={() => setStep('who')}>← Kembali</button>}
        </>
      )}

      {step === 'details' && (
        <>
          <div className="chips mt12">
            {kind === 'expense' && !transfer && (
              <button className="chip" style={{ background: forWhom === 'couple' ? 'var(--couple-soft)' : 'var(--primary-soft)', borderColor: 'transparent', color: forWhom === 'couple' ? 'var(--couple)' : 'var(--primary)' }} onClick={() => setStep('who')}>
                {forWhom === 'couple' ? '💑 Berdua' : '👤 Sendiri'} ✎
              </button>
            )}
            <button className="chip" style={{ background: cat ? tint(cat.color) : 'var(--field)', borderColor: 'transparent' }} onClick={() => setStep('cat')}>
              {transfer ? '🔁 Transfer / top-up' : cat ? `${cat.icon} ${cat.name}` : 'Pilih kategori'} ✎
            </button>
          </div>

          <div className="card">
            <h3>Rincian item <span className="tiny muted" style={{ fontWeight: 500 }}>opsional</span></h3>
            {items.map((it, i) => (
              <div className="item" key={i}>
                <input className="inp" placeholder={i === 0 ? 'Susu UHT 1L' : 'Nama barang'} value={it.name}
                  onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                <AmountInput className="inp right p" value={it.price}
                  onChange={(n) => setItems(items.map((x, j) => (j === i ? { ...x, price: n } : x)))} />
                <button className="x" onClick={() => setItems(items.length > 1 ? items.filter((_, j) => j !== i) : [{ name: '', price: 0 }])} aria-label="Hapus item">×</button>
              </div>
            ))}
            <button className="link" style={{ fontSize: 13, padding: '6px 2px' }} onClick={() => setItems([...items, { name: '', price: 0 }])}>＋ Tambah item</button>
            {hasItems && (
              diff === 0 ? (
                <div className="check" style={{ background: 'var(--in-soft)' }}><span>Total item cocok dengan nominal</span><span className="pos bold">✓ {rp(itemTotal)}</span></div>
              ) : (
                <>
                  <div className="check" style={{ background: 'var(--warn-soft)' }}>
                    <span>Total item <b>{rp(itemTotal)}</b> dari {rp(amount)}</span>
                    <span className="warn bold">selisih {num(diff)}</span>
                  </div>
                  {diff > 0 && (
                    <button className="link mt8" onClick={() => setItems([...items.filter((i) => i.name || i.price), { name: 'Lain-lain', price: diff }])}>
                      ↳ Masukkan selisih sebagai "lain-lain"
                    </button>
                  )}
                </>
              )
            )}
          </div>

          <div className="card">
            <h3>Catatan</h3>
            <textarea className="inp" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Stok kos minggu ini" />
          </div>

          <div className="card">
            <h3>Foto nota <span className="tiny muted" style={{ fontWeight: 500 }}>opsional</span></h3>
            <div className="photos">
              {photos.filter((p) => !removed.includes(p.id!)).map((p) => (
                <div className="ph" key={p.id}><BlobImg blob={p.blob} alt="Nota" /><button className="del" onClick={() => setRemoved([...removed, p.id!])} aria-label="Hapus foto">×</button></div>
              ))}
              {newPhotos.map((b, i) => (
                <div className="ph" key={`n${i}`}><BlobImg blob={b} alt="Nota baru" /><button className="del" onClick={() => setNewPhotos(newPhotos.filter((_, j) => j !== i))} aria-label="Hapus foto">×</button></div>
              ))}
              <button className="ph add" onClick={() => fileRef.current?.click()} aria-label="Tambah foto">📷</button>
              <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { onPhoto(e.target.files); e.target.value = ''; }} />
            </div>
          </div>

          {kind === 'expense' && !transfer && (
            <div className="card">
              <h3>Realisasi rencana? <span className="tiny muted" style={{ fontWeight: 500 }}>opsional</span></h3>
              <select className="inp" value={planId ?? ''} onChange={(e) => setPlanId(e.target.value ? Number(e.target.value) : undefined)}>
                <option value="">Bukan bagian rencana</option>
                {activePlans.map((p) => <option key={p.id} value={p.id}>{p.icon} {p.name} (budget {rp(p.target)})</option>)}
              </select>
              {planId && <div className="tiny muted mt8">Rencana ini akan ditandai selesai, dan budget vs aktualnya tercatat.</div>}
            </div>
          )}

          <div className="card">
            <button className="between" style={{ width: '100%' }} onClick={() => setEditBasic(!editBasic)}>
              <span className="h3" style={{ margin: 0 }}>Detail transaksi</span><span className="link">{editBasic ? 'Tutup' : 'Ubah'}</span>
            </button>
            {editBasic && (
              <>
                <div className="field">
                  <div className="seg">
                    <button className={kind === 'expense' ? 'on' : ''} onClick={() => { setKind('expense'); setCategoryId(undefined); }}>Keluar</button>
                    <button className={kind === 'income' ? 'on' : ''} onClick={() => { setKind('income'); setCategoryId(undefined); setPlanId(undefined); }}>Masuk</button>
                  </div>
                </div>
                <div className="field"><label>Nominal</label><AmountInput value={amount} onChange={setAmount} /></div>
                <div className="field"><label>Nama / toko</label><input className="inp" value={counterparty} onChange={(e) => setCounterparty(e.target.value)} /></div>
                <div className="field">
                  <label>Akun</label>
                  <div className="chips">{store.accounts.map((a) => <button key={a.id} className={`chip ${accountId === a.id ? 'on' : ''}`} onClick={() => setAccountId(a.id!)}>{a.icon} {a.name}</button>)}</div>
                </div>
                <div className="field"><label>Tanggal & jam</label><input className="inp" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} /></div>
              </>
            )}
          </div>

          <button className="btn mt16" onClick={save} disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan'}</button>
          <div className="btnrow">
            {tx.status !== 'ignored' && (
              <button className="btn ghost" onClick={async () => { await setStatus(txId, 'ignored'); toast('Transaksi diabaikan'); nav(-1); }}>Abaikan</button>
            )}
            <button className="btn danger" onClick={() => setConfirmDel(true)}>Hapus</button>
          </div>
        </>
      )}

      <CategoryEditor open={newCat} onClose={() => setNewCat(false)} kind={kind} onSaved={(cid) => pickCat(cid)} />

      <Sheet open={confirmDel} onClose={() => setConfirmDel(false)}>
        <h2>Hapus transaksi ini?</h2>
        <div className="small muted">Transaksi dan foto notanya akan dihapus permanen dari HP ini. Kalau ini dobel, lebih aman pilih "Abaikan".</div>
        <div className="btnrow">
          <button className="btn ghost" onClick={() => setConfirmDel(false)}>Batal</button>
          <button className="btn danger" onClick={async () => { await deleteTx(txId); toast('Transaksi dihapus'); nav(-1); }}>Hapus</button>
        </div>
      </Sheet>
    </div>
  );
}
