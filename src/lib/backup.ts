import { ALL_TABLES, db, setMeta } from '../db';
import { blobToDataUrl, dataUrlToBlob } from './image';
import { toYMD } from './format';

const APP = 'duitku';
const VERSION = 1;

interface BackupFile {
  app: string;
  version: number;
  exportedAt: string;
  tables: Record<string, unknown[]>;
}

/** Buat file backup JSON (foto disimpan sebagai base64). */
export async function createBackup(): Promise<File> {
  const tables: Record<string, unknown[]> = {};
  for (const name of ALL_TABLES) {
    if (name === 'photos') continue;
    tables[name] = await db.table(name).toArray();
  }
  const photos = await db.photos.toArray();
  tables.photos = await Promise.all(photos.map(async (p) => ({ ...p, blob: await blobToDataUrl(p.blob) })));
  // jangan ikut-kan meta yang sifatnya per-device
  tables.meta = (tables.meta as { key: string }[]).filter((m) => !['pin', 'lastBackupAt'].includes(m.key));
  const data: BackupFile = { app: APP, version: VERSION, exportedAt: new Date().toISOString(), tables };
  const json = JSON.stringify(data);
  return new File([json], `duitku-backup-${toYMD(new Date())}.json`, { type: 'application/json' });
}

/** Bagikan ke Files/iCloud (iPhone) atau unduh (laptop). */
export async function shareBackup(): Promise<'shared' | 'downloaded'> {
  const file = await createBackup();
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  let result: 'shared' | 'downloaded';
  if (nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Backup DuitKu' });
      result = 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e;
      download(file);
      result = 'downloaded';
    }
  } else {
    download(file);
    result = 'downloaded';
  }
  await setMeta('lastBackupAt', new Date().toISOString());
  return result;
}

function download(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Pulihkan dari file backup. Data di HP ini akan DIGANTI seluruhnya. */
export async function restoreBackup(file: File): Promise<{ transactions: number; photos: number }> {
  const text = await file.text();
  let data: BackupFile;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('File bukan backup DuitKu yang valid');
  }
  if (data.app !== APP || !data.tables) throw new Error('File bukan backup DuitKu');
  const photos = await Promise.all(
    ((data.tables.photos ?? []) as { blob: string }[]).map(async (p) => ({ ...p, blob: await dataUrlToBlob(p.blob) }))
  );
  const pin = await db.meta.get('pin');
  await db.transaction('rw', ALL_TABLES.map((n) => db.table(n)), async () => {
    for (const name of ALL_TABLES) {
      await db.table(name).clear();
      const rows = name === 'photos' ? photos : (data.tables[name] ?? []);
      if (rows.length) await db.table(name).bulkAdd(rows);
    }
    if (pin) await db.meta.put(pin);
    await db.meta.put({ key: 'seeded', value: true });
  });
  return { transactions: (data.tables.transactions ?? []).length, photos: photos.length };
}

export async function wipeAll() {
  await db.transaction('rw', ALL_TABLES.map((n) => db.table(n)), async () => {
    for (const name of ALL_TABLES) await db.table(name).clear();
  });
}
