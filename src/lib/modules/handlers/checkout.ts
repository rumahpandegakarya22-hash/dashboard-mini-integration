import { turso } from '../../core/turso';
import { withLock } from '../../core/redis';
import { parseDateISO, parseRupiahOptional, required } from '../../core/validate';
import { getTenantByLabel, invalidateTenantsCache, updateRoomStatus } from '../../master';
import { saveLampiran } from './helpers';
import type { SubmitHandler } from '../types';

/**
 * Checkout penghuni — Wave 3 migrasi Sheets → Turso.
 * Dulu: append ke spreadsheet CHECKOUT 'Log Checkout'!A:J + set status kamar.
 *
 * Sekarang tiga efek, sedapat mungkin memakai ULANG mekanisme yang sudah ada
 * di database (bukan menduplikasi logikanya di aplikasi):
 *
 *  1. INSERT `checkout_log` — data yang tidak punya rumah di tabel lain
 *     (deposit, kondisi kamar, tunggakan, catatan kerusakan).
 *  2. Akhiri masa huni. Database SUDAH punya konvensinya lewat trigger
 *     `trg_booking_checkout_upd`: begitu booking.status_booking jadi
 *     'Check-out', trigger meng-UPDATE occupancy_history (status +
 *     tanggal_selesasi) DAN meng-DELETE baris active_tenant. Jadi jalur utama
 *     di sini cukup mengubah status booking, lalu trigger yang bekerja.
 *     FALLBACK: penghuni lama yang check-in sebelum sistem booking TIDAK punya
 *     baris booking (lihat derivePenghuni di lib/dashboard/source.ts) — untuk
 *     mereka efek yang sama dikerjakan manual, meniru isi trigger persis.
 *  3. Status kamar → 'Kosong' (updateRoomStatus, sudah Turso sejak Wave 1).
 *
 * Catatan lama "Database Penghuni READ-ONLY jadi status penghuni tidak ditulis
 * app, asumsinya dihitung dari baris checkout" TIDAK BERLAKU lagi: dengan Turso,
 * penghuni benar-benar dikeluarkan dari `active_tenant`, sehingga ia langsung
 * hilang dari dropdown penghuni aktif — dulu ia tetap muncul walau sudah keluar.
 */
export const submitCheckout: SubmitHandler = async (values, ctx) => {
  const tanggalCheckout = parseDateISO(String(values.tanggalCheckout ?? ''));
  const penghuni = required(values.penghuni, 'Penghuni'); // format baku "KTD-x — Nama"
  const tglMasuk = values.tglMasuk ? parseDateISO(String(values.tglMasuk)) : null;
  const adaTunggakan = required(values.adaTunggakan, 'Tunggakan?');
  if (adaTunggakan !== 'Ya' && adaTunggakan !== 'Tidak') throw new Error('Nilai Tunggakan? tidak valid.');
  const nominalTunggakan = adaTunggakan === 'Ya' ? parseRupiahOptional(values.nominalTunggakan) : 0;
  const pengembalianDeposit = parseRupiahOptional(values.pengembalianDeposit);
  const kondisiKamar = required(values.kondisiKamar, 'Kondisi Kamar');
  const catatanKerusakan = String(values.catatanKerusakan ?? '').trim();

  const db = turso();

  return withLock(`penghuni:${penghuni}`, 15, async () => {
    const tenant = await getTenantByLabel(penghuni);
    if (!tenant?.kamar) throw new Error(`Kamar tidak terdeteksi untuk penghuni "${penghuni}".`);
    const kamar = tenant.kamar;
    const idPenghuni = tenant.id;

    // Booking aktif penghuni ini (kalau ada) — penentu jalur utama vs fallback.
    const bk = await db.execute({
      sql: `SELECT no_booking FROM booking
            WHERE id_penghuni = ? AND COALESCE(status_booking,'') != 'Check-out'
            ORDER BY tanggal_booking DESC LIMIT 1`,
      args: [idPenghuni]
    });
    const noBooking = bk.rows.length > 0 ? String(bk.rows[0].no_booking) : null;

    const stmts: { sql: string; args: (string | number | null)[] }[] = [
      {
        sql: `INSERT INTO checkout_log
                (id_penghuni, penghuni_label, no_kamar, tanggal_checkout, tgl_masuk,
                 ada_tunggakan, nominal_tunggakan, pengembalian_deposit,
                 kondisi_kamar, catatan_kerusakan, diinput_oleh)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          idPenghuni || null,
          penghuni,
          kamar,
          tanggalCheckout,
          tglMasuk,
          adaTunggakan,
          nominalTunggakan,
          pengembalianDeposit,
          kondisiKamar,
          catatanKerusakan,
          ctx.user.name
        ]
      }
    ];

    if (noBooking) {
      // Jalur utama: trigger trg_booking_checkout_upd yang mengurus
      // occupancy_history + active_tenant.
      stmts.push({
        sql: `UPDATE booking SET status_booking = 'Check-out' WHERE no_booking = ?`,
        args: [noBooking]
      });
      // Trigger mengisi tanggal_selesasi dari tgl_keluar_est (estimasi kontrak).
      // Timpa dengan tanggal checkout SEBENARNYA.
      stmts.push({
        sql: `UPDATE occupancy_history SET tanggal_selesasi = ? WHERE id_penghuni = ?`,
        args: [tanggalCheckout, idPenghuni]
      });
    } else {
      // Fallback penghuni tanpa booking — meniru isi trigger.
      stmts.push({
        sql: `UPDATE occupancy_history SET status = 'Check-out', tanggal_selesasi = ?
              WHERE id_penghuni = ?`,
        args: [tanggalCheckout, idPenghuni]
      });
      stmts.push({
        sql: `DELETE FROM active_tenant WHERE COALESCE(id_penghuni, kamar_id) = ?`,
        args: [idPenghuni]
      });
    }

    await db.batch(stmts, 'write');
    await updateRoomStatus(kamar, 'Kosong');
    await invalidateTenantsCache();

    // Kalau checkout ini menuntaskan pengajuan dari Teman Rara (panel Acc
    // Checkout mengarahkan ke modul ini), tandai pengajuannya 'Selesai'.
    // Best-effort: checkout sudah tercatat, gagal menandai cukup diabaikan.
    await db
      .execute({
        sql: `UPDATE tr_checkout_request SET status = 'Selesai', processed_by = ?, processed_at = CURRENT_TIMESTAMP
              WHERE id_penghuni = ? AND status = 'Disetujui'`,
        args: [ctx.user.username, idPenghuni]
      })
      .catch(() => undefined);

    // Lampiran checkout = foto kondisi kamar. Tidak punya nomor sendiri, jadi ID
    // Docs-nya memakai id_dokumen bentukan saveLampiran.
    const lampiranWarning = await saveLampiran(values, ctx, `Checkout — ${penghuni} (${tanggalCheckout})`, 'Admin', {
      penamaan: { jenis: 'Kondisi Kamar', idPenghuni }
    });
    const tunggakanWarning =
      adaTunggakan === 'Ya' ? `Penghuni masih punya tunggakan Rp${nominalTunggakan.toLocaleString('id-ID')}.` : undefined;

    return {
      target: 'Turso → checkout_log',
      data: { tanggalCheckout, penghuni, kamar, tglMasuk, adaTunggakan, nominalTunggakan, pengembalianDeposit, kondisiKamar },
      warning: [tunggakanWarning, lampiranWarning].filter(Boolean).join(' ') || undefined
    };
  });
};
