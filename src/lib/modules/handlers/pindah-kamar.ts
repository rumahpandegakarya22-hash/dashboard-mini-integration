import { turso } from '../../core/turso';
import { withLock } from '../../core/redis';
import { parseDateISO, required } from '../../core/validate';
import type { SubmitHandler } from '../types';

/**
 * Pindah Kamar berbasis database Turso (Mini App Improvement §5):
 *   1. Validasi: penghuni masih aktif; kamar baru ada, tidak Terisi, tidak
 *      ditempati penghuni lain, dan tanpa booking aktif (Konfirmasi/Check-in).
 *   2. INSERT rooms_transfer (histori perpindahan).
 *   3. UPDATE active_tenant.no_kamar berdasarkan ID unik penghuni
 *      (id_penghuni, fallback kamar_id utk data lama yang ID-nya kosong).
 *      BUG DIPERBAIKI 2026-07-21: dulu menulis ke tabel `penghuni` yang tidak
 *      pernah ada di Turso — submit modul ini pasti gagal. Lihat catatan di
 *      getPenghuniTurso() (src/lib/master.ts).
 *   4. UPSERT occupancy_history (PK id_penghuni → satu baris posisi terkini).
 * Langkah 2-4 dijalankan atomik via batch; lock per-kamar cegah race ganda.
 */
export const submitPindahKamar: SubmitHandler = async (values, ctx) => {
  const tanggal = parseDateISO(String(values.tanggal ?? ''));
  const idPenghuni = required(values.penghuni, 'Penghuni');
  const kamarBaru = required(values.kamarBaru, 'Kamar Baru');
  const alasan = required(values.alasan, 'Alasan');
  const notes = String(values.notes ?? '').trim();

  const db = turso();

  return withLock(`kamar:${kamarBaru}`, 15, async () => {
    // Penghuni masih aktif? (ada di active_tenant & masih menempati kamar)
    const p = await db.execute({
      sql: `SELECT COALESCE(id_penghuni, kamar_id) id, nama_lengkap, no_kamar
            FROM active_tenant WHERE COALESCE(id_penghuni, kamar_id) = ?`,
      args: [idPenghuni]
    });
    if (p.rows.length === 0) throw new Error('Penghuni tidak ditemukan / sudah tidak aktif.');
    const nama = String(p.rows[0].nama_lengkap ?? '');
    const kamarLama = String(p.rows[0].no_kamar ?? '');
    if (!kamarLama) throw new Error(`Penghuni "${nama}" tidak tercatat menempati kamar mana pun (tidak aktif).`);
    if (kamarLama === kamarBaru) throw new Error('Kamar baru sama dengan kamar lama.');

    // Kamar baru harus ada & kosong.
    const k = await db.execute({ sql: 'SELECT status FROM kamar WHERE CAST(no_kamar AS TEXT) = ?', args: [kamarBaru] });
    if (k.rows.length === 0) throw new Error(`Kamar ${kamarBaru} tidak ditemukan.`);
    if (String(k.rows[0].status ?? '').toLowerCase() === 'terisi') {
      throw new Error(`Kamar ${kamarBaru} berstatus Terisi — pilih kamar lain.`);
    }
    const occupied = await db.execute({
      sql: 'SELECT nama_lengkap FROM active_tenant WHERE CAST(no_kamar AS TEXT) = ? LIMIT 1',
      args: [kamarBaru]
    });
    if (occupied.rows.length > 0) {
      throw new Error(`Kamar ${kamarBaru} masih ditempati ${occupied.rows[0].nama_lengkap}.`);
    }

    // Tidak ada booking aktif di kamar baru.
    const b = await db.execute({
      sql: `SELECT no_booking FROM booking WHERE CAST(kamar_no AS TEXT) = ? AND status_booking IN ('Konfirmasi','Check-in') LIMIT 1`,
      args: [kamarBaru]
    });
    if (b.rows.length > 0) {
      throw new Error(`Kamar ${kamarBaru} punya booking aktif (${b.rows[0].no_booking}) — batalkan dulu atau pilih kamar lain.`);
    }

    // Tulis atomik: histori transfer + update penghuni + occupancy terkini.
    const idTransfer = `RT-${tanggal.replace(/-/g, '')}-${ctx.requestId.slice(0, 8)}`;
    await db.batch(
      [
        {
          sql: `INSERT INTO rooms_transfer (id_rooms_transfer, id_penghuni, no_kamar_lama, no_kamar_baru, tanggal, alasan, notes, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [idTransfer, idPenghuni, kamarLama, kamarBaru, tanggal, alasan, notes, ctx.user.username]
        },
        {
          sql: `UPDATE active_tenant SET no_kamar = ?, updated_at = CURRENT_TIMESTAMP
                WHERE COALESCE(id_penghuni, kamar_id) = ?`,
          args: [kamarBaru, idPenghuni]
        },
        {
          sql: `INSERT INTO occupancy_history (id_penghuni, nama, no_kamar, tanggal_mulai)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(id_penghuni) DO UPDATE SET no_kamar = excluded.no_kamar, tanggal_mulai = excluded.tanggal_mulai`,
          args: [idPenghuni, nama, kamarBaru, tanggal]
        }
      ],
      'write'
    );

    return {
      target: `Turso → rooms_transfer (${idTransfer})`,
      data: { ...values, idTransfer, kamarLama, nama },
      warning:
        'Status kamar di tabel kamar TIDAK diubah otomatis (dikelola dashboard) — pastikan status kamar lama/baru diperbarui bila perlu.'
    };
  });
};
