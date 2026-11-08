import { getMeta, setMeta, db } from '../db';

interface PinRecord {
  salt: string;
  hash: string;
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hasPin(): Promise<boolean> {
  return !!(await getMeta<PinRecord | null>('pin', null));
}

export async function setPin(pin: string) {
  const salt = Array.from(crypto.getRandomValues(new Uint8Array(16))).map((b) => b.toString(16).padStart(2, '0')).join('');
  await setMeta('pin', { salt, hash: await sha256(salt + pin) });
}

export async function removePin() {
  await db.meta.delete('pin');
}

export async function checkPin(pin: string): Promise<boolean> {
  const rec = await getMeta<PinRecord | null>('pin', null);
  if (!rec) return true;
  return (await sha256(rec.salt + pin)) === rec.hash;
}
