import { useState } from 'react';
import { checkPin } from '../lib/pin';

const LEN = 4;

export function PinPad({ title, subtitle, onComplete, error }: {
  title: string; subtitle?: string; error?: string; onComplete: (pin: string) => void | Promise<void>;
}) {
  const [pin, setPin] = useState('');
  const press = async (d: string) => {
    if (pin.length >= LEN) return;
    const next = pin + d;
    setPin(next);
    if (next.length === LEN) {
      await onComplete(next);
      setPin('');
    }
  };
  return (
    <>
      <div style={{ fontSize: 40 }}>🔒</div>
      <div className="bold" style={{ fontSize: 18, marginTop: 8 }}>{title}</div>
      {subtitle && <div className="small muted mt8 center">{subtitle}</div>}
      <div className="dots">{Array.from({ length: LEN }, (_, i) => <i key={i} className={i < pin.length ? 'f' : ''} />)}</div>
      {error && <div className="err" style={{ marginTop: -16, marginBottom: 14 }}>{error}</div>}
      <div className="keypad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => <button key={d} onClick={() => press(d)}>{d}</button>)}
        <button className="blank" disabled />
        <button onClick={() => press('0')}>0</button>
        <button className="blank" onClick={() => setPin(pin.slice(0, -1))} aria-label="Hapus">⌫</button>
      </div>
    </>
  );
}

export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [error, setError] = useState<string>();
  return (
    <div className="lock">
      <PinPad
        title="Masukkan PIN"
        error={error}
        onComplete={async (p) => {
          if (await checkPin(p)) onUnlock();
          else setError('PIN salah, coba lagi');
        }}
      />
    </div>
  );
}
