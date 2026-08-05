import { parseDateISO, parseRupiah, required } from '../../core/validate';
import { turso } from '../../core/turso';
import { saveLampiran } from './helpers';
import type { SubmitHandler } from '../types';

/**
 * Pengeluaran — Turso-only (arahan 2026-07-19): jurnal_transaksi adalah pencatatan PRIMER
 * (gagal tulis = submit gagal, bukan warning). Sheet Log Input Transaksi tidak ditulis lagi.
 * Kode akun dicari di `coa` by nama (dropdown akunDebit/dibayarDari memang berisi nama akun).
 *
 * Konversi joblist Admin (biaya maintenance): kalau form dibuka dari link "Catat Pengeluaran"
 * di joblist, values.woId terisi → setelah jurnal sukses, WO ditandai Complete (best-effort).
 */
export const submitPengeluaran: SubmitHandler = async (values, ctx) => {
  const tanggal = parseDateISO(String(values.tanggal ?? ''));
  const akunDebit = required(values.akunDebit, 'Kategori Pengeluaran');
  const akunKredit = required(values.dibayarDari, 'Dibayar Dari');
  const nominal = parseRupiah(values.nominal as string | number);
  const keterangan = required(values.keterangan, 'Keterangan');
  const kategori = required(values.kategori, 'Kategori');

  const db = turso();
  const kode = async (nama: string) => {
    const r = await db.execute({ sql: 'SELECT kode FROM coa WHERE nama_akun = ?', args: [nama] });
    return r.rows[0]?.kode ?? null;
  };
  const [kodeDebit, kodeKredit] = [await kode(akunDebit), await kode(akunKredit)];
  if (kodeDebit === null || kodeKredit === null) {
    const missing = [kodeDebit === null ? akunDebit : null, kodeKredit === null ? akunKredit : null].filter(Boolean);
    throw new Error(`Akun "${missing.join('", "')}" tidak ditemukan di COA — pengeluaran TIDAK dicatat.`);
  }
  const res = await db.execute({
    sql: 'INSERT INTO jurnal_transaksi (tanggal, akun_debit_kode, akun_kredit_kode, nominal, keterangan, kategori) VALUES (?, ?, ?, ?, ?, ?)',
    args: [tanggal, kodeDebit, kodeKredit, nominal, keterangan, kategori]
  });

  // Konversi dari joblist Admin: tandai WO selesai. Best-effort — jurnal sudah tercatat.
  let woWarning: string | undefined;
  const woId = Number(values.woId ?? 0);
  if (woId > 0) {
    try {
      const upd = await db.execute({
        sql: `UPDATE work_orders SET status = 'Complete', completed_by = ?, updated_at = CURRENT_TIMESTAMP
              WHERE id = ? AND tujuan_divisi = 'Admin' AND status != 'Complete'`,
        args: [ctx.user.username, woId]
      });
      if (upd.rowsAffected === 0) woWarning = `Pengeluaran tercatat, tapi joblist #${woId} tidak ditemukan / sudah Complete.`;
    } catch (e: unknown) {
      console.error('[pengeluaran] gagal update work_orders:', (e as Error)?.message);
      woWarning = `Pengeluaran tercatat, tapi status joblist #${woId} gagal diupdate — tandai manual.`;
    }
  }

  /* Nomor nota YYMM-Divisi-NNN. Urutan diambil dari id_dokumen terakhir dengan
     prefix yang sama, jadi penomorannya hidup di data — bukan cuma di nama berkas.
     Dua submit bersamaan pada divisi & bulan yang sama bisa menghasilkan nomor
     kembar; yang kalah gagal di PRIMARY KEY dan muncul sebagai warning, bukan
     diam-diam menimpa. */
  const divisi = required(values.divisi, 'Divisi Pengeluar Biaya');
  const prefixNota = `NOTA-${tanggal.slice(2, 4)}${tanggal.slice(5, 7)}-${divisi}`;
  const urut = await db.execute({
    sql: `SELECT id_dokumen FROM dokumen WHERE id_dokumen LIKE ? ORDER BY id_dokumen DESC LIMIT 1`,
    args: [`${prefixNota}-%`]
  });
  const terakhir = parseInt(String(urut.rows[0]?.id_dokumen ?? '').slice(-3), 10) || 0;
  const nomorNota = `${prefixNota}-${String(Math.min(terakhir + 1, 999)).padStart(3, '0')}`;

  const lampiranWarning = await saveLampiran(values, ctx, `Nota Pengeluaran — ${keterangan} (${tanggal})`, 'Admin', {
    idDokumen: nomorNota,
    // Prefix 'NOTA-' hanya penanda di database; nama berkasnya sudah diawali jenis.
    penamaan: { jenis: 'Nota', idDocs: nomorNota.replace(/^NOTA-/, '') }
  });

  return {
    target: 'Turso → jurnal_transaksi',
    row: Number(res.lastInsertRowid ?? -1),
    data: { tanggal, akunDebit, akunKredit, nominal, keterangan, kategori },
    warning: [woWarning, lampiranWarning].filter(Boolean).join(' ') || undefined
  };
};
