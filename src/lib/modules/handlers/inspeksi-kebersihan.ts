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
  }),
  /* Foto inspeksi: YYMMDD-(Kategori Inspeksi)-(kode unik). Kode unik memakai
     rowid barisnya sendiri, jadi berkas di Drive bisa dilacak ke catatannya.
     Kategori modul ini tetap 'Kebersihan' — formnya tidak punya field kategori. */
  lampiran: {
    judul: (v) => `Inspeksi Kebersihan — ${String(v.area ?? '')} (${String(v.tanggal ?? '')})`,
    role: 'Inspeksi',
    penamaan: (v, rowId) => ({
      jenis: 'Foto Inspeksi',
      idDocs: `${kodeTanggal(String(v.tanggal ?? ''))}-Kebersihan-${String(rowId ?? 0).padStart(3, '0')}`
    })
  }
};

/** 'YYYY-MM-DD' → 'YYMMDD' untuk penomoran berkas inspeksi. */
export function kodeTanggal(iso: string): string {
  return iso.replace(/-/g, '').slice(2);
}

export const submitInspeksiKebersihan = createInsertHandler(inspeksiKebersihanInsertCfg);
