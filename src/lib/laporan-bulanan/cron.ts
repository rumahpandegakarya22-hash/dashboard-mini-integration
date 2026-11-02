import { timingSafeEqual } from 'node:crypto';

export function pilihLaporanBelumAda(semuaId: string[], sudahAda: Set<string>): string[] {
  return semuaId.filter(id => !sudahAda.has(id));
}

export function cronDiizinkan(authHeader: string | null | undefined, secret: string | undefined): boolean {
  if (!secret || !authHeader) return false;
  const a = Buffer.from(authHeader);
  const b = Buffer.from(`Bearer ${secret}`);
  // timingSafeEqual melempar bila panjang beda, jadi cek panjang dulu.
  return a.length === b.length && timingSafeEqual(a, b);
}
