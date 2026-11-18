import type { Client } from '@libsql/client';
import { pastikanSkemaKamar } from './kamar-maintenance-skema';

/* =========================================================================
   Status Maintenance kamar. Murni DB (klien disuntik) supaya bisa diuji tanpa Turso asli.
   Pembungkus aplikasi + pembersih cache ada di kamar-maintenance.ts.

   Aturan: kamar Maintenance selama ada pemicu terbuka di kamar_maintenance.
   Semua pemicu tertutup → Terisi bila ada penghuni aktif, Booking bila ada booking
   yang belum check-in (Pending/Konfirmasi), selain itu Kosong.
   ========================================================================= */

export type SumberMaintenance = 'manual' | 'pengaduan' | 'inspeksi' | 'work_order';
export type StatusKamar = 'Maintenance' | 'Terisi' | 'Booking' | 'Kosong';

/** Status booking yang masih menahan kamar (belum check-in dan belum batal). */
export const STATUS_BOOKING_AKTIF = ['Pending', 'Konfirmasi'];

/** Kategori pengaduan Teman Rara yang berarti kerusakan fisik kamar/fasilitas. */
export const KATEGORI_PENGADUAN_KERUSAKAN = ['Listrik', 'Air', 'AC', 'Fasilitas'];

export const nomorKamar = (v: unknown): string => String(Number(String(v ?? '').replace(/\D/g, '')) || '').trim();

async function hitung(db: Client, sql: string, args: (string | number)[]): Promise<number> {
  const r = await db.execute({ sql, args });
  return Number(r.rows[0]?.[0] ?? 0);
}

export async function statusSeharusnya(db: Client, noKamar: string): Promise<StatusKamar> {
  await pastikanSkemaKamar(db);
  const terbuka = await hitung(db, 'SELECT COUNT(*) FROM kamar_maintenance WHERE no_kamar = ? AND ditutup_pada IS NULL', [noKamar]);
  if (terbuka > 0) return 'Maintenance';
  const huni = await hitung(db, 'SELECT COUNT(*) FROM active_tenant WHERE CAST(no_kamar AS INTEGER) = CAST(? AS INTEGER)', [noKamar]);
  if (huni > 0) return 'Terisi';
  const dibooking = await hitung(
    db,
    `SELECT COUNT(*) FROM booking WHERE kamar_no = CAST(? AS INTEGER) AND status_booking IN (${STATUS_BOOKING_AKTIF.map(() => '?').join(',')})`,
    [noKamar, ...STATUS_BOOKING_AKTIF]
  );
  return dibooking > 0 ? 'Booking' : 'Kosong';
}

/** Tulis status kamar sesuai keadaan terkini. Mengembalikan status yang ditulis. */
export async function selaraskanStatus(db: Client, noKamar: string): Promise<StatusKamar> {
  const status = await statusSeharusnya(db, noKamar);
  const res = await db.execute({ sql: 'UPDATE kamar SET status = ? WHERE CAST(no_kamar AS TEXT) = ?', args: [status, noKamar] });
  if (res.rowsAffected === 0) throw new Error(`Kamar ${noKamar} tidak ditemukan untuk update status.`);
  return status;
}

export async function bukaMaintenance(
  db: Client,
  p: { noKamar: string; sumber: SumberMaintenance; ref?: string; alasan?: string; oleh?: string }
): Promise<StatusKamar> {
  const kamar = nomorKamar(p.noKamar);
  if (!kamar) throw new Error('Nomor kamar tidak valid.');
  await pastikanSkemaKamar(db);
  await db.execute({
    sql: `INSERT OR IGNORE INTO kamar_maintenance (no_kamar, sumber, ref, alasan, dibuka_oleh) VALUES (?, ?, ?, ?, ?)`,
    args: [kamar, p.sumber, p.ref ?? '', p.alasan ?? null, p.oleh ?? null]
  });
  return selaraskanStatus(db, kamar);
}

/** Tutup pemicu menurut sumber+ref (mis. pengaduan selesai). Mengembalikan kamar yang statusnya diselaraskan. */
export async function tutupMaintenance(
  db: Client,
  p: { sumber: SumberMaintenance; ref: string; oleh?: string }
): Promise<string[]> {
  await pastikanSkemaKamar(db);
  const kena = await db.execute({
    sql: 'SELECT DISTINCT no_kamar FROM kamar_maintenance WHERE sumber = ? AND ref = ? AND ditutup_pada IS NULL',
    args: [p.sumber, p.ref]
  });
  if (!kena.rows.length) return [];
  await db.execute({
    sql: `UPDATE kamar_maintenance SET ditutup_pada = CURRENT_TIMESTAMP, ditutup_oleh = ?
          WHERE sumber = ? AND ref = ? AND ditutup_pada IS NULL`,
    args: [p.oleh ?? null, p.sumber, p.ref]
  });
  const kamar = kena.rows.map((r) => String(r.no_kamar));
  for (const k of kamar) await selaraskanStatus(db, k);
  return kamar;
}

/** Tutup pemicu satu kamar: semua sumber (tombol "Selesai") atau satu sumber tertentu (mis. inspeksi saat Kamar Siap). */
export async function tutupMaintenanceKamar(
  db: Client,
  p: { noKamar: string; sumber?: SumberMaintenance; oleh?: string }
): Promise<StatusKamar> {
  const kamar = nomorKamar(p.noKamar);
  await pastikanSkemaKamar(db);
  await db.execute({
    sql: `UPDATE kamar_maintenance SET ditutup_pada = CURRENT_TIMESTAMP, ditutup_oleh = ?
          WHERE no_kamar = ? AND ditutup_pada IS NULL ${p.sumber ? 'AND sumber = ?' : ''}`,
    args: p.sumber ? [p.oleh ?? null, kamar, p.sumber] : [p.oleh ?? null, kamar]
  });
  return selaraskanStatus(db, kamar);
}

export interface HasilSelarasSemua {
  perubahan: { no: string; dari: string; ke: StatusKamar }[];
  /** Kamar bertulis Maintenance tanpa pemicu terbuka (mis. diisi manual): tidak diubah, perlu dicek. */
  dilewati: string[];
}

/**
 * Selaraskan status SEMUA kamar dengan keadaan sebenarnya (penghuni aktif, booking, pemicu Maintenance).
 * `tulis: false` hanya menghitung (pratinjau). Dipakai tombol di halaman Status Kamar dan skrip CLI.
 */
export async function selaraskanSemua(db: Client, tulis: boolean): Promise<HasilSelarasSemua> {
  const kamar = await db.execute('SELECT no_kamar, status FROM kamar ORDER BY no_kamar');
  const hasil: HasilSelarasSemua = { perubahan: [], dilewati: [] };
  for (const r of kamar.rows) {
    const no = String(r.no_kamar);
    const lama = String(r.status ?? '').trim();
    const baru = await statusSeharusnya(db, no);
    if (lama.toLowerCase() === 'maintenance' && baru !== 'Maintenance') {
      hasil.dilewati.push(no);
      continue;
    }
    if (lama === baru) continue;
    hasil.perubahan.push({ no, dari: lama || '(kosong)', ke: baru });
    if (tulis) await selaraskanStatus(db, no);
  }
  return hasil;
}
