// Joblist work order (Mini App Improvement §2 & §4): WO dari divisi lain yang
// harus dikerjakan divisi user, tampil di home + kolom ubah status.

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
  status: string;
}

/** Divisi joblist utk role ini; null = lihat semua (owner/pengawas). */
export function joblistDivisi(role: Role): string | null {
  if (role === 'owner' || role === 'pengawas') return null;
  return ROLE_DIVISI[role] ?? null;
}

export async function getJoblist(divisi: string | null): Promise<WorkOrderRow[]> {
  const base = `SELECT id, tanggal_input, petugas, divisi_asal, lokasi_item, kategori, deskripsi,
                       prioritas, tujuan_divisi, target_deadline, catatan, bukti_foto_url, status
                FROM work_orders`;
  const order = `ORDER BY CASE status WHEN 'Pending' THEN 0 WHEN 'In Progress' THEN 1 ELSE 2 END,
                          CASE prioritas WHEN 'Darurat' THEN 0 WHEN 'Tinggi' THEN 1 WHEN 'Sedang' THEN 2 ELSE 3 END,
                          COALESCE(target_deadline, '9999') ASC, id DESC`;
  const res = divisi
    ? await turso().execute({ sql: `${base} WHERE tujuan_divisi = ? ${order}`, args: [divisi] })
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
    status: String(r.status ?? '')
  }));
}

/**
 * Ubah status WO — hanya divisi tujuan WO tsb (atau owner/pengawas).
 * Return false kalau WO tidak ditemukan / bukan wewenang divisi ini.
 */
export async function updateWoStatus(id: number, status: string, role: Role): Promise<boolean> {
  if (!(TASK_STATUS as readonly string[]).includes(status)) throw new Error(`Status tidak valid: "${status}".`);
  const divisi = joblistDivisi(role);
  const res = divisi
    ? await turso().execute({
        sql: `UPDATE work_orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tujuan_divisi = ?`,
        args: [status, id, divisi]
      })
    : await turso().execute({
        sql: `UPDATE work_orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        args: [status, id]
      });
  return res.rowsAffected > 0;
}
