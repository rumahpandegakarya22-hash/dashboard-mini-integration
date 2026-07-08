import { createAppendHandler } from './helpers';
import { SHEETS } from '@/config/spreadsheets';
import { parseDateISO, required } from '../../validate';

// Sheet BARU "Log Leads Harian" di Log Marketing (belum ada, dibuat saat setup — PRD §6 Modul 8).
// Header di bawah adalah KONTRAK yang didefinisikan app (usulan PRD, konfirmasi ke tim marketing
// saat setup).
const EXPECTED_HEADERS = ['Tanggal', 'Kanal', 'Jumlah Leads', 'Leads Respon', 'Leads Survey', 'Catatan'];

export const submitLeads = createAppendHandler({
  spreadsheetId: SHEETS.LOG_MARKETING,
  range: "'Log Leads Harian'!A:F",
  headerRange: "'Log Leads Harian'!A1:F1",
  expectedHeaders: EXPECTED_HEADERS,
  target: 'Log Marketing → Log Leads Harian',
  buildRow: (values) => {
    const tanggal = parseDateISO(String(values.tanggal ?? ''));
    const kanal = required(values.kanal, 'Kanal');
    const jumlahLeads = parseInt(String(values.jumlahLeads ?? '0'), 10) || 0;
    const leadsRespon = parseInt(String(values.leadsRespon ?? '0'), 10) || 0;
    const leadsSurvey = parseInt(String(values.leadsSurvey ?? '0'), 10) || 0;
    const catatan = String(values.catatan ?? '').trim();
    return [tanggal, kanal, jumlahLeads, leadsRespon, leadsSurvey, catatan];
  }
});
