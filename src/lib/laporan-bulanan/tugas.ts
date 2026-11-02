import type { StatusTugas } from './types';

export type { StatusTugas };

export function petaStatus(s: 'Pending' | 'In Progress' | 'Complete'): StatusTugas {
  if (s === 'Complete') return 'Selesai';
  if (s === 'In Progress') return 'Proses';
  return 'Tertunda';
}

export function ringkasTugas(rows: { status: StatusTugas }[]) {
  const total = rows.length;
  const hitung = (s: StatusTugas) => rows.filter(r => r.status === s).length;
  const selesai = hitung('Selesai');
  return {
    total,
    selesai,
    proses: hitung('Proses'),
    tertunda: hitung('Tertunda'),
    persen: total === 0 ? 0 : Math.round((selesai / total) * 100),
  };
}

export function lewatDeadline(t: { status: string; deadline: string | null }, dibuatIso: string): boolean {
  if (!t.deadline || t.status === 'Selesai' || t.status === 'Complete') return false;
  return t.deadline.slice(0, 10) < dibuatIso.slice(0, 10);
}
