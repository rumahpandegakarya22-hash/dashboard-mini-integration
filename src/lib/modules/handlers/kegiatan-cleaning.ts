import type { Client } from '@libsql/client';
import { turso } from '../../core/turso';
import { parseDateISO } from '../../core/validate';
import { fmtTanggal } from '../../format-tanggal';
import { bacaFoto, type FotoKegiatan } from '../../kegiatan-cleaning/foto';
import { pastikanSkemaKegiatanCleaning } from '../../kegiatan-cleaning/skema';
import { saveLampiran } from './helpers';
import type { SubmitHandler } from '../types';

/** Simpan satu entri kegiatan + foto-fotonya dalam satu transaksi. Mengembalikan id entri. */
export async function simpanKegiatanCleaning(
  db: Client,
  p: { tanggal: string; petugas: string; catatan: string | null; oleh: string; foto: FotoKegiatan[] }
): Promise<number> {
  await pastikanSkemaKegiatanCleaning(db);
  const tx = await db.transaction('write');
  try {
    const r = await tx.execute({
      sql: 'INSERT INTO kegiatan_cleaning (tanggal, petugas, catatan, dibuat_oleh) VALUES (?, ?, ?, ?)',
      args: [p.tanggal, p.petugas, p.catatan, p.oleh]
    });
    const id = Number(r.lastInsertRowid);
    for (const [i, f] of p.foto.entries()) {
      await tx.execute({
        sql: 'INSERT INTO kegiatan_cleaning_foto (kegiatan_id, jenis, link_drive, urutan) VALUES (?, ?, ?, ?)',
        args: [id, f.jenis, f.url, i + 1]
      });
    }
    await tx.commit();
    return id;
  } catch (e) {
    await tx.rollback();
    throw e;
  } finally {
    tx.close();
  }
}

export const submitKegiatanCleaning: SubmitHandler = async (values, ctx) => {
  const tanggal = parseDateISO(String(values.tanggal ?? ''));
  const foto = bacaFoto(values.fotoKegiatan);
  const catatan = String(values.catatan ?? '').trim() || null;
  // Petugas = akun yang login, supaya nama di stempel foto dan di catatan selalu sama.
  const petugas = ctx.user.name || ctx.user.username;

  const id = await simpanKegiatanCleaning(turso(), { tanggal, petugas, catatan, oleh: ctx.user.username, foto });

  // Daftarkan tiap foto ke tabel `dokumen` (best-effort; data utama sudah tersimpan).
  const peringatan: string[] = [];
  for (const [i, f] of foto.entries()) {
    const w = await saveLampiran(
      { [`lampiranF${i + 1}`]: f.url },
      ctx,
      `Kegiatan Cleaning — ${f.jenis} (${fmtTanggal(tanggal)})`,
      'Cleaning',
      { field: `lampiranF${i + 1}` }
    );
    if (w) peringatan.push(w);
  }

  return {
    target: `Turso → kegiatan_cleaning (${id})`,
    row: id,
    data: { tanggal, petugas, jumlahFoto: foto.length },
    warning: peringatan.length ? peringatan[0] : undefined
  };
};
