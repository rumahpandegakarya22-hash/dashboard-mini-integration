import { timingSafeEqual } from 'node:crypto';

export type HasilCron = { id: string; status: 'dibuat' | 'dilewati' | 'gagal'; error?: string };

export interface DepsCron {
  laporan: { id: string }[];
  kode: string;
  sudahAda(id: string): Promise<boolean>;
  generate(id: string): Promise<unknown>;
}

// Satu laporan gagal (termasuk saat cek riwayat) tidak menghentikan laporan berikutnya.
export async function jalankanCron(deps: DepsCron): Promise<HasilCron[]> {
  const hasil: HasilCron[] = [];
  for (const l of deps.laporan) {
    try {
      if (await deps.sudahAda(l.id)) {
        hasil.push({ id: l.id, status: 'dilewati' });
        continue;
      }
      await deps.generate(l.id);
      hasil.push({ id: l.id, status: 'dibuat' });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Gagal membuat laporan.';
      console.error('[cron laporan]', l.id, message);
      hasil.push({ id: l.id, status: 'gagal', error: message });
    }
  }
  return hasil;
}

export function cronDiizinkan(authHeader: string | null | undefined, secret: string | undefined): boolean {
  if (!secret || !authHeader) return false;
  const a = Buffer.from(authHeader);
  const b = Buffer.from(`Bearer ${secret}`);
  // timingSafeEqual melempar bila panjang beda, jadi cek panjang dulu.
  return a.length === b.length && timingSafeEqual(a, b);
}
