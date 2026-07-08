import { appendRow, assertHeaders } from '../../sheets';
import type { SubmitHandler } from '../types';

export interface AppendConfig {
  spreadsheetId: string;
  range: string; // mis. "'Log Survey'!A:M"
  headerRange: string; // mis. "'Log Survey'!A1:M1"
  expectedHeaders: string[]; // TEBAKAN dari PRD kecuali dicatat lain — assertHeaders menolak submit jika beda (bukan silent-wrong-column)
  target: string; // label audit, mis. "Log Sales → Log Survey"
  buildRow: (values: Record<string, unknown>) => (string | number | null)[];
}

/** Factory handler untuk modul append-only sederhana (tanpa lock resource / cross-check khusus). */
export function createAppendHandler(cfg: AppendConfig): SubmitHandler {
  return async (values) => {
    const row = cfg.buildRow(values);
    await assertHeaders(cfg.spreadsheetId, cfg.headerRange, cfg.expectedHeaders);
    const rowNum = await appendRow(cfg.spreadsheetId, cfg.range, row);
    return { target: cfg.target, row: rowNum, data: values };
  };
}
