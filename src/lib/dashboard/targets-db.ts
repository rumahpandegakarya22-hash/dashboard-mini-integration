import { turso } from '@/lib/core/turso';
import { DEFINISI_TARGET, targetBawaan, type TargetMap } from './targets';

/** Nilai bawaan ditimpa baris tabel `kpi_target`. Gagal baca = pakai bawaan (dashboard tidak boleh mati karena ini). */
export async function loadTargets(): Promise<TargetMap> {
  const T = targetBawaan();
  try {
    const r = await turso().execute('SELECT kunci, nilai FROM kpi_target');
    const sah = new Set(DEFINISI_TARGET.map((t) => t.kunci));
    for (const row of r.rows) {
      const k = String(row.kunci);
      const n = Number(row.nilai);
      if (sah.has(k) && Number.isFinite(n)) T[k] = n;
    }
  } catch (e) {
    console.error('[targets] gagal baca kpi_target, pakai nilai bawaan:', (e as Error)?.message);
  }
  return T;
}
