import { turso } from '../../core/turso';
import { parseDateISO, required } from '../../core/validate';
import type { SubmitHandler } from '../types';
import type { InsertConfig } from './helpers';

/** Dipakai submit dan edit (satu aturan validasi). `dicatat_oleh` hanya diisi saat submit. */
export const pelanggaranInsertCfg: InsertConfig = {
  table: 'pelanggaran_peraturan',
  target: 'Turso → pelanggaran_peraturan',
  buildRow: (values) => ({
    tanggal: parseDateISO(String(values.tanggal ?? '')),
    id_penghuni: required(values.penghuni, 'Penghuni'),
    jenis: required(values.jenis, 'Jenis Pelanggaran'),
    deskripsi: required(values.deskripsi, 'Deskripsi'),
    tindakan: String(values.tindakan ?? '').trim() || null
  })
};

export const submitPelanggaran: SubmitHandler = async (values, ctx) => {
  const row = pelanggaranInsertCfg.buildRow(values);
  const res = await turso().execute({
    sql: `INSERT INTO pelanggaran_peraturan (tanggal, id_penghuni, jenis, deskripsi, tindakan, dicatat_oleh)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [row.tanggal, row.id_penghuni, row.jenis, row.deskripsi, row.tindakan, ctx.user.username]
  });
  return { target: pelanggaranInsertCfg.target, row: Number(res.lastInsertRowid), data: { ...row } };
};
