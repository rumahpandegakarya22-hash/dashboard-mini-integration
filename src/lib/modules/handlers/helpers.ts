import { appendRow, assertHeaders } from '../../sheets';
import { turso } from '../../turso';
import type { SubmitContext, SubmitHandler } from '../types';

export interface AppendConfig {
  spreadsheetId: string;
  range: string; // mis. "'Log Survey'!A:M"
  headerRange: string; // mis. "'Log Survey'!A1:M1"
  expectedHeaders: string[]; // TEBAKAN dari PRD kecuali dicatat lain — assertHeaders menolak submit jika beda (bukan silent-wrong-column)
  target: string; // label audit, mis. "Log Sales → Log Survey"
  buildRow: (values: Record<string, unknown>) => (string | number | null)[];
  // Modul dgn field upload `lampiran` (Improvement v1.1 §1): metadata + URL Drive
  // disimpan ke tabel Turso `dokumen` setelah baris sheet tercatat.
  lampiran?: { judul: (values: Record<string, unknown>) => string; role: string };
}

/**
 * Simpan URL lampiran (field `lampiran`, sudah di Drive via /api/upload) ke tabel Turso
 * `dokumen`. Best-effort: data utama sudah tercatat, gagal simpan link tidak membatalkan
 * submit — kembalikan warning supaya user tahu link harus dicatat manual.
 */
export async function saveLampiran(
  values: Record<string, unknown>,
  ctx: SubmitContext,
  judul: string,
  role: string
): Promise<string | undefined> {
  const url = String(values.lampiran ?? '').trim();
  if (!/^https:\/\//.test(url)) return undefined; // tidak ada lampiran / belum terunggah
  const idDokumen = `DOC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${ctx.requestId.slice(0, 8)}`;
  try {
    await turso().execute({
      sql: 'INSERT INTO dokumen (id_dokumen, judul, role, link_drive) VALUES (?, ?, ?, ?)',
      args: [idDokumen, judul.slice(0, 120), role, url]
    });
    return undefined;
  } catch (e: any) {
    console.error('[lampiran] gagal simpan ke dokumen:', e?.message);
    return `Data tersimpan, tapi link lampiran gagal dicatat ke database — simpan manual: ${url}`;
  }
}

/** Factory handler untuk modul append-only sederhana (tanpa lock resource / cross-check khusus). */
export function createAppendHandler(cfg: AppendConfig): SubmitHandler {
  return async (values, ctx) => {
    const row = cfg.buildRow(values);
    await assertHeaders(cfg.spreadsheetId, cfg.headerRange, cfg.expectedHeaders);
    const rowNum = await appendRow(cfg.spreadsheetId, cfg.range, row);
    const warning = cfg.lampiran ? await saveLampiran(values, ctx, cfg.lampiran.judul(values), cfg.lampiran.role) : undefined;
    return { target: cfg.target, row: rowNum, data: values, warning };
  };
}
