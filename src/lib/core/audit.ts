import { turso } from './turso';
import type { SessionUser } from './auth';

export interface AuditEntry {
  requestId: string;
  user: SessionUser;
  moduleId: string;
  action: 'CREATE' | 'UPDATE';
  target: string; // "namaFile → sheet" (era Sheets) / "Turso → tabel"
  row?: number;
  oldData?: unknown;
  newData?: unknown;
  durationSec?: number;
  status: 'sukses' | 'gagal';
  error?: string;
}

/**
 * Tulis 1 baris audit (append-only) ke tabel Turso `audit_log`.
 *
 * Wave 3 migrasi Sheets → Turso: dulu append ke spreadsheet AUDIT_LOG tab
 * 'Log'!A:M. Urutan & makna kolom dipertahankan 1:1 (lihat DDL di
 * db/schema/001_ops_sheets_to_turso.sql), hanya `ts` yang kini kolom TEXT
 * ber-default CURRENT_TIMESTAMP alih-alih string ISO yang dikirim aplikasi —
 * tetap diisi eksplisit di sini supaya jam-nya jam kejadian, bukan jam commit.
 *
 * Kegagalan audit TIDAK boleh menggagalkan transaksi utama — hanya di-log ke
 * console (perilaku ini sengaja dipertahankan dari versi Sheets).
 *
 * Tidak ada lagi guard "SHEET_ID_AUDIT_LOG belum di-set": tabelnya selalu ada
 * selama Turso terkonfigurasi, jadi audit tidak lagi diam-diam dilewati.
 */
export async function writeAudit(e: AuditEntry): Promise<void> {
  try {
    await turso().execute({
      sql: `INSERT INTO audit_log
              (ts, request_id, username, role, module_id, action, target,
               row_ref, old_data, new_data, duration_sec, status, error)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        new Date().toISOString(),
        e.requestId,
        e.user.username,
        e.user.role,
        e.moduleId,
        e.action,
        e.target,
        e.row ?? null,
        e.oldData ? JSON.stringify(e.oldData) : null,
        e.newData ? JSON.stringify(e.newData) : null,
        e.durationSec ?? null,
        e.status,
        e.error ?? null
      ]
    });
  } catch (err) {
    console.error('[audit] gagal menulis audit log:', err);
  }
}
