import { unstable_cache } from 'next/cache';

/* =========================================================================
   Cache berjenjang (persisten via Next Data Cache — bertahan lintas request &
   lintas instance serverless, beda dari cache in-memory yang mati saat cold
   start). TTL dipilih per VOLATILITAS data: makin sering berubah → makin pendek.

   Pemakaian: bungkus HANYA loader data murni (query DB). JANGAN memanggil
   auth()/cookies()/headers() di dalam fungsi yang di-cache — itu dinamis
   per-user dan akan bocor/nge-error.
   ========================================================================= */

/** TTL dalam detik. */
export const TTL = {
  /** Referensi jarang berubah: daftar kamar, fasilitas, COA. */
  referensi: 600,   // 10 menit
  /** Data penghuni (profil, kontak). */
  penghuni: 600,    // 10 menit
  /** Operasional non-keuangan: daily task, work order, feedback, vendor, konten. */
  operasional: 60,  // 1 menit
  /** Snapshot dashboard (campuran operasional + ringkasan transaksi). */
  dashboard: 10,    // 10 detik
  /** Transaksi keuangan: pembayaran, jurnal, booking, deposit — harus segar. */
  transaksi: 5,     // 5 detik
} as const;

/**
 * Bungkus loader data dengan cache persisten berjenjang.
 * @param fn         loader data murni (tanpa auth/cookies)
 * @param keyParts   bagian key unik (mis. ['dashboard','all-tables'])
 * @param revalidate TTL detik — pakai konstanta TTL di atas
 * @param tags       tag untuk invalidasi manual via revalidateTag()
 */
export function cached<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
  keyParts: string[],
  revalidate: number,
  tags?: string[],
): (...args: A) => Promise<R> {
  return unstable_cache(fn, keyParts, { revalidate, tags });
}
