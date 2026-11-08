import { db, getMeta, setMeta } from '../db';
import type { Transaction } from '../types';

export interface GmailConfig {
  url: string;
  token: string;
}

/** Format satu baris dari Google Apps Script (lihat apps-script/Code.gs) */
export interface ImportRow {
  id: number;
  messageId: string;
  account: string;
  direction: 'in' | 'out';
  amount: number;
  counterparty: string;
  date: string;
}

export async function getGmailConfig(): Promise<GmailConfig | null> {
  const c = await getMeta<GmailConfig | null>('gmail', null);
  return c && c.url ? c : null;
}

async function fetchRows(cfg: GmailConfig, since: number): Promise<ImportRow[]> {
  const u = new URL(cfg.url);
  u.searchParams.set('token', cfg.token);
  u.searchParams.set('since', String(since));
  const res = await fetch(u.toString(), { redirect: 'follow' });
  if (!res.ok) throw new Error(`Server membalas ${res.status}`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'Token salah atau script error');
  return data.rows as ImportRow[];
}

/** Uji koneksi tanpa menyimpan apa pun. */
export async function testGmail(cfg: GmailConfig): Promise<number> {
  const rows = await fetchRows(cfg, 0);
  return rows.length;
}

let running: Promise<number> | null = null;

/** Tarik transaksi baru dari Google Sheet ke Inbox. Mengembalikan jumlah yang ditambahkan. */
export function syncGmail(): Promise<number> {
  if (running) return running;
  running = (async () => {
    const cfg = await getGmailConfig();
    if (!cfg) return 0;
    const since = await getMeta<number>('lastImportedId', 0);
    const rows = await fetchRows(cfg, since);
    const accounts = await db.accounts.toArray();
    const pickAccount = (name: string) =>
      accounts.find((a) => a.name.toLowerCase() === name.toLowerCase())?.id ??
      accounts.find((a) => name.toLowerCase().includes(a.name.toLowerCase()))?.id ??
      accounts[0]?.id ?? 1;

    let added = 0;
    let maxId = since;
    await db.transaction('rw', db.transactions, db.meta, async () => {
      for (const r of rows) {
        maxId = Math.max(maxId, r.id);
        if (!r.amount || !r.messageId) continue;
        const exists = await db.transactions.where('sourceId').equals(r.messageId).count();
        if (exists) continue;
        const now = new Date().toISOString();
        const tx: Transaction = {
          status: 'inbox',
          source: 'gmail',
          sourceId: r.messageId,
          accountId: pickAccount(r.account),
          kind: r.direction === 'in' ? 'income' : 'expense',
          amount: Math.round(r.amount),
          counterparty: (r.counterparty || r.account || '').trim(),
          date: r.date ? new Date(r.date).toISOString() : now,
          items: [],
          note: '',
          photoIds: [],
          createdAt: now
        };
        await db.transactions.add(tx);
        added++;
      }
      await setMeta('lastImportedId', maxId);
      await setMeta('lastSyncAt', new Date().toISOString());
    });
    return added;
  })().finally(() => {
    running = null;
  });
  return running;
}
