import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { db } from '../db';
import { useStore } from '../hooks';
import type { Kind } from '../types';
import { AmountInput, BackHeader } from '../components/ui';
import { toLocalInput } from '../lib/format';

/** Langkah awal tambah manual: jenis, nominal, akun, nama, tanggal. Lalu lanjut ke form Rapikan. */
export default function AddTransaction() {
  const store = useStore();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const preset = params.get('preset');
  const [kind, setKind] = useState<Kind>(params.get('kind') === 'income' ? 'income' : 'expense');
  const [amount, setAmount] = useState(0);
  const [accountId, setAccountId] = useState<number>();
  const [name, setName] = useState(preset === 'dana' ? 'Dana tambahan' : '');
  const [date, setDate] = useState(toLocalInput(new Date().toISOString()));
  const [error, setError] = useState('');

  useEffect(() => {
    if (store && accountId == null && store.accounts[0]) setAccountId(store.accounts[0].id);
  }, [store, accountId]);

  if (!store) return null;

  const next = async () => {
    if (!amount) return setError('Isi nominalnya dulu');
    if (!accountId) return setError('Pilih akun');
    const now = new Date().toISOString();
    const presetCat = preset === 'dana' ? store.categories.find((c) => c.kind === 'income' && c.name === 'Dana Tambahan')?.id : undefined;
    const id = await db.transactions.add({
      status: 'inbox', source: 'manual', accountId, kind, amount,
      counterparty: name.trim(), date: new Date(date).toISOString(),
      categoryId: presetCat, items: [], note: '', photoIds: [], createdAt: now
    });
    nav(`/tx/${id}?new=1`, { replace: true });
  };

  return (
    <div className="page no-tab">
      <BackHeader title={preset === 'dana' ? 'Tambah dana' : 'Tambah transaksi'} />
      <div className="seg">
        <button className={kind === 'expense' ? 'on' : ''} onClick={() => setKind('expense')}>Keluar</button>
        <button className={kind === 'income' ? 'on' : ''} onClick={() => setKind('income')}>Masuk</button>
      </div>
      <div className="card">
        <div className="small muted center">Nominal (Rp)</div>
        <AmountInput value={amount} onChange={(n) => { setAmount(n); setError(''); }} className={`inp amount ${kind === 'income' ? 'pos' : 'neg'}`} autoFocus />
        {error && <div className="err center">{error}</div>}
      </div>
      <div className="field">
        <label>Akun</label>
        <div className="chips">
          {store.accounts.map((a) => (
            <button key={a.id} className={`chip ${accountId === a.id ? 'on' : ''}`} onClick={() => setAccountId(a.id)}>{a.icon} {a.name}</button>
          ))}
        </div>
      </div>
      <div className="field">
        <label>{kind === 'income' ? 'Dari siapa / sumber' : 'Bayar ke / nama toko'}</label>
        <input className="inp" value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === 'income' ? 'Uang bulanan' : 'Indomaret'} />
      </div>
      <div className="field">
        <label>Tanggal & jam</label>
        <input className="inp" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <button className="btn mt16" onClick={next}>Lanjut →</button>
    </div>
  );
}
