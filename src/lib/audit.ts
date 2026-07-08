import { appendRow } from './sheets';
import { SHEETS } from '@/config/spreadsheets';
import type { SessionUser } from './auth';

export interface AuditEntry {
  requestId: string;
  user: SessionUser;
  moduleId: string;
  action: 'CREATE' | 'UPDATE';
  target: string; // "namaFile → sheet"
  row?: number;
  oldData?: unknown;
  newData?: unknown;
  durationSec?: number;
  status: 'sukses' | 'gagal';
  error?: string;
}

/**
 * Tulis 1 baris audit (append-only) ke spreadsheet "Audit Log Mini App".
 * Kegagalan audit tidak boleh menggagalkan transaksi utama — hanya di-log ke console.
 */
export async function writeAudit(e: AuditEntry): Promise<void> {
  if (!SHEETS.AUDIT_LOG) {
    console.warn('[audit] SHEET_ID_AUDIT_LOG belum di-set; audit dilewati.');
    return;
  }
  try {
    await appendRow(SHEETS.AUDIT_LOG, "'Log'!A:M", [
      new Date().toISOString(),
      e.requestId,
      e.user.username,
      e.user.role,
      e.moduleId,
      e.action,
      e.target,
      e.row ?? '',
      e.oldData ? JSON.stringify(e.oldData) : '',
      e.newData ? JSON.stringify(e.newData) : '',
      e.durationSec ?? '',
      e.status,
      e.error ?? ''
    ]);
  } catch (err) {
    console.error('[audit] gagal menulis audit log:', err);
  }
}
