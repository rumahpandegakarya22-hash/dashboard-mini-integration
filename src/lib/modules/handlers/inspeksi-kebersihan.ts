import { createAppendHandler } from './helpers';
import { SHEETS } from '@/config/spreadsheets';
import { parseDateISO, required } from '../../validate';

// Sheet aktual bernama "Sheet1" (BUKAN "Logbook" seperti tebakan awal), judul internal "LOGBOOK
// KEBERSIHAN". Header DIKONFIRMASI dari sheet asli (dibuat user, 8 Jul): cuma 4 kolom generik
// (Tanggal/Aktivitas/Lokasi/Keterangan), data mulai KOLOM B (kolom A kosong) dan header di BARIS 3
// (bukan baris 1).
// Field Area/Hasil-Kondisi/Temuan/Tindak Lanjut/Petugas tetap dipertahankan sbg field form (didukung
// dropdown SETTING nyata: Area, Hasil, Petugas), tapi digabung ke 4 kolom yg tersedia:
//   Aktivitas ← Hasil/Kondisi, Lokasi ← Area, Keterangan ← gabungan Temuan + Tindak Lanjut + Petugas.
// Ini asumsi pemetaan — kalau user lebih suka struktur lain (mis. tambah kolom Petugas terpisah
// di sheet), sesuaikan di sini + tambah kolom di Google Sheets.
const EXPECTED_HEADERS = ['Tanggal', 'Aktivitas', 'Lokasi', 'Keterangan'];

export const submitInspeksiKebersihan = createAppendHandler({
  spreadsheetId: SHEETS.LOGBOOK_INSPEKSI_KEBERSIHAN,
  range: "'Sheet1'!B:E",
  headerRange: "'Sheet1'!B3:E3",
  expectedHeaders: EXPECTED_HEADERS,
  target: 'Logbook Inspeksi Kebersihan',
  buildRow: (values) => {
    const tanggal = parseDateISO(String(values.tanggal ?? ''));
    const area = required(values.area, 'Area');
    const hasilKondisi = required(values.hasilKondisi, 'Hasil/Kondisi');
    const temuan = String(values.temuan ?? '').trim();
    const tindakLanjut = String(values.tindakLanjut ?? '').trim();
    const petugas = required(values.petugas, 'Petugas');
    const keterangan = [temuan && `Temuan: ${temuan}`, tindakLanjut && `Tindak Lanjut: ${tindakLanjut}`, `Petugas: ${petugas}`]
      .filter(Boolean)
      .join(' | ');
    return [tanggal, hasilKondisi, area, keterangan];
  }
});
