import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Account, Category, Transaction } from '../types';
import { num, parseAmount, relDay, rp, timeHM, tint } from '../lib/format';

/* ---------- Toast ---------- */
interface ToastMsg { text: string; actionLabel?: string; onAction?: () => void }
const ToastCtx = createContext<(m: ToastMsg | string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<ToastMsg | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = useCallback((m: ToastMsg | string) => {
    setMsg(typeof m === 'string' ? { text: m } : m);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMsg(null), 3500);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg && (
        <div className="toast" role="status">
          <span>{msg.text}</span>
          {msg.actionLabel && (
            <button onClick={() => { msg.onAction?.(); setMsg(null); }}>{msg.actionLabel}</button>
          )}
        </div>
      )}
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

/* ---------- Header ---------- */
export function BackHeader({ title, right }: { title: string; right?: ReactNode }) {
  const nav = useNavigate();
  return (
    <div className="hdr">
      <button className="iconbtn" onClick={() => nav(-1)} aria-label="Kembali">←</button>
      <div className="title">{title}</div>
      <div style={{ minWidth: 38, display: 'flex', justifyContent: 'flex-end' }}>{right}</div>
    </div>
  );
}

/* ---------- Ikon kategori ---------- */
export function CatIcon({ cat, size, fallback = '❔' }: { cat?: Category; size?: 'lg'; fallback?: string }) {
  return (
    <div className={`cat ${size ?? ''}`} style={{ background: cat ? tint(cat.color) : 'var(--line)' }}>
      {cat?.icon ?? fallback}
    </div>
  );
}

/* ---------- Baris transaksi ---------- */
export function TxRow({ tx, cat, account, onClick, showDate = true }: {
  tx: Transaction; cat?: Category; account?: Account; onClick?: () => void; showDate?: boolean;
}) {
  const desc = [
    account?.name,
    tx.transfer ? '🔁 Transfer' : tx.forWhom === 'couple' ? '💑 Berdua' : tx.forWhom === 'self' ? '👤 Sendiri' : null,
    tx.status === 'inbox' ? '📥 belum dicek' : null,
    tx.photoIds.length ? '📎' : null,
    showDate ? `${relDay(tx.date)} ${timeHM(tx.date)}` : null
  ].filter(Boolean).join(' · ');
  const name = tx.items.length === 1 ? `${tx.counterparty || cat?.name} · ${tx.items[0].name}` : tx.counterparty || cat?.name || 'Transaksi';
  return (
    <button className="tx" onClick={onClick}>
      <CatIcon cat={cat} fallback={tx.transfer ? '🔁' : tx.source === 'adjustment' ? '⚖️' : '❔'} />
      <div className="grow">
        <div className="nm">{name}</div>
        <div className="ds">{desc}</div>
      </div>
      <div className={`am ${tx.kind === 'income' ? 'pos' : 'neg'}`}>{tx.kind === 'income' ? '+' : '−'}{num(tx.amount)}</div>
    </button>
  );
}

/* ---------- Input nominal (otomatis titik ribuan) ---------- */
export function AmountInput({ value, onChange, className = 'inp', placeholder = '0', autoFocus }: {
  value: number; onChange: (n: number) => void; className?: string; placeholder?: string; autoFocus?: boolean;
}) {
  return (
    <input
      className={className}
      inputMode="numeric"
      autoFocus={autoFocus}
      placeholder={placeholder}
      value={value ? num(value) : ''}
      onChange={(e) => onChange(parseAmount(e.target.value))}
    />
  );
}

/* ---------- Lembar bawah ---------- */
export function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="sheet-wrap" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
}

/* ---------- Foto dari Blob ---------- */
export function BlobImg({ blob, alt = '' }: { blob: Blob; alt?: string }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url ? <img src={url} alt={alt} /> : null;
}

/* ---------- Progress bar ---------- */
export function Bar({ ratio, color }: { ratio: number; color?: string }) {
  const c = color ?? (ratio >= 1 ? 'var(--out)' : ratio >= 0.8 ? 'var(--warn)' : 'var(--in)');
  return <div className="bar"><i style={{ width: `${Math.min(100, Math.max(0, ratio * 100))}%`, background: c }} /></div>;
}

export function Money({ n, className = '' }: { n: number; className?: string }) {
  return <span className={className}>{rp(n)}</span>;
}

export function Empty({ icon, title, text, children }: { icon: string; title: string; text?: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="e">{icon}</div>
      <b>{title}</b>
      {text && <div className="small">{text}</div>}
      {children}
    </div>
  );
}

export const EMOJIS = ['🍜', '☕', '🍔', '🛒', '🎓', '💼', '⛽', '🔧', '🏍️', '🚗', '📈', '💰', '➕', '📦', '🏠', '💡', '📱', '🎮', '🎬', '👕', '💊', '🏥', '🎁', '🌸', '💍', '✈️', '🏖️', '👟', '📚', '💻', '🐱', '🙏', '💸', '🧾', '🎉', '🍰', '🧴', '✂️', '🚌', '🅿️'];
export const COLORS = ['#F39C12', '#6C5CE7', '#0984E3', '#E17055', '#00B894', '#E84393', '#16A085', '#D63031', '#FDCB6E', '#636E72', '#95A5A6', '#2D3436'];
