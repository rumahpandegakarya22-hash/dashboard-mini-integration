// Jembatan ke data aplikasi penghuni "Teman Rara".
//
// Kedua aplikasi berbagi SATU database Turso, jadi tidak ada panggilan API
// antar-app: Ops query langsung ke tabel tr_* dan tenant_complain. File ini
// menampung yang perlu dipakai lebih dari satu panel supaya tidak tersebar.

import { turso } from './core/turso';

/**
 * Ubah referensi lampiran Teman Rara jadi URL yang bisa dibuka dari Ops.
 *
 * Teman Rara menyimpan lampiran sebagai `/api/berkas/<fileId>` — path relatif
 * yang di domain Ops akan menunjuk ke halaman yang tidak ada. Yang portabel
 * hanya fileId Drive-nya, jadi itu yang diambil lalu dipasang ke route penyaji
 * milik Ops.
 *
 * Nilai selain pola itu (mis. webViewLink Drive dari upload sisi Ops)
 * dikembalikan apa adanya.
 */
export function urlBerkas(fileUrl: string | null | undefined): string | null {
  const v = String(fileUrl ?? '').trim();
  if (!v) return null;
  const m = v.match(/^\/api\/berkas\/([A-Za-z0-9_-]{10,120})$/);
  return m ? `/api/ops/berkas/${m[1]}` : v;
}

export interface PenghuniRingkas {
  id_penghuni: string;
  nama: string;
  no_kamar: string;
}

/**
 * Nama & kamar untuk sekumpulan id_penghuni sekaligus.
 *
 * Sumbernya `occupancy_history`, BUKAN `active_tenant`: trigger check-out
 * menghapus baris active_tenant, sehingga pengaduan atau bukti bayar milik
 * penghuni yang sudah pindah akan kehilangan nama kalau dijoin ke sana.
 * occupancy_history tidak pernah dihapus, jadi riwayat tetap terbaca.
 */
export async function getPenghuniByIds(ids: string[]): Promise<Map<string, PenghuniRingkas>> {
  const unik = [...new Set(ids.filter(Boolean))];
  const peta = new Map<string, PenghuniRingkas>();
  if (unik.length === 0) return peta;

  const res = await turso().execute({
    sql: `SELECT id_penghuni, nama, no_kamar FROM occupancy_history
          WHERE id_penghuni IN (${unik.map(() => '?').join(', ')})`,
    args: unik
  });
  for (const r of res.rows) {
    const id = String(r.id_penghuni);
    peta.set(id, { id_penghuni: id, nama: String(r.nama ?? ''), no_kamar: String(r.no_kamar ?? '') });
  }
  return peta;
}

/** Label baku "Nama (K-12)" — dipakai seragam di semua panel Teman Rara. */
export function labelPenghuni(p: PenghuniRingkas | undefined, fallbackId: string): string {
  if (!p) return fallbackId;
  return p.no_kamar ? `${p.nama} (K-${p.no_kamar})` : p.nama;
}
