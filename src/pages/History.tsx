import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../hooks';
import { BackHeader, Empty, TxRow } from '../components/ui';
import { dateLong, monthKey, monthLabel, num, shiftMonth } from '../lib/format';
import { inMonth, signed } from '../lib/stats';

export default function History() {
  const store = useStore();
  const nav = useNavigate();
  const [month, setMonth] = useState(monthKey(new Date()));
  const [catId, setCatId] = useState('');
  const [accId, setAccId] = useState('');
  const [q, setQ] = useState('');

  const list = useMemo(() => {
    if (!store) return [];
    const query = q.trim().toLowerCase();
    return store.transactions.filter((t) => {
      if (t.status === 'ignored') return false;
      if (!query && !inMonth(t, month)) return false;
      if (catId === 'transfer' ? !t.transfer : catId && String(t.categoryId) !== catId) return false;
      if (accId && String(t.accountId) !== accId) return false;
      if (query) {
        const hay = [t.counterparty, t.note, ...t.items.map((i) => i.name)].join(' ').toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });
  }, [store, month, catId, accId, q]);

  if (!store) return null;

  const groups = new Map<string, typeof list>();
  for (const t of list) {
    const k = dateLong(new Date(t.date));
    groups.set(k, [...(groups.get(k) ?? []), t]);
  }

  return (
    <div className="page">
      <BackHeader title="Riwayat" />
      <input className="inp" placeholder="🔍 Cari nama, catatan, atau item (semua bulan)" value={q} onChange={(e) => setQ(e.target.value)} />
      {!q && (
        <div className="between mt12">
          <button className="iconbtn" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Bulan sebelumnya">‹</button>
          <div className="bold">{monthLabel(month)}</div>
          <button className="iconbtn" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Bulan berikutnya">›</button>
        </div>
      )}
      <div className="row mt12">
        <select className="inp" value={catId} onChange={(e) => setCatId(e.target.value)}>
          <option value="">Semua kategori</option>
          {store.categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}{c.kind === 'income' ? ' (masuk)' : ''}</option>)}
          <option value="transfer">🔁 Transfer / top-up</option>
        </select>
        <select className="inp" value={accId} onChange={(e) => setAccId(e.target.value)}>
          <option value="">Semua akun</option>
          {store.accounts.map((a) => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
        </select>
      </div>

      {list.length === 0 && <Empty icon="🗒️" title="Tidak ada transaksi" text="Coba ganti bulan atau filter." />}
      {[...groups.entries()].map(([day, txs]) => {
        const net = txs.reduce((s, t) => s + (t.transfer || t.source === 'adjustment' ? 0 : signed(t)), 0);
        return (
          <div key={day}>
            <div className="dayhdr"><span>{day}</span><span className={net >= 0 ? 'pos' : 'neg'}>{net >= 0 ? '+' : '−'}{num(Math.abs(net))}</span></div>
            <div className="card" style={{ marginTop: 0, padding: '4px 14px' }}>
              {txs.map((t) => (
                <TxRow key={t.id} tx={t} showDate={false} account={store.accById.get(t.accountId)} cat={t.categoryId != null ? store.catById.get(t.categoryId) : undefined} onClick={() => nav(`/tx/${t.id}`)} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
