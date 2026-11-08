import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../db';
import type { ForWhom } from '../types';
import { AmountInput, BackHeader, EMOJIS, useToast } from '../components/ui';

export default function PlanForm() {
  const { id } = useParams();
  const editing = id ? Number(id) : null;
  const nav = useNavigate();
  const toast = useToast();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🎁');
  const [target, setTarget] = useState(0);
  const [hasDate, setHasDate] = useState(true);
  const [dueDate, setDueDate] = useState('');
  const [forWhom, setForWhom] = useState<ForWhom>('self');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!editing) return;
    db.plans.get(editing).then((p) => {
      if (!p) return;
      setName(p.name); setIcon(p.icon); setTarget(p.target); setHasDate(!!p.dueDate);
      setDueDate(p.dueDate ?? ''); setForWhom(p.forWhom); setNote(p.note);
    });
  }, [editing]);

  const save = async () => {
    if (!name.trim()) return setError('Kasih nama rencananya');
    if (!target) return setError('Isi budget/target');
    if (hasDate && !dueDate) return setError('Pilih tanggal, atau matikan "Ada tanggal"');
    const data = { name: name.trim(), icon, target, dueDate: hasDate ? dueDate : undefined, forWhom, note: note.trim() };
    if (editing) {
      await db.plans.update(editing, data);
      toast('Rencana diperbarui');
      nav(-1);
    } else {
      const newId = await db.plans.add({ ...data, status: 'active', realizedTxIds: [], createdAt: new Date().toISOString() });
      toast('Rencana dibuat');
      nav(`/plans/${newId}`, { replace: true });
    }
  };

  return (
    <div className="page no-tab">
      <BackHeader title={editing ? 'Ubah rencana' : 'Rencana baru'} />
      <div className="field">
        <label>Nama rencana</label>
        <input className="inp" value={name} onChange={(e) => { setName(e.target.value); setError(''); }} placeholder="Kado ulang tahun" autoFocus={!editing} />
      </div>
      <div className="field">
        <label>Budget / target (Rp)</label>
        <AmountInput value={target} onChange={(n) => { setTarget(n); setError(''); }} className="inp amount" />
      </div>
      <div className="field">
        <label className="row" style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={hasDate} onChange={(e) => setHasDate(e.target.checked)} /> Ada tanggal / tenggat
        </label>
        {hasDate
          ? <input className="inp mt8" type="date" value={dueDate} onChange={(e) => { setDueDate(e.target.value); setError(''); }} />
          : <div className="tiny muted mt8">Tanpa tanggal = wishlist. App akan memperkirakan kapan kamu mampu membelinya.</div>}
      </div>
      <div className="field">
        <label>Untuk siapa</label>
        <div className="seg">
          <button className={forWhom === 'self' ? 'on' : ''} onClick={() => setForWhom('self')}>👤 Sendiri</button>
          <button className={forWhom === 'couple' ? 'on' : ''} onClick={() => setForWhom('couple')}>💑 Berdua</button>
        </div>
      </div>
      <div className="field">
        <label>Ikon</label>
        <div className="emojis">{EMOJIS.map((e) => <button key={e} className={icon === e ? 'on' : ''} onClick={() => setIcon(e)}>{e}</button>)}</div>
      </div>
      <div className="field">
        <label>Catatan</label>
        <textarea className="inp" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ide kado: jam tangan" />
      </div>
      {error && <div className="err center mt12">{error}</div>}
      <button className="btn mt16" onClick={save}>Simpan</button>
    </div>
  );
}
