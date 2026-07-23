/* =========================================================================
   Definisi kolom tabel Dashboard — PORT VERBATIM dari objek `COLS` public/app.js.

   Dikonversi mekanis dari sumber, bukan diketik ulang. Label kolom TIDAK boleh
   diubah sembarangan: urutan & label inilah yang dilihat pengguna, dan sebagian
   dipakai renderer sel khusus (mis. `kostStatus`, `jenisTx`, `aksi`, `open`).

   `COLS.prospek` di sumber ditambahkan terpisah setelah literal; di sini
   digabung ke dalam objek yang sama.
   ========================================================================= */

import type { TableCol } from '@/components/ui/Table';

export const COLS: Record<string, TableCol[]> = {
    penghuni: [
      {key:"id",label:"ID"},{key:"name",label:"Nama Lengkap"},{key:"panggil",label:"Panggilan"},
      {key:"kamar",label:"No Kamar"},{key:"jenis",label:"Jenis Kamar"},{key:"asal",label:"Asal Daerah"},{key:"kerja",label:"Pekerjaan"},
      {key:"instansi",label:"Instansi"},{key:"durasi",label:"Durasi (Bln)"},{key:"masuk",label:"Tanggal Masuk"},{key:"tempo",label:"Jatuh Tempo"},
      {key:"kostStatus",label:"Status"},{key:"hp",label:"No HP Penghuni"},{key:"aksi",label:"WhatsApp"},
      {key:"darurat1",label:"Nomor Darurat 1"},{key:"relasi1",label:"Relasi 1"},{key:"namaDarurat1",label:"Nama Kontak 1"},
      {key:"darurat2",label:"Nomor Darurat 2"},{key:"relasi2",label:"Relasi 2"},{key:"namaDarurat2",label:"Nama Kontak 2"},
      {key:"email",label:"Email"},
    ],
    penghuniSales: [{key:"kamar",label:"No Kamar"},{key:"jenis",label:"Jenis Kamar"},{key:"tempo",label:"Tanggal Jatuh Tempo"},{key:"hp",label:"No HP Penghuni"},{key:"aksi",label:"WhatsApp"}],
    pembayaran: [
      {key:"check",label:""},{key:"tanggal",label:"Tanggal"},{key:"idPenghuni",label:"ID Penghuni"},
      {key:"name",label:"Nama"},{key:"jenisTx",label:"Jenis Transaksi"},
      {key:"namaTx",label:"Nama Transaksi"},{key:"jumlah",label:"Jumlah"},{key:"keterangan",label:"Keterangan"},
    ],
    dokumen: [{key:"id",label:"ID Docs"},{key:"name",label:"Judul"},{key:"open",label:"Link"}],
    dokumenOwner: [{key:"id",label:"ID Docs"},{key:"name",label:"Judul"},{key:"divisi",label:"Divisi"},{key:"open",label:"Link"}],
    logbook: [{key:"tanggal",label:"Tanggal"},{key:"name",label:"Task"},{key:"pic",label:"PIC"},{key:"divisi",label:"Divisi"},{key:"deadline",label:"Deadline"},{key:"logStatus",label:"Status"}],
    jatuhTempo: [{key:"name",label:"Nama"},{key:"wa",label:"Nomor WA"},{key:"tempo",label:"Jatuh Tempo"},{key:"sisa",label:"Sisa Hari"},{key:"tagihan",label:"Tagihan"}],
    vendor: [{key:"name",label:"Nama Vendor"},{key:"kategori",label:"Kategori"},{key:"kontak",label:"Nomor Telepon"},{key:"hasil",label:"Hasil"}],
    vendorOps: [{key:"name",label:"Nama Vendor"},{key:"kategori",label:"Kategori"},{key:"kontak",label:"Nomor Telepon"},{key:"hasil",label:"Hasil"},{key:"aksi",label:"WhatsApp"}],
    leads:  [{key:"check",label:""},{key:"id",label:"ID"},{key:"name",label:"Nama"},{key:"wa",label:"Nomor WA"},{key:"asal",label:"Asal"},{key:"tanggal",label:"Tanggal"},{key:"status",label:"Status"}],
    tiket:  [{key:"check",label:""},{key:"id",label:"ID"},{key:"pekerjaan",label:"Pekerjaan"},{key:"jenis",label:"Jenis"},{key:"lokasi",label:"Lokasi"},{key:"tanggal",label:"Tanggal"},{key:"status",label:"Status"}],
    // Logbook Operasional (sesuai desain)
    logInspeksi: [{key:"name",label:"Tanggal"},{key:"item",label:"Item"},{key:"lokasi",label:"Lokasi"},{key:"kategori",label:"Kategori"},{key:"status",label:"Prioritas"}],
    logPerbaikan: [{key:"id",label:"ID"},{key:"name",label:"PIC"},{key:"project",label:"Project"},{key:"prioritas",label:"Prioritas"},{key:"biaya",label:"Biaya"},{key:"status",label:"Status"}],
    // Stok Inventory (monitoring dari app Inventory Stock — integrasi 3 app)
    stokMenipis: [{key:"name",label:"Bahan"},{key:"category",label:"Kategori"},{key:"stok",label:"Stok"},{key:"min",label:"Stok Min"},{key:"kurang",label:"Kurang"}],
    stokTerpakai: [{key:"name",label:"Bahan"},{key:"jumlah",label:"Total Dipakai"},{key:"frekuensi",label:"Transaksi"},{key:"biaya",label:"Total Biaya"}],
    // Daftar Prospek/Survey — Nomor WA (teks) + kolom Pertimbangan + Aksi (tombol WA)
    prospek: [
    {key:"check",label:""},{key:"name",label:"Nama"},{key:"wa",label:"Nomor WA"},{key:"pertimbangan",label:"Pertimbangan"},
    {key:"asal",label:"Asal"},{key:"tanggal",label:"Tanggal"},{key:"aksi",label:"Aksi"},
  ],
};
