import { turso } from '../../core/turso';
import { parseDateISO, required } from '../../core/validate';
import type { SubmitHandler } from '../types';
import type { InsertConfig } from './helpers';

/** Dipakai submit dan edit (satu aturan validasi). `dicatat_oleh` hanya diisi saat submit. */
export const kecelakaanInsertCfg: InsertConfig = {
  table: 'kecelakaan_kerja',
  target: 'Turso → kecelakaan_kerja',
  buildRow: (values) => ({
    tanggal: parseDateISO(String(values.tanggal ?? '')),
    lokasi: required(values.lokasi, 'Lokasi'),
    petugas: required(values.petugas, 'Petugas'),
    kronologi: required(values.kronologi, 'Kronologi'),
    tindakan: String(values.tindakan ?? '').trim() || null
  })
};

export const submitKecelakaan: SubmitHandler = async (values, ctx) => {
  const row = kecelakaanInsertCfg.buildRow(values);
  const res = await turso().execute({
    sql: `INSERT INTO kecelakaan_kerja (tanggal, lokasi, petugas, kronologi, tindakan, dicatat_oleh)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [row.tanggal, row.lokasi, row.petugas, row.kronologi, row.tindakan, ctx.user.username]
  });
  return { target: kecelakaanInsertCfg.target, row: Number(res.lastInsertRowid), data: { ...row } };
};
