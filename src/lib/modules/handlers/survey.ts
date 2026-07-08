import { createAppendHandler } from './helpers';
import { SHEETS } from '@/config/spreadsheets';
import { normalizePhone, parseDateISO, required } from '../../validate';

// Kolom A:M sheet "Log Survey" (Log Sales). Header DIKONFIRMASI live 8 Jul (bukan tebakan lagi).
const EXPECTED_HEADERS = [
  'Tanggal Survey',
  'Nama Calon Penyewa',
  'No. HP',
  'Dari Mana',
  'Kamar Ditinjau',
  'Jam Survey',
  'Durasi (mnt)',
  'Feedback / Kesan',
  'Keberatan / Kendala',
  'Hasil Survey',
  'Tindak Lanjut',
  'PIC',
  'Tanggal FU'
];

export const submitSurvey = createAppendHandler({
  spreadsheetId: SHEETS.LOG_SALES,
  range: "'Log Survey'!A:M",
  headerRange: "'Log Survey'!A1:M1",
  expectedHeaders: EXPECTED_HEADERS,
  target: 'Log Sales → Log Survey',
  buildRow: (values) => {
    const tanggalSurvey = parseDateISO(String(values.tanggalSurvey ?? ''));
    const namaCalon = required(values.namaCalon, 'Nama Calon Penyewa');
    const noHp = normalizePhone(String(values.noHp ?? ''));
    const dariMana = required(values.dariMana, 'Dari Mana');
    const kamarDitinjau = required(values.kamarDitinjau, 'Kamar Ditinjau');
    const jamSurvey = required(values.jamSurvey, 'Jam Survey');
    const durasiMnt = values.durasiMnt ? parseInt(String(values.durasiMnt), 10) : null;
    const feedback = String(values.feedback ?? '').trim();
    const keberatan = String(values.keberatan ?? '').trim();
    const hasilSurvey = required(values.hasilSurvey, 'Hasil Survey');
    const tindakLanjut = required(values.tindakLanjut, 'Tindak Lanjut');
    const pic = required(values.pic, 'PIC');
    const tanggalFu = values.tanggalFu ? parseDateISO(String(values.tanggalFu)) : '';
    return [
      tanggalSurvey,
      namaCalon,
      `'${noHp}`,
      dariMana,
      kamarDitinjau,
      jamSurvey,
      durasiMnt,
      feedback,
      keberatan,
      hasilSurvey,
      tindakLanjut,
      pic,
      tanggalFu
    ];
  }
});
