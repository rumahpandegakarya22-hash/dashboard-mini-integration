// Turso (libSQL) — database bersama dgn Dashboard Figma. Dipakai modul yang
// per file "Mini App Improvement" pindah dari Google Sheets ke database:
// daily task, work order/joblist, pindah kamar (rooms_transfer + occupancy_history),
// dan URL dokumen upload.

import { createClient, type Client } from '@libsql/client';

let _db: Client | null = null;

export function turso(): Client {
  if (_db) return _db;
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url) throw new Error('TURSO_DATABASE_URL belum di-set di environment.');
  _db = createClient({ url, authToken });
  return _db;
}

/** Divisi valid di tabel daily_tasks & work order (CHECK constraint di DB). */
export const DIVISI_DB = ['Admin', 'Cleaning', 'Finance', 'Inspeksi', 'Maintenance', 'Marketing', 'Sales'] as const;
export type DivisiDb = (typeof DIVISI_DB)[number];

/** Status task/work order (CHECK constraint daily_tasks di DB). */
export const TASK_STATUS = ['Pending', 'In Progress', 'Complete'] as const;
