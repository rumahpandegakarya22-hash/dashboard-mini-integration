import { turso } from '../core/turso';

export type InvoiceSewa = {
  no_inv: string;
  nama: string;
  email: string | null;
  tanggal_pembayaran: string | null;
  periode_awal: string | null;
  periode_akhir: string | null;
  no_kamar: string;
  tipe_kamar: string | null;
  jumlah_bulan: number | null;
  jumlah_denda: number | null;
  harga_sewa: number | null;
  tambahan_listrik: number | null;
  denda: number | null;
  total_sewa: number | null;
  total_listrik: number | null;
  total_denda: number | null;
  diskon: number | null;
  pajak: number | null;
  subtotal: number | null;
  grand_total: number | null;
};

export type InvoiceDp = {
  no_inv: string;
  nama: string;
  email: string | null;
  tanggal_pembayaran: string | null;
  no_kamar: string;
  tipe_kamar: string | null;
  jumlah: number | null;
  harga_kamar: number | null;
  subtotal: number | null;
  pajak: number | null;
  diskon: number | null;
  grand_total: number | null;
};

/**
 * Ambil invoice dari Turso berdasarkan nomor invoice. Menggantikan pembacaan
 * yang dulu dilakukan Apps Script lewat HTTP API Turso.
 *
 * invoice_sewa.no_inv TIDAK unik di schema (beda dengan invoice_dp), jadi
 * sengaja ambil baris terbaru — id terbesar — bukan LIMIT 1 tanpa urutan.
 */
export async function getInvoiceSewa(noInv: string): Promise<InvoiceSewa | null> {
  const res = await turso().execute({
    sql: `SELECT no_inv, nama, email, tanggal_pembayaran, periode_awal, periode_akhir, no_kamar, tipe_kamar,
                 jumlah_bulan, jumlah_denda, harga_sewa, tambahan_listrik, denda, total_sewa, total_listrik,
                 total_denda, diskon, pajak, subtotal, grand_total
          FROM invoice_sewa WHERE no_inv = ? ORDER BY id DESC LIMIT 1`,
    args: [noInv]
  });
  return (res.rows[0] as unknown as InvoiceSewa) ?? null;
}

export async function getInvoiceDp(noInv: string): Promise<InvoiceDp | null> {
  const res = await turso().execute({
    sql: `SELECT no_inv, nama, email, tanggal_pembayaran, no_kamar, tipe_kamar, jumlah,
                 harga_kamar, subtotal, pajak, diskon, grand_total
          FROM invoice_dp WHERE no_inv = ? ORDER BY id DESC LIMIT 1`,
    args: [noInv]
  });
  return (res.rows[0] as unknown as InvoiceDp) ?? null;
}
