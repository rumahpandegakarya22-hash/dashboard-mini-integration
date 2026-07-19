/* =========================================================================
   Kost Tiga Dara — RLS per role untuk data Dashboard

   PORT VERBATIM dari `filterSheetsForRole` / `filterTablesForRole` di
   `server/server.js` repo Dashboard lama (Fase 2 migrasi).

   Ini permukaan paling sensitif di seluruh migrasi (risiko R2): salah port =
   kebocoran PII penghuni antar-role. Logika, urutan pengujian, dan perilaku
   tepi (mis. `rows.length` yang membuat tab kosong lolos tanpa redaksi)
   dipertahankan apa adanya — TERMASUK yang terlihat janggal.
   ========================================================================= */

import { SHEET_ACCESS, PII_COLS } from '@/config/dashboard-access';
import { SHEET_MAP } from './sheet-map';
import type { DbTables } from './compute';
import type { SheetsOut } from './source';

/* ---- Filter tab spreadsheet per role (untuk /api/dashboard/sheets).
   Owner = semua. ---- */
export function filterSheetsForRole(sheets: SheetsOut, role: string): SheetsOut {
  if (role === 'owner') return sheets;
  const allow = SHEET_ACCESS[role] || [];
  const out: SheetsOut = {};
  for (const [title, rows] of Object.entries(sheets)) {
    if (!allow.some((re) => re.test(title))) continue; // tab tidak diizinkan untuk role ini
    if (/penghuni/i.test(title) && role !== 'admin' && Array.isArray(rows) && rows.length) {
      const header = (rows[0] || []).map((h) => String(h));
      const drop = header.map((h, i) => (PII_COLS.test(h) ? i : -1)).filter((i) => i >= 0);
      out[title] = drop.length ? rows.map((r) => r.filter((_, i) => !drop.includes(i))) : rows;
    } else {
      out[title] = rows;
    }
  }
  return out;
}

/* ---- Filter tabel Turso per role (untuk /api/dashboard/db), reuse aturan
   SHEET_ACCESS dengan menguji NAMA TAB dari SHEET_MAP. Owner = semua. ---- */
export function filterTablesForRole(tables: DbTables, role: string): DbTables {
  if (role === 'owner') return tables;
  const allow = SHEET_ACCESS[role] || [];
  const out: DbTables = {};
  for (const [table, rows] of Object.entries(tables)) {
    const title = (SHEET_MAP[table] && SHEET_MAP[table].title) || table;
    if (!allow.some((re) => re.test(title))) continue; // tabel tidak diizinkan untuk role ini
    // Redaksi kolom PII identik dengan filterSheetsForRole: tab penghuni, non-admin.
    // Baris /api/db berupa objek (kolom→nilai), jadi hapus key yang cocok PII_COLS.
    if (/penghuni/i.test(title) && role !== 'admin' && Array.isArray(rows) && rows.length) {
      out[table] = rows.map((r) => {
        if (!r || typeof r !== 'object') return r;
        const o: Record<string, any> = {};
        for (const k of Object.keys(r)) if (!PII_COLS.test(k)) o[k] = r[k];
        return o;
      });
    } else {
      out[table] = rows;
    }
  }
  return out;
}
