import { createInsertHandler, type InsertConfig } from './helpers';
import { normalizePhone, parseDateISO, required } from '../../core/validate';

/* Wave 2 migrasi Sheets → Turso: dulu append ke Log Sales → 'Log Survey'!A:M.
   Sekarang INSERT ke tabel `survey`. Pemetaan kolom sheet → kolom Turso:
     Tanggal Survey→tanggal_survey, Nama Calon Penyewa→nama_calon_penyewa,
     No. HP→no_hp, Dari Mana→sumber, Kamar Ditinjau→kamar_ditinjau,
     Jam Survey→jam_survey, Durasi (mnt)→durasi_menit, Feedback→feedback,
     Keberatan→keberatan_kendala, Hasil Survey→hasil_survey,
     Tindak Lanjut→tindak_lanjut, PIC→pic, Tanggal FU→tanggal_fu_survey.
   Kolom `id_survey` & `no_booking` sengaja tidak diisi di sini (opsional,
   no_booking baru terisi bila survey berlanjut jadi booking). */
export const surveyInsertCfg: InsertConfig = {
  table: 'survey',
  target: 'Turso → survey',
  buildRow: (values) => ({
    tanggal_survey: parseDateISO(String(values.tanggalSurvey ?? '')),
    nama_calon_penyewa: required(values.namaCalon, 'Nama Calon Penyewa'),
    no_hp: normalizePhone(String(values.noHp ?? '')),
    sumber: required(values.dariMana, 'Dari Mana'),
    kamar_ditinjau: required(values.kamarDitinjau, 'Kamar Ditinjau'),
    jam_survey: required(values.jamSurvey, 'Jam Survey'),
    durasi_menit: values.durasiMnt ? parseInt(String(values.durasiMnt), 10) : null,
    feedback: String(values.feedback ?? '').trim(),
    keberatan_kendala: String(values.keberatan ?? '').trim(),
    hasil_survey: required(values.hasilSurvey, 'Hasil Survey'),
    tindak_lanjut: required(values.tindakLanjut, 'Tindak Lanjut'),
    pic: required(values.pic, 'PIC'),
    tanggal_fu_survey: values.tanggalFu ? parseDateISO(String(values.tanggalFu)) : null
  })
};

export const submitSurvey = createInsertHandler(surveyInsertCfg);
