import { parseDateISO, parseRupiah, required } from '../../validate';
import { turso } from '../../turso';
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

  const lampiranWarning = await saveLampiran(values, ctx, `Nota Pengeluaran — ${keterangan} (${tanggal})`, 'Admin');

  return {
    target: 'Turso → jurnal_transaksi',
    row: Number(res.lastInsertRowid ?? -1),
    data: { tanggal, akunDebit, akunKredit, nominal, keterangan, kategori },
    warning: [woWarning, lampiranWarning].filter(Boolean).join(' ') || undefined
  };
};
