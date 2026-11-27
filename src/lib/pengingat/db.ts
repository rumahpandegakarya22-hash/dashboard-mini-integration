/* Pembacaan data pengingat. Client dioper sebagai argumen supaya bisa diuji dengan database lokal. */
import type { Client } from '@libsql/client';
import type { BarisTagihan } from './tagihan';
import { KUNCI_REKENING, bacaNilaiRekening, type Rekening } from './rekening';

/**
 * Jatuh tempo penghuni aktif = periode_akhir terakhir dari invoice yang sudah dibayar dan tidak void.
 * Invoice baru dibuat saat pembayaran dicatat, jadi "belum bayar" berarti periode terakhir sudah habis.
 */
export async function bacaTagihan(db: Client): Promise<BarisTagihan[]> {
  const rs = await db.execute(`
    SELECT a.id_penghuni, a.nama_lengkap, a.nama_panggilan, a.no_kamar, a.no_hp,
           COALESCE(NULLIF(k.tipe_kamar, ''), i.tipe_kamar) AS tipe,
           date(i.periode_akhir) AS jatuh_tempo, i.jumlah_bulan
    FROM active_tenant a
    JOIN invoice_sewa i ON i.id = (
      SELECT id FROM invoice_sewa
      WHERE id_penghuni = a.id_penghuni AND void_pada IS NULL
        AND COALESCE(tanggal_pembayaran, '') != '' AND date(periode_akhir) IS NOT NULL
      ORDER BY date(periode_akhir) DESC, id DESC LIMIT 1
    )
    LEFT JOIN kamar k ON k.id_kamar = a.kamar_id`);
  return rs.rows.map((r) => ({
    idPenghuni: String(r.id_penghuni),
    nama: String(r.nama_lengkap ?? ''),
    panggilan: String(r.nama_panggilan ?? '').trim(),
    noKamar: String(r.no_kamar ?? ''),
    tipe: String(r.tipe ?? ''),
    noHp: String(r.no_hp ?? ''),
    jatuhTempo: String(r.jatuh_tempo),
    bulan: Number(r.jumlah_bulan) > 0 ? Number(r.jumlah_bulan) : 1
  }));
}

/** Selalu baca dari DB: cache memori per instance serverless bisa menyajikan rekening lama. */
export async function bacaRekening(db: Client): Promise<{ rekening: Rekening | null; olehSiapa: string | null; kapan: string | null }> {
  const rs = await db.execute({ sql: 'SELECT value, updated_by, updated_at FROM app_config WHERE key = ?', args: [KUNCI_REKENING] });
  const r = rs.rows[0];
  return {
    rekening: bacaNilaiRekening(r ? String(r.value) : null),
    olehSiapa: r?.updated_by ? String(r.updated_by) : null,
    kapan: r?.updated_at ? String(r.updated_at) : null
  };
}
