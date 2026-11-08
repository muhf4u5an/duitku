import { useEffect, useState } from 'react';
import { db } from '../db';
import type { Category, Kind } from '../types';
import { COLORS, EMOJIS, Sheet } from './ui';

/** Lembar untuk membuat / mengubah kategori. */
export function CategoryEditor({ open, onClose, kind, initial, onSaved }: {
  open: boolean; onClose: () => void; kind: Kind; initial?: Category; onSaved?: (id: number) => void;
}) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('📦');
  const [color, setColor] = useState(COLORS[0]);
  const [consumption, setConsumption] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
    setIcon(initial?.icon ?? '📦');
    setColor(initial?.color ?? COLORS[Math.floor(Math.random() * COLORS.length)]);
    setConsumption(initial?.isConsumption ?? true);
    setError('');
  }, [open, initial]);

  const save = async () => {
    if (!name.trim()) return setError('Kasih nama kategorinya');
    if (initial?.id) {
      await db.categories.update(initial.id, { name: name.trim(), icon, color, isConsumption: consumption });
      onSaved?.(initial.id);
    } else {
      const count = await db.categories.where('kind').equals(kind).count();
      const id = await db.categories.add({ name: name.trim(), icon, color, kind, isConsumption: consumption, archived: false, order: 50 + count });
      onSaved?.(id);
    }
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose}>
      <h2>{initial ? 'Ubah kategori' : `Kategori ${kind === 'income' ? 'pemasukan' : 'pengeluaran'} baru`}</h2>
      <div className="field">
        <label>Nama</label>
        <input className="inp" value={name} onChange={(e) => { setName(e.target.value); setError(''); }} placeholder="Hadiah pacar" autoFocus />
        {error && <div className="err">{error}</div>}
      </div>
      <div className="field">
        <label>Ikon</label>
        <div className="emojis">
          {EMOJIS.map((e) => <button key={e} className={icon === e ? 'on' : ''} onClick={() => setIcon(e)}>{e}</button>)}
        </div>
      </div>
      <div className="field">
        <label>Warna</label>
        <div className="colors">
          {COLORS.map((c) => <button key={c} className={color === c ? 'on' : ''} style={{ background: c }} onClick={() => setColor(c)} aria-label={c} />)}
        </div>
      </div>
      {kind === 'expense' && (
        <label className="row mt12 small" style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={!consumption} onChange={(e) => setConsumption(!e.target.checked)} />
          Bukan pengeluaran konsumsi (mis. investasi, tabungan). Tidak dihitung di rata-rata harian.
        </label>
      )}
      <div className="btnrow">
        <button className="btn ghost" onClick={onClose}>Batal</button>
        <button className="btn" onClick={save}>Simpan</button>
      </div>
    </Sheet>
  );
}
