import { randomUUID } from 'node:crypto';
import type { Transaction } from '@libsql/client';
import { turso } from './core/turso';

/* =========================================================================
   Void dan koreksi — pengganti edit-di-tempat untuk jurnal dan pembayaran.

   Aturan:
   - Void TIDAK menghapus. Tiap baris jurnal asli dibalik dengan baris pembalik
     (debit/kredit ditukar, nominal sama, tanggal SAMA dengan aslinya supaya
     laporan periode itu langsung kembali seimbang). Baris asli dan pembaliknya
     saling menunjuk (dibalik_oleh / void_dari) dan tetap terlihat.
   - Koreksi = void + transaksi baru, dalam SATU transaksi database.
   - Baris pembalik tidak boleh di-void lagi; baris yang sudah dibalik tidak
     boleh dibalik dua kali.
   ========================================================================= */

export const grupBaru = (prefix: string): string => `${prefix}-${randomUUID().slice(0, 8)}`;

/** Nomor invoice koreksi: nomor asal + "-K" + urutan koreksi (INV/.../2026 → INV/.../2026-K1). */
export function nomorKoreksi(noInv: string, sudahAda: number): string {
  return `${noInv.replace(/-K\d+$/, '')}-K${sudahAda + 1}`;
}

export function cekAlasan(alasan: unknown): string {
  const a = String(alasan ?? '').trim();
  if (a.length < 5) throw new Error('Alasan void/koreksi wajib diisi (minimal 5 karakter).');
  return a.slice(0, 300);
}

/** Baris jurnal yang masih aktif (belum dibalik, bukan pembalik) milik satu grup transaksi. */
export async function idJurnalGrup(grupId: string): Promise<number[]> {
  const rs = await turso().execute({
    sql: `SELECT id FROM jurnal_transaksi WHERE grup_id = ? AND void_dari IS NULL AND dibalik_oleh IS NULL ORDER BY id`,
    args: [grupId]
  });
  return rs.rows.map((r) => Number(r.id));
}

/**
 * Balik baris jurnal `ids` di dalam transaksi `tx`. Mengembalikan jumlah baris yang dibalik.
 * Melempar error bila ada baris yang tidak ditemukan, sudah dibalik, atau berupa baris pembalik.
 */
export async function balikBarisJurnal(tx: Transaction, ids: number[], alasan: string): Promise<number> {
  if (ids.length === 0) throw new Error('Tidak ada baris jurnal yang bisa dibalik (mungkin sudah di-void).');
  for (const id of ids) {
    const rs = await tx.execute({
      sql: `SELECT id, tanggal, akun_debit_kode, akun_kredit_kode, nominal, keterangan, kategori, grup_id, void_dari, dibalik_oleh
            FROM jurnal_transaksi WHERE id = ?`,
      args: [id]
    });
    const r = rs.rows[0];
    if (!r) throw new Error(`Baris jurnal #${id} tidak ditemukan.`);
    if (r.void_dari != null) throw new Error(`Baris jurnal #${id} adalah baris pembalik dan tidak bisa di-void.`);
    if (r.dibalik_oleh != null) throw new Error(`Baris jurnal #${id} sudah di-void.`);

    const ins = await tx.execute({
      sql: `INSERT INTO jurnal_transaksi (tanggal, akun_debit_kode, akun_kredit_kode, nominal, keterangan, kategori, grup_id, void_dari)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        r.tanggal as string,
        Number(r.akun_kredit_kode),
        Number(r.akun_debit_kode),
        Number(r.nominal),
        `VOID (${alasan}): ${String(r.keterangan ?? '')}`.slice(0, 500),
        (r.kategori as string | null) ?? null,
        (r.grup_id as string | null) ?? null,
        id
      ]
    });
    await tx.execute({
      sql: 'UPDATE jurnal_transaksi SET dibalik_oleh = ? WHERE id = ?',
      args: [Number(ins.lastInsertRowid), id]
    });
  }
  return ids.length;
}

/** Jalankan `fn` dalam satu transaksi tulis; commit bila sukses, rollback bila gagal. */
export async function dalamTransaksi<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
  const tx = await turso().transaction('write');
  try {
    const hasil = await fn(tx);
    await tx.commit();
    return hasil;
  } catch (e) {
    await tx.rollback().catch(() => {});
    throw e;
  } finally {
    tx.close();
  }
}
