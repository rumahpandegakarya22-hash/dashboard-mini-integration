import { sheetsClient, withRetry } from './google';
import { READ_ONLY_SHEETS } from '@/config/spreadsheets';

/** Baca range; hasil array of rows (string[][]). */
export async function readRange(spreadsheetId: string, range: string): Promise<string[][]> {
  const res = await withRetry(() =>
    sheetsClient().spreadsheets.values.get({ spreadsheetId, range, valueRenderOption: 'UNFORMATTED_VALUE', dateTimeRenderOption: 'FORMATTED_STRING' })
  );
  return (res.data.values as string[][]) || [];
}

/**
 * Append 1 baris ke sheet. `range` menunjuk area tabel (mis. "'Log Booking'!B:N")
 * agar kolom formula di luar range tidak tersentuh.
 * Nilai string yang diawali '=' ditolak (anti formula injection).
 */
export async function appendRow(spreadsheetId: string, range: string, values: (string | number | null)[]): Promise<number> {
  if (READ_ONLY_SHEETS.includes(spreadsheetId)) {
    throw new Error('Spreadsheet ini read-only untuk app (berformula/IMPORTRANGE).');
  }
  for (const v of values) {
    if (typeof v === 'string' && v.trim().startsWith('=')) throw new Error('Input tidak boleh diawali "=".');
  }
  const res = await withRetry(() =>
    sheetsClient().spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [values] }
    })
  );
  // Ambil nomor baris dari updatedRange, mis. "'Log Booking'!B37:N37"
  const updated = res.data.updates?.updatedRange || '';
  const m = updated.match(/(\d+):?[A-Z]*\d*$/);
  return m ? parseInt(m[1], 10) : -1;
}

/** Update sel/range spesifik (dipakai mis. update status kamar, Generator Tagihan). */
export async function updateRange(spreadsheetId: string, range: string, values: (string | number | null)[][]): Promise<void> {
  if (READ_ONLY_SHEETS.includes(spreadsheetId)) {
    throw new Error('Spreadsheet ini read-only untuk app.');
  }
  await withRetry(() =>
    sheetsClient().spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values }
    })
  );
}

/**
 * Baca tabel dengan header di baris pertama (mis. sheet master/SETTING).
 * Baris kosong dilewati. Hasil: array objek {headerText: value}.
 */
export async function readTable(spreadsheetId: string, range: string): Promise<Record<string, string>[]> {
  const rows = await readRange(spreadsheetId, range);
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => String(h ?? '').trim());
  return rows
    .slice(1)
    .filter((r) => r.some((c) => String(c ?? '').trim() !== ''))
    .map((r) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => {
        if (h) obj[h] = String(r[i] ?? '');
      });
      return obj;
    });
}

/**
 * Sama seperti readTable, tapi menyertakan nomor baris asli di sheet (1-based, header=baris 1).
 * Dipakai saat perlu update sel spesifik pada baris yang ditemukan (mis. status kamar).
 */
export async function readTableWithRowNum(
  spreadsheetId: string,
  range: string
): Promise<{ row: number; data: Record<string, string> }[]> {
  const rows = await readRange(spreadsheetId, range);
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => String(h ?? '').trim());
  const out: { row: number; data: Record<string, string> }[] = [];
  rows.slice(1).forEach((r, i) => {
    if (!r.some((c) => String(c ?? '').trim() !== '')) return;
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      if (h) obj[h] = String(r[idx] ?? '');
    });
    out.push({ row: i + 2, data: obj }); // +2: lewati baris header (1) + index 0-based
  });
  return out;
}

/**
 * Kontrak kolom: verifikasi header sheet masih sesuai harapan.
 * Dipanggil sebelum tulis; mismatch → tolak agar data tidak masuk kolom salah.
 */
export async function assertHeaders(
  spreadsheetId: string,
  headerRange: string,
  expected: string[]
): Promise<void> {
  const rows = await readRange(spreadsheetId, headerRange);
  const actual = (rows[0] || []).map((h) => String(h).replace(/\s+/g, ' ').trim().toLowerCase());
  const miss = expected.filter(
    (e, i) => (actual[i] || '') !== e.replace(/\s+/g, ' ').trim().toLowerCase()
  );
  if (miss.length > 0) {
    throw new Error(
      `Struktur sheet berubah (kolom tidak cocok: ${miss.join(', ')}). Hubungi pengawas — penulisan dibatalkan.`
    );
  }
}
