import { createAppendHandler } from './helpers';
import { SHEETS } from '@/config/spreadsheets';
import { parseDateISO, required } from '../../validate';
import type { SubmitHandler } from '../types';

// Spreadsheet Daily Task dibuat user belakangan (env SHEET_ID_DAILY_TASK).
// Kontrak kolom yang harus dibuat di tab "Daily Task", baris 1 kolom A:G:
const EXPECTED_HEADERS = ['Tanggal', 'Divisi', 'Nama Task', 'Deskripsi', 'Status', 'PIC', 'Catatan'];

const append = createAppendHandler({
  spreadsheetId: SHEETS.DAILY_TASK,
  range: "'Daily Task'!A:G",
  headerRange: "'Daily Task'!A1:G1",
  expectedHeaders: EXPECTED_HEADERS,
  target: 'Daily Task → Daily Task',
  buildRow: (values) => {
    const tanggal = parseDateISO(String(values.tanggal ?? ''));
    const divisi = required(values.divisi, 'Divisi');
    const namaTask = required(values.namaTask, 'Nama Task');
    const deskripsi = String(values.deskripsi ?? '').trim();
    const status = required(values.status, 'Status');
    const pic = required(values.pic, 'PIC');
    const catatan = String(values.catatan ?? '').trim();
    return [tanggal, divisi, namaTask, deskripsi, status, pic, catatan];
  }
});

export const submitDailyTask: SubmitHandler = async (values, ctx) => {
  if (!SHEETS.DAILY_TASK) {
    throw new Error(
      'Spreadsheet Daily Task belum dikonfigurasi. Buat spreadsheet dengan tab "Daily Task" ' +
        `berkolom A1:G1 = ${EXPECTED_HEADERS.join(' | ')}, lalu set SHEET_ID_DAILY_TASK di environment.`
    );
  }
  try {
    return await append(values, ctx);
  } catch (e) {
    if (e instanceof Error && /Unable to parse range/i.test(e.message)) {
      throw new Error(
        `Tab "Daily Task" belum ada di spreadsheet Daily Task. Buat tab itu dengan kolom A1:G1 = ${EXPECTED_HEADERS.join(' | ')}.`
      );
    }
    throw e;
  }
};
