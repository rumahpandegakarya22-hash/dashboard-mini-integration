import { turso } from '@/lib/core/turso';
import { penerimaDariConfig } from '@/lib/laporan-bulanan/penerima';

// Simple in-memory cache — invalidated on setConfig
const cache = new Map<string, string>();

export async function getConfig(key: string): Promise<string | null> {
  if (cache.has(key)) return cache.get(key)!;
  const res = await turso().execute({ sql: 'SELECT value FROM app_config WHERE key = ?', args: [key] });
  const val = res.rows[0]?.[0] as string | null ?? null;
  if (val !== null) cache.set(key, val);
  return val;
}

export async function setConfig(key: string, value: string, updatedBy?: string): Promise<void> {
  await turso().execute({
    sql: 'INSERT INTO app_config (key, value, updated_by, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_by=excluded.updated_by, updated_at=excluded.updated_at',
    args: [key, value, updatedBy ?? null],
  });
  cache.set(key, value);
}

export const KUNCI_CC_INVOICE = 'invoice_email_cc';

/** Daftar CC invoice (disimpan sebagai teks dipisah koma). */
export async function getCcInvoice(): Promise<string[]> {
  // Baca langsung dari DB (bukan cache): di serverless tiap instance punya cache sendiri.
  const res = await turso().execute({ sql: 'SELECT value FROM app_config WHERE key = ?', args: [KUNCI_CC_INVOICE] });
  const v = String(res.rows[0]?.[0] ?? '');
  return v.split(',').map((s) => s.trim()).filter(Boolean);
}

export const KUNCI_EMAIL_LAPORAN = 'laporan_email_to';

/** Penerima email laporan bulanan. Baca langsung dari DB (bukan cache) agar cron tidak memakai daftar basi. */
export async function getPenerimaLaporan(): Promise<string[]> {
  const res = await turso().execute({ sql: 'SELECT value FROM app_config WHERE key = ?', args: [KUNCI_EMAIL_LAPORAN] });
  return penerimaDariConfig(res.rows[0]?.[0] as string | null | undefined);
}

export async function getAllConfig(): Promise<Record<string, string>> {
  const res = await turso().execute('SELECT key, value FROM app_config');
  const out: Record<string, string> = {};
  for (const row of res.rows) out[row[0] as string] = row[1] as string;
  return out;
}
