import { createInsertHandler, type InsertConfig } from './helpers';
import { parseDateISO, required } from '../../core/validate';

/* Wave 2 migrasi Sheets → Turso: dulu append ke LOGBOOK_INSPEKSI_KEBERSIHAN →
   'Sheet1'!B:E. Sekarang INSERT ke tabel `inspeksi_kebersihan` (tabel BARU).

   PERBAIKAN KEHILANGAN DATA: sheet lama cuma punya 4 kolom generik
   (Tanggal/Aktivitas/Lokasi/Keterangan), sehingga lima field form dipadatkan —
   Temuan + Tindak Lanjut + Petugas digabung jadi SATU string "Keterangan"
   ("Temuan: ... | Tindak Lanjut: ... | Petugas: ..."). Akibatnya ketiganya
   tidak bisa difilter/diagregasi lagi. Tabel Turso punya kolom sendiri-sendiri,
   jadi penggabungan itu DIBUANG dan tiap field disimpan utuh. */
export const inspeksiKebersihanInsertCfg: InsertConfig = {
  table: 'inspeksi_kebersihan',
  target: 'Turso → inspeksi_kebersihan',
  buildRow: (values) => ({
    tanggal: parseDateISO(String(values.tanggal ?? '')),
    area: required(values.area, 'Area'),
    hasil_kondisi: required(values.hasilKondisi, 'Hasil/Kondisi'),
    temuan: String(values.temuan ?? '').trim(),
    tindak_lanjut: String(values.tindakLanjut ?? '').trim(),
    petugas: required(values.petugas, 'Petugas')
  })
};

export const submitInspeksiKebersihan = createInsertHandler(inspeksiKebersihanInsertCfg);
