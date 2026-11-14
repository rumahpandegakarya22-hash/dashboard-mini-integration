import { turso } from '../../core/turso';
import { required } from '../../core/validate';
import type { SubmitHandler } from '../types';
import type { InsertConfig } from './helpers';

export const PERIODE_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Dipakai submit dan edit (satu aturan validasi). */
export const csatInsertCfg: InsertConfig = {
  table: 'csat_response',
  target: 'Turso -> csat_response',
  buildRow: (values) => {
    const periode = String(values.periode ?? '').trim();
    if (!PERIODE_RE.test(periode)) throw new Error('Periode tidak valid (format YYYY-MM).');
    const skor = Number(values.skor);
    if (!Number.isInteger(skor) || skor < 1 || skor > 5) throw new Error('Skor harus 1 sampai 5.');
    return {
      id_penghuni: required(values.penghuni, 'Penghuni'),
      periode,
      skor,
      komentar: String(values.komentar ?? '').trim() || null
    };
  }
};

/** Satu skor per penghuni per bulan: input ulang di bulan yang sama menimpa skor lama. */
export const submitKepuasanPenghuni: SubmitHandler = async (values, ctx) => {
  const row = csatInsertCfg.buildRow(values);
  await turso().execute({
    sql: `INSERT INTO csat_response (id_penghuni, periode, skor, komentar, dicatat_oleh)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT (id_penghuni, periode) DO UPDATE SET skor = excluded.skor, komentar = excluded.komentar,
            dicatat_oleh = excluded.dicatat_oleh`,
    args: [row.id_penghuni, row.periode, row.skor, row.komentar, ctx.user.username]
  });
  return { target: 'Turso -> csat_response', data: { ...row } };
};
