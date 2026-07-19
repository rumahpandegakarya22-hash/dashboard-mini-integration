// Joblist work order (Mini App Improvement §2 & §4): WO dari divisi lain yang
// harus dikerjakan divisi user, tampil di home + kolom ubah status.
//
// Alur status (fitur List Job): WO lahir Pending → staf divisi tujuan set
// "In Progress" (PIC otomatis = staf tsb) → baris pindah ke tabel List Job →
// set "Complete" → hilang dari kedua tabel staf. Owner/pengawas hanya melihat
// (logbook, semua status) — ubah status khusus staf divisi tujuan.

import { turso, TASK_STATUS } from './turso';
import { ROLE_DIVISI, type Role } from './roles';

export interface WorkOrderRow {
  id: number;
  tanggalInput: string;
  petugas: string;
  divisiAsal: string;
  lokasiItem: string;
  kategori: string;
  deskripsi: string;
  prioritas: string;
  tujuanDivisi: string;
  targetDeadline: string | null;
  catatan: string | null;
  buktiFotoUrl: string | null;
  pic: string | null; // staf yang mengambil pekerjaan (diisi otomatis saat status → In Progress)
  completedBy: string | null; // staf yang menyelesaikan (diisi saat → Complete, kosong lagi kalau dibuka ulang)
  status: string;
  nominal: number | null; // biaya maintenance (WO tujuan Admin) — dikonversi Admin jadi pengeluaran
  refTiket: string | null; // id_tiket maintenance asal (audit trail)
}

/** Divisi joblist utk role ini; null = lihat semua (owner/pengawas). */
export function joblistDivisi(role: Role): string | null {
  if (role === 'owner' || role === 'pengawas') return null;
  return ROLE_DIVISI[role] ?? null;
}

export async function getJoblist(divisi: string | null): Promise<WorkOrderRow[]> {
  const base = `SELECT id, tanggal_input, petugas, divisi_asal, lokasi_item, kategori, deskripsi,
                       prioritas, tujuan_divisi, target_deadline, catatan, bukti_foto_url, pic, completed_by, status,
                       nominal, ref_tiket
                FROM work_orders`;
  const order = `ORDER BY CASE status WHEN 'Pending' THEN 0 WHEN 'In Progress' THEN 1 ELSE 2 END,
                          CASE prioritas WHEN 'Darurat' THEN 0 WHEN 'Tinggi' THEN 1 WHEN 'Sedang' THEN 2 ELSE 3 END,
                          COALESCE(target_deadline, '9999') ASC, id DESC`;
  // Staf: hanya pekerjaan aktif divisinya (Complete disembunyikan — "hilang" dari tabel).
  // Owner/pengawas (divisi null): semua baris semua status = logbook.
  const res = divisi
    ? await turso().execute({ sql: `${base} WHERE tujuan_divisi = ? AND status != 'Complete' ${order}`, args: [divisi] })
    : await turso().execute(`${base} ${order}`);
  return res.rows.map((r) => ({
    id: Number(r.id),
    tanggalInput: String(r.tanggal_input ?? ''),
    petugas: String(r.petugas ?? ''),
    divisiAsal: String(r.divisi_asal ?? ''),
    lokasiItem: String(r.lokasi_item ?? ''),
    kategori: String(r.kategori ?? ''),
    deskripsi: String(r.deskripsi ?? ''),
    prioritas: String(r.prioritas ?? ''),
    tujuanDivisi: String(r.tujuan_divisi ?? ''),
    targetDeadline: r.target_deadline == null ? null : String(r.target_deadline),
    catatan: r.catatan == null ? null : String(r.catatan),
    buktiFotoUrl: r.bukti_foto_url == null ? null : String(r.bukti_foto_url),
    pic: r.pic == null ? null : String(r.pic),
    completedBy: r.completed_by == null ? null : String(r.completed_by),
    status: String(r.status ?? ''),
    nominal: r.nominal == null ? null : Number(r.nominal),
    refTiket: r.ref_tiket == null ? null : String(r.ref_tiket)
  }));
}

/**
 * Ubah status WO — HANYA staf divisi tujuan WO tsb. Owner/pengawas read-only
 * (mereka melihat via logbook). Saat status → In Progress, PIC otomatis diisi
 * nama staf yang mengambil; saat → Complete, completed_by diisi (dan dikosongkan
 * lagi kalau pekerjaan dibuka ulang). Return false kalau WO tidak ditemukan /
 * bukan wewenang divisi ini.
 */
export async function updateWoStatus(id: number, status: string, role: Role, userName: string): Promise<boolean> {
  if (!(TASK_STATUS as readonly string[]).includes(status)) throw new Error(`Status tidak valid: "${status}".`);
  const divisi = joblistDivisi(role);
  if (!divisi) throw new Error('Owner/Pengawas hanya melihat logbook — ubah status dilakukan staf divisi tujuan.');
  const res = await turso().execute({
    sql: `UPDATE work_orders
          SET status = ?,
              pic = CASE WHEN ? = 'In Progress' THEN ? ELSE pic END,
              completed_by = CASE WHEN ? = 'Complete' THEN ? ELSE NULL END,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND tujuan_divisi = ?`,
    args: [status, status, userName, status, userName, id, divisi]
  });
  return res.rowsAffected > 0;
}
