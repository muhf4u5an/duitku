import { useRef, useState, type ReactNode } from 'react';

const THRESHOLD = 90;

/** Kartu yang bisa digeser: kanan = terima, kiri = abaikan, ketuk = buka. */
export function SwipeCard({ children, onRight, onLeft, onTap, rightLabel, leftLabel, rightEnabled = true }: {
  children: ReactNode; onRight: () => void; onLeft: () => void; onTap: () => void;
  rightLabel: string; leftLabel: string; rightEnabled?: boolean;
}) {
  const [dx, setDx] = useState(0);
  const [anim, setAnim] = useState(false);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const horizontal = useRef<boolean | null>(null);

  const end = (commit: boolean) => {
    const d = dx;
    start.current = null;
    horizontal.current = null;
    setAnim(true);
    if (commit && d > THRESHOLD && rightEnabled) {
      setDx(500);
      setTimeout(onRight, 180);
    } else if (commit && d < -THRESHOLD) {
      setDx(-500);
      setTimeout(onLeft, 180);
    } else {
      setDx(0);
    }
  };

  const bg = dx > 0 ? (rightEnabled ? 'var(--in)' : 'var(--muted)') : 'var(--out)';

  return (
    <div className="swipe">
      <div className="swipe-bg" style={{ background: bg }}>
        <span style={{ opacity: dx > 0 ? 1 : 0 }}>{rightEnabled ? `✓ ${rightLabel}` : 'Ketuk untuk merapikan'}</span>
        <span style={{ opacity: dx < 0 ? 1 : 0 }}>{leftLabel} ✕</span>
      </div>
      <div
        className="ibx"
        style={{ transform: `translateX(${dx}px)`, transition: anim ? 'transform .18s ease-out' : 'none' }}
        onPointerDown={(e) => { start.current = { x: e.clientX, y: e.clientY, id: e.pointerId }; setAnim(false); }}
        onPointerMove={(e) => {
          if (!start.current) return;
          const ddx = e.clientX - start.current.x;
          const ddy = e.clientY - start.current.y;
          if (horizontal.current === null && (Math.abs(ddx) > 8 || Math.abs(ddy) > 8)) {
            horizontal.current = Math.abs(ddx) > Math.abs(ddy);
            if (horizontal.current) {
              try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* pointer sudah lepas */ }
            }
          }
          if (horizontal.current) setDx(ddx);
        }}
        onPointerUp={() => {
          if (!start.current) return;
          if (horizontal.current) end(true);
          else { start.current = null; horizontal.current = null; onTap(); }
        }}
        onPointerCancel={() => end(false)}
      >
        {children}
      </div>
    </div>
  );
}
