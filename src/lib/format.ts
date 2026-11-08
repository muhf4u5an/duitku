const nf = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });

/** 45000 -> "Rp45.000" */
export function rp(n: number): string {
  const sign = n < 0 ? '−' : '';
  return `${sign}Rp${nf.format(Math.abs(Math.round(n)))}`;
}

/** 45000 -> "45.000" */
export function num(n: number): string {
  return nf.format(Math.round(n));
}

/** Versi ringkas: 1250000 -> "1,25 jt", 450000 -> "450rb" */
export function rpShort(n: number): string {
  const a = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (a >= 1_000_000_000) return `${sign}${trim(a / 1_000_000_000)} M`;
  if (a >= 1_000_000) return `${sign}${trim(a / 1_000_000)} jt`;
  if (a >= 1_000) return `${sign}${trim(a / 1_000, 0)}rb`;
  return `${sign}${Math.round(a)}`;
}

function trim(v: number, maxDigits = 2): string {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: maxDigits }).format(v);
}

/** "12.500" / "Rp 12.500" / "12500" -> 12500 */
export function parseAmount(s: string): number {
  const digits = s.replace(/[^\d]/g, '');
  return digits ? parseInt(digits, 10) : 0;
}

export const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  const now = new Date();
  return y === now.getFullYear() ? MONTHS[m - 1] : `${MONTHS[m - 1]} ${y}`;
}

export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number);
  return monthKey(new Date(y, m - 1 + delta, 1));
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** "2026-11-30" -> Date lokal tengah malam */
export function parseYMD(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86_400_000);
}

export function dateShort(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

export function dateLong(d: Date): string {
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

export function timeHM(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "Hari ini", "Kemarin", atau "6 Nov" */
export function relDay(iso: string): string {
  const diff = daysBetween(new Date(iso), new Date());
  if (diff === 0) return 'Hari ini';
  if (diff === 1) return 'Kemarin';
  return dateShort(iso);
}

/** Untuk <input type="datetime-local"> */
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Warna hex + alpha transparan untuk latar ikon */
export function tint(hex: string, alpha = 0.16): string {
  const a = Math.round(alpha * 255).toString(16).padStart(2, '0');
  return `${hex}${a}`;
}
