import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useStore } from '../hooks';
import type { MerchantRule, Transaction } from '../types';
import { SwipeCard } from '../components/SwipeCard';
import { Empty, TxRow, useToast } from '../components/ui';
import { num, relDay, timeHM } from '../lib/format';
import { merchantKey } from '../lib/merchantRules';
import { acceptSuggestion, setStatus } from '../lib/txService';
import { getGmailConfig, syncGmail } from '../lib/importer';

export default function Inbox() {
  const store = useStore();
  const nav = useNavigate();
  const toast = useToast();
  const [syncing, setSyncing] = useState(false);
  const [showIgnored, setShowIgnored] = useState(false);
  const rules = useLiveQuery(async () => new Map((await db.merchantRules.toArray()).map((r) => [r.key, r] as [string, MerchantRule])), []);
  const gmail = useLiveQuery(() => getGmailConfig(), []);
  const lastSync = useLiveQuery(async () => (await db.meta.get('lastSyncAt'))?.value as string | undefined, []);

  if (!store || !rules) return null;
  const inbox = store.transactions.filter((t) => t.status === 'inbox');
  const ignored = store.transactions.filter((t) => t.status === 'ignored');

  const sync = async () => {
    setSyncing(true);
    try {
      const n = await syncGmail();
      toast(n ? `${n} transaksi baru masuk` : 'Belum ada transaksi baru');
    } catch (e) {
      toast(`Gagal sinkron: ${(e as Error).message}`);
    } finally {
      setSyncing(false);
    }
  };

  const suggestionFor = (t: Transaction) => {
    if (t.categoryId != null) return { categoryId: t.categoryId, forWhom: t.forWhom, transfer: t.transfer };
    const r = rules.get(merchantKey(t.counterparty));
    return r ? { categoryId: r.categoryId, forWhom: r.forWhom, transfer: r.transfer } : null;
  };

  return (
    <div className="page">
      <div className="hdr">
        <div>
          <div className="sub">{lastSync ? `Sinkron terakhir ${relDay(lastSync).toLowerCase()} ${timeHM(lastSync)}` : 'Transaksi yang menunggu dicek'}</div>
          <h1>Inbox</h1>
        </div>
        {gmail && <button className="iconbtn" onClick={sync} disabled={syncing} aria-label="Sinkron">{syncing ? '⏳' : '🔄'}</button>}
      </div>

      {!gmail && (
        <button className="banner" style={{ background: 'var(--primary-soft)', marginTop: 0, marginBottom: 12 }} onClick={() => nav('/settings#gmail')}>
          📧 <div><b>Sambungkan Gmail</b><br /><span className="small muted">supaya transaksi BSI & GoPay masuk otomatis</span></div>
          <span className="go" style={{ color: 'var(--primary)' }}>Atur →</span>
        </button>
      )}

      {inbox.length > 0 && <div className="tiny muted center" style={{ margin: '0 0 12px' }}>👉 geser kanan = terima saran · 👈 geser kiri = abaikan · ketuk = rapikan</div>}

      {inbox.length === 0 && <Empty icon="🎉" title="Inbox bersih" text="Semua transaksi sudah kamu rapikan." />}

      {inbox.map((t) => {
        const s = suggestionFor(t);
        const sCat = s?.categoryId != null ? store.catById.get(s.categoryId) : undefined;
        const acc = store.accById.get(t.accountId);
        const canAccept = !!s && (s.transfer || !!sCat);
        const label = s?.transfer ? '🔁 Transfer' : sCat ? `${sCat.icon} ${sCat.name}${t.kind === 'expense' ? (s?.forWhom === 'couple' ? ' · 💑' : ' · 👤') : ''}` : null;
        return (
          <SwipeCard
            key={t.id}
            rightEnabled={canAccept}
            rightLabel="Terima saran"
            leftLabel="Abaikan"
            onTap={() => nav(`/tx/${t.id}`)}
            onRight={async () => {
              await acceptSuggestion(t, s!);
              toast({ text: 'Disimpan sesuai saran', actionLabel: 'Batal', onAction: () => db.transactions.put(t) });
            }}
            onLeft={async () => {
              await setStatus(t.id!, 'ignored');
              toast({ text: 'Diabaikan', actionLabel: 'Batal', onAction: () => setStatus(t.id!, 'inbox') });
            }}
          >
            <div className="between" style={{ alignItems: 'flex-start' }}>
              <div className="grow">
                <div className={`amt ${t.kind === 'income' ? 'pos' : 'neg'}`}>{t.kind === 'income' ? '+' : '−'}Rp{num(t.amount)}</div>
                <div className="who">{t.counterparty || 'Tanpa nama'}</div>
              </div>
              {acc && <span className="src" style={{ background: `${acc.color}22`, color: acc.color }}>{acc.name}</span>}
            </div>
            <div className="row mt8">
              <span className="tiny muted">{relDay(t.date)} · {timeHM(t.date)}{t.source === 'manual' ? ' · manual' : ''}</span>
              {label ? <span className="suggest">{label}</span>
                : t.kind === 'income' ? <span className="suggest" style={{ background: 'var(--in-soft)', color: 'var(--in)' }}>Pemasukan</span>
                : <span className="suggest" style={{ background: 'var(--line)', color: 'var(--muted)' }}>Belum ada saran</span>}
            </div>
          </SwipeCard>
        );
      })}

      {ignored.length > 0 && (
        <div className="mt16">
          <button className="link" onClick={() => setShowIgnored(!showIgnored)}>{showIgnored ? 'Sembunyikan' : 'Lihat'} yang diabaikan ({ignored.length})</button>
          {showIgnored && (
            <div className="card">
              {ignored.map((t) => (
                <TxRow key={t.id} tx={t} account={store.accById.get(t.accountId)} cat={t.categoryId != null ? store.catById.get(t.categoryId) : undefined} onClick={() => nav(`/tx/${t.id}`)} />
              ))}
              <div className="tiny muted mt8">Ketuk untuk membuka, lalu Simpan untuk mengembalikannya.</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
