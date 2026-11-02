import type { Client } from '@libsql/client';
import { turso } from '@/lib/core/turso';
import { kondisiTanggal } from '../tanggal';
import type { DailyTaskRow, Periode, StatusTugas } from '../types';
import { petaStatus } from '../tugas';

export type DivisiPekerjaan = 'Admin' | 'Keuangan' | 'Marketing' | 'Sales';

export interface DataPekerjaan {
  divisi: DivisiPekerjaan;
  periode: Periode;
  dibuat: Date;
  rows: { tanggal: string; pekerjaan: string; pic: string; deadline: string | null; status: StatusTugas }[];
}

const DIVISI_DB: Record<DivisiPekerjaan, string> = {
  Admin: 'Admin',
  Keuangan: 'Finance',
  Marketing: 'Marketing',
  Sales: 'Sales',
};

export function susunPekerjaan(
  divisi: DivisiPekerjaan,
  periode: Periode,
  dibuat: Date,
  rowsDb: DailyTaskRow[],
): DataPekerjaan {
  return {
    divisi,
    periode,
    dibuat,
    rows: rowsDb.map(r => ({
      tanggal: r.tanggal,
      pekerjaan: r.task,
      pic: r.pic || '-',
      deadline: r.deadline,
      status: petaStatus(r.status),
    })),
  };
}

export async function ambilPekerjaan(divisi: DivisiPekerjaan, periode: Periode, db: Client = turso()): Promise<DailyTaskRow[]> {
  const res = await db.execute({
    sql: `SELECT id, tanggal, task, pic, divisi, deadline, status FROM daily_tasks WHERE divisi = ? AND ${kondisiTanggal('tanggal')} ORDER BY tanggal, id`,
    args: [DIVISI_DB[divisi], periode.dari, periode.sampai],
  });
  return res.rows.map(r => ({
    id: Number(r.id),
    tanggal: String(r.tanggal),
    task: String(r.task),
    pic: r.pic == null ? null : String(r.pic),
    divisi: String(r.divisi),
    deadline: r.deadline == null ? null : String(r.deadline),
    status: String(r.status) as DailyTaskRow['status'],
  }));
}
