// Registry 12 modul. Definisi field & target sheet dilengkapi di Tahap 2-5.
// id harus konsisten dengan MODULE_ACCESS di lib/roles.ts

import type { FieldDef } from './types';

export interface ModuleMeta {
  id: string;
  title: string;
  icon: string;
  ready: boolean; // false = form belum di-build, menu menampilkan "segera"
  fields?: FieldDef[]; // diisi saat modul di-build; handler submit terkait ada di modules/handlers/
}

export const MODULES: ModuleMeta[] = [
  {
    id: 'penghuni-baru',
    title: 'Penghuni Baru',
    icon: '🏠',
    ready: true,
    fields: [
      { name: 'tanggalBooking', label: 'Tanggal Booking', type: 'date', required: true, defaultToday: true },
      { name: 'namaPenyewa', label: 'Nama Penyewa', type: 'text', required: true, placeholder: 'Nama lengkap' },
      { name: 'noHp', label: 'No. HP', type: 'text', required: true, placeholder: '081234567890' },
      {
        name: 'kamar',
        label: 'Kamar',
        type: 'select-async',
        required: true,
        master: 'rooms-available',
        masterValue: 'id',
        masterLabel: 'label'
      },
      { name: 'tglMasuk', label: 'Tgl Masuk', type: 'date', required: true },
      {
        name: 'durasiBulan',
        label: 'Durasi (bulan)',
        type: 'select',
        required: true,
        options: [
          { value: '1', label: '1 bulan' },
          { value: '2', label: '2 bulan' },
          { value: '3', label: '3 bulan' },
          { value: '6', label: '6 bulan' },
          { value: '9', label: '9 bulan' },
          { value: '12', label: '12 bulan' }
        ]
      },
      {
        name: 'hargaDisepakati',
        label: 'Harga Disepakati',
        type: 'number',
        required: true,
        helpText: 'Sesuai harga kamar & durasi (lihat label kamar); bisa disesuaikan jika ada nego.'
      },
      { name: 'statusBooking', label: 'Status Booking', type: 'select-async', required: true, master: 'status-booking' },
      { name: 'sumberLeads', label: 'Sumber Leads', type: 'select-async', required: true, master: 'sumber-leads' },
      { name: 'catatan', label: 'Catatan', type: 'textarea', required: false }
    ]
  },
  {
    id: 'pembayaran-sewa',
    title: 'Pembayaran Sewa',
    icon: '💳',
    ready: true,
    fields: [
      {
        name: 'penghuni',
        label: 'Penghuni',
        type: 'select-async',
        required: true,
        master: 'tenants',
        masterValue: 'label',
        masterLabel: 'label'
      },
      {
        name: 'jenisPembayaran',
        label: 'Jenis Pembayaran',
        type: 'select',
        required: true,
        options: [
          { value: 'DP', label: 'DP' },
          { value: 'Sewa', label: 'Sewa' }
        ]
      },
      { name: 'tanggalBayar', label: 'Tanggal Bayar', type: 'date', required: true, defaultToday: true },
      { name: 'nominal', label: 'Nominal', type: 'number', required: true },
      {
        name: 'jumlahBulan',
        label: 'Jumlah Bulan',
        type: 'select',
        required: true,
        options: [
          { value: '1', label: '1 bulan' },
          { value: '2', label: '2 bulan' },
          { value: '3', label: '3 bulan' },
          { value: '6', label: '6 bulan' },
          { value: '9', label: '9 bulan' },
          { value: '12', label: '12 bulan' }
        ]
      },
      {
        name: 'akunKasBank',
        label: 'Akun Kas/Bank Tujuan',
        type: 'select-async',
        required: true,
        master: 'kaslist',
        masterValue: 'id',
        masterLabel: 'label'
      }
    ]
  },
  {
    id: 'pindah-kamar',
    title: 'Pindah Kamar',
    icon: '🔁',
    ready: true,
    fields: [
      { name: 'tanggal', label: 'Tanggal', type: 'date', required: true, defaultToday: true },
      {
        name: 'penghuni',
        label: 'Penghuni',
        type: 'select-async',
        required: true,
        master: 'tenants',
        masterValue: 'label',
        masterLabel: 'label',
        helpText: 'Kamar Lama otomatis terdeteksi dari data penghuni ini.'
      },
      {
        name: 'kamarBaru',
        label: 'Kamar Baru',
        type: 'select-async',
        required: true,
        master: 'rooms-available',
        masterValue: 'id',
        masterLabel: 'label'
      },
      { name: 'alasan', label: 'Alasan', type: 'textarea', required: true },
      { name: 'efektifMulai', label: 'Efektif Mulai', type: 'date', required: false },
      { name: 'catatan', label: 'Catatan', type: 'textarea', required: false }
    ]
  },
  {
    id: 'checkout',
    title: 'Checkout',
    icon: '🚪',
    ready: true,
    fields: [
      { name: 'tanggalCheckout', label: 'Tanggal Checkout', type: 'date', required: true, defaultToday: true },
      {
        name: 'penghuni',
        label: 'Penghuni',
        type: 'select-async',
        required: true,
        master: 'tenants',
        masterValue: 'label',
        masterLabel: 'label'
      },
      { name: 'tglMasuk', label: 'Tgl Masuk (penghuni ini)', type: 'date', required: false },
      {
        name: 'adaTunggakan',
        label: 'Tunggakan?',
        type: 'select',
        required: true,
        options: [
          { value: 'Tidak', label: 'Tidak' },
          { value: 'Ya', label: 'Ya' }
        ]
      },
      { name: 'nominalTunggakan', label: 'Nominal Tunggakan (jika Ya)', type: 'number', required: false },
      { name: 'pengembalianDeposit', label: 'Pengembalian Deposit (Rp)', type: 'number', required: false },
      {
        name: 'kondisiKamar',
        label: 'Kondisi Kamar',
        type: 'select',
        required: true,
        options: [
          { value: 'Baik', label: 'Baik' },
          { value: 'Perlu Perbaikan', label: 'Perlu Perbaikan' },
          { value: 'Rusak', label: 'Rusak' }
        ]
      },
      { name: 'catatanKerusakan', label: 'Catatan Kerusakan', type: 'textarea', required: false }
    ]
  },
  {
    id: 'pengeluaran',
    title: 'Pencatatan Pengeluaran',
    icon: '🧾',
    ready: true,
    fields: [
      { name: 'tanggal', label: 'Tanggal', type: 'date', required: true, defaultToday: true },
      {
        name: 'tipeAkun',
        label: 'Tipe Akun',
        type: 'select',
        required: true,
        options: [
          { value: 'Aset', label: 'Aset' },
          { value: 'Kontra Aset', label: 'Kontra Aset' },
          { value: 'Liabilitas', label: 'Liabilitas' },
          { value: 'Ekuitas', label: 'Ekuitas' },
          { value: 'Kontra Ekuitas', label: 'Kontra Ekuitas' },
          { value: 'Pendapatan', label: 'Pendapatan' },
          { value: 'Beban', label: 'Beban' },
          { value: 'Beban Non-Operasional', label: 'Beban Non-Operasional' }
        ],
        helpText: 'Untuk pengeluaran biasanya "Beban" atau "Beban Non-Operasional".'
      },
      {
        name: 'akunDebit',
        label: 'Kategori Pengeluaran',
        type: 'select-async',
        required: true,
        master: 'accounts',
        masterValue: 'nama',
        masterLabel: 'label',
        dependsOn: 'tipeAkun',
        filterBy: 'tipe',
        helpText: 'Pilih Tipe Akun dulu, lalu akun yang sesuai muncul di sini.'
      },
      {
        name: 'dibayarDari',
        label: 'Dibayar Dari',
        type: 'select-async',
        required: true,
        master: 'kaslist',
        masterValue: 'id',
        masterLabel: 'label'
      },
      { name: 'nominal', label: 'Nominal', type: 'number', required: true },
      {
        name: 'keterangan',
        label: 'Keterangan',
        type: 'text',
        required: true,
        placeholder: 'Contoh: Beli galon - Toko Sumber Rejeki'
      },
      {
        name: 'kategori',
        label: 'Kategori',
        type: 'select',
        required: true,
        options: [
          { value: 'Operasional', label: 'Operasional' },
          { value: 'Non-operasional', label: 'Non-operasional' }
        ]
      }
    ]
  },
  {
    id: 'feedback',
    title: 'Feedback',
    icon: '💬',
    ready: true,
    fields: [
      { name: 'tanggal', label: 'Tanggal', type: 'date', required: true, defaultToday: true },
      {
        name: 'sumber',
        label: 'Sumber',
        type: 'text',
        required: true,
        placeholder: 'KTD-x — Nama, atau "Lainnya"',
        helpText: 'Isi format "KTD-x — Nama" jika dari penghuni, atau "Lainnya" jika bukan.'
      },
      {
        name: 'kategoriFeedback',
        label: 'Kategori Feedback',
        type: 'select-async',
        required: true,
        master: 'setting:LOGBOOK_FEEDBACK:SETTING:Kategori'
      },
      { name: 'isi', label: 'Isi', type: 'textarea', required: true },
      { name: 'tindakLanjut', label: 'Tindak Lanjut', type: 'textarea', required: false },
      { name: 'status', label: 'Status', type: 'select-async', required: true, master: 'setting:LOGBOOK_FEEDBACK:SETTING:Status' },
      { name: 'pic', label: 'PIC', type: 'select-async', required: true, master: 'setting:LOGBOOK_FEEDBACK:SETTING:PIC' }
    ]
  },
  {
    id: 'survey',
    title: 'Log Survey',
    icon: '🔍',
    ready: true,
    fields: [
      { name: 'tanggalSurvey', label: 'Tanggal Survey', type: 'date', required: true, defaultToday: true },
      { name: 'namaCalon', label: 'Nama Calon Penyewa', type: 'text', required: true },
      { name: 'noHp', label: 'No. HP', type: 'text', required: true, placeholder: '081234567890' },
      { name: 'dariMana', label: 'Dari Mana', type: 'select-async', required: true, master: 'setting:LOG_SALES:SETTING:Dari Mana' },
      {
        name: 'kamarDitinjau',
        label: 'Kamar Ditinjau',
        type: 'text',
        required: true,
        placeholder: '3, 5',
        helpText: 'Pisahkan dengan koma jika lebih dari satu kamar.'
      },
      { name: 'jamSurvey', label: 'Jam Survey', type: 'time', required: true },
      { name: 'durasiMnt', label: 'Durasi (menit)', type: 'number', required: false },
      { name: 'feedback', label: 'Feedback/Kesan', type: 'textarea', required: false },
      { name: 'keberatan', label: 'Keberatan/Kendala', type: 'textarea', required: false },
      { name: 'hasilSurvey', label: 'Hasil Survey', type: 'select-async', required: true, master: 'setting:LOG_SALES:SETTING:Hasil Survey' },
      {
        name: 'tindakLanjut',
        label: 'Tindak Lanjut',
        type: 'select-async',
        required: true,
        master: 'setting:LOG_SALES:SETTING:Tindak Lanjut'
      },
      { name: 'pic', label: 'PIC', type: 'select-async', required: true, master: 'setting:LOG_SALES:SETTING:PIC' },
      { name: 'tanggalFu', label: 'Tanggal Follow-up', type: 'date', required: false }
    ]
  },
  {
    id: 'leads',
    title: 'Log Leads Harian',
    icon: '📈',
    ready: true,
    fields: [
      { name: 'tanggal', label: 'Tanggal', type: 'date', required: true, defaultToday: true },
      { name: 'namaLeads', label: 'Nama Leads', type: 'text', required: true, placeholder: 'Nama calon penyewa' },
      { name: 'noHp', label: 'No. HP / WA', type: 'text', required: true, placeholder: '081234567890' },
      {
        name: 'sumberLeads',
        label: 'Sumber Leads',
        type: 'select-async',
        required: true,
        master: 'setting:LOG_MARKETING:SETTING:Kanal Leads'
      },
      { name: 'platform', label: 'Platform', type: 'text', required: false, placeholder: 'Story IG, Teman penghuni, dll' },
      {
        name: 'jenisKamarDicari',
        label: 'Jenis Kamar Dicari',
        type: 'text',
        required: false,
        placeholder: 'Classic, Comfy',
        helpText: 'Pisahkan dengan koma jika lebih dari satu. Kategori: Eco/Classic/Comfy/Lantai 1/Lantai 2.'
      },
      { name: 'budget', label: 'Budget (Rp)', type: 'number', required: false },
      { name: 'checkinRencana', label: 'Check-in Rencana', type: 'date', required: false },
      {
        name: 'statusLeads',
        label: 'Status Leads',
        type: 'select',
        required: true,
        options: [
          { value: 'Baru', label: 'Baru' },
          { value: 'Follow-up', label: 'Follow-up' },
          { value: 'Survey', label: 'Survey' },
          { value: 'Negosiasi', label: 'Negosiasi' },
          { value: 'Booking', label: 'Booking' },
          { value: 'Tidak Jadi', label: 'Tidak Jadi' },
          { value: 'Tidak Respons', label: 'Tidak Respons' }
        ]
      },
      { name: 'tindakLanjut', label: 'Tindak Lanjut', type: 'textarea', required: false },
      { name: 'picCs', label: 'PIC / CS', type: 'text', required: false, placeholder: 'Admin' },
      { name: 'waktuFollowUp', label: 'Waktu Follow-up', type: 'date', required: false }
    ]
  },
  {
    id: 'konten',
    title: 'Log Konten',
    icon: '🎨',
    ready: true,
    fields: [
      { name: 'tanggalPost', label: 'Tanggal Post', type: 'date', required: true, defaultToday: true },
      { name: 'platform', label: 'Platform', type: 'select-async', required: true, master: 'setting:LOG_MARKETING:SETTING:Platform' },
      {
        name: 'jenisKonten',
        label: 'Tipe Konten',
        type: 'select-async',
        required: true,
        master: 'setting:LOG_MARKETING:SETTING:Jenis Konten'
      },
      { name: 'judulCaption', label: 'Judul/Caption (singkat)', type: 'text', required: true },
      {
        name: 'visual',
        label: 'Visual',
        type: 'text',
        required: false,
        placeholder: 'Foto K-03, Video tour K-04',
        helpText: 'Nama/referensi file visual — upload file belum didukung.'
      },
      { name: 'linkPost', label: 'Link Post', type: 'text', required: false },
      { name: 'jamTayang', label: 'Jam Tayang', type: 'time', required: false },
      {
        name: 'status',
        label: 'Status',
        type: 'select-async',
        required: true,
        master: 'setting:LOG_MARKETING:SETTING:Status Konten'
      },
      { name: 'likes', label: 'Likes', type: 'number', required: false, helpText: 'Diisi belakangan setelah konten tayang.' },
      { name: 'komentar', label: 'Komentar', type: 'number', required: false },
      { name: 'shareSaves', label: 'Share/Saves', type: 'number', required: false },
      { name: 'reach', label: 'Reach', type: 'number', required: false },
      { name: 'catatan', label: 'Catatan', type: 'textarea', required: false }
    ]
  },
  {
    id: 'promosi',
    title: 'Log Promosi',
    icon: '📣',
    ready: true,
    fields: [
      { name: 'tanggalMulai', label: 'Tanggal Mulai', type: 'date', required: true, defaultToday: true },
      { name: 'tanggalSelesai', label: 'Tanggal Selesai', type: 'date', required: false },
      { name: 'namaPromosi', label: 'Nama Promosi', type: 'text', required: true },
      {
        name: 'platform',
        label: 'Platform',
        type: 'select-async',
        required: true,
        master: 'setting:LOG_MARKETING:SETTING:Kanal Promosi'
      },
      {
        name: 'tipePromosi',
        label: 'Tipe Promosi',
        type: 'text',
        required: false,
        placeholder: 'Iklan Berbayar, Diskon Harga, Cashback'
      },
      { name: 'budget', label: 'Budget (Rp)', type: 'number', required: false },
      { name: 'spendAktual', label: 'Spend Aktual (Rp)', type: 'number', required: false, helpText: 'Diisi belakangan seiring promo berjalan.' },
      { name: 'target', label: 'Target (Leads)', type: 'number', required: false },
      { name: 'leadsAktual', label: 'Leads Aktual', type: 'number', required: false },
      { name: 'bookingDariPromo', label: 'Booking dari Promo', type: 'number', required: false },
      {
        name: 'status',
        label: 'Status',
        type: 'select-async',
        required: true,
        master: 'setting:LOG_MARKETING:SETTING:Status Promosi'
      }
    ]
  },
  {
    id: 'perawatan-preventif',
    title: 'Perawatan Preventif',
    icon: '🛠️',
    ready: true,
    fields: [
      { name: 'tanggalJadwal', label: 'Tanggal Jadwal', type: 'date', required: true, defaultToday: true },
      { name: 'tanggalSelesai', label: 'Tanggal Selesai', type: 'date', required: false },
      { name: 'fasilitasItem', label: 'Fasilitas/Item', type: 'text', required: true },
      {
        name: 'jenisPerawatan',
        label: 'Jenis Perawatan',
        type: 'select-async',
        required: true,
        master: 'setting:LOG_INSPEKSI_PERAWATAN:SETTING:Jenis Perawatan'
      },
      {
        name: 'kategori',
        label: 'Kategori',
        type: 'select-async',
        required: true,
        master: 'setting:LOG_INSPEKSI_PERAWATAN:SETTING:Kategori Preventif'
      },
      {
        name: 'penyebab',
        label: 'Penyebab',
        type: 'select-async',
        required: false,
        master: 'setting:LOG_INSPEKSI_PERAWATAN:SETTING:Penyebab'
      },
      { name: 'deskripsi', label: 'Deskripsi Pekerjaan', type: 'textarea', required: true },
      {
        name: 'prioritas',
        label: 'Prioritas',
        type: 'select-async',
        required: true,
        master: 'setting:LOG_INSPEKSI_PERAWATAN:SETTING:Prioritas'
      },
      {
        name: 'pelaksana',
        label: 'Pelaksana',
        type: 'select-async',
        required: true,
        master: 'setting:LOG_INSPEKSI_PERAWATAN:SETTING:PIC'
      },
      { name: 'vendor', label: 'Vendor', type: 'text', required: false },
      { name: 'biaya', label: 'Biaya (Rp)', type: 'number', required: false },
      {
        name: 'status',
        label: 'Status',
        type: 'select-async',
        required: true,
        master: 'setting:LOG_INSPEKSI_PERAWATAN:SETTING:Status'
      },
      { name: 'catatan', label: 'Catatan/Dokumentasi', type: 'textarea', required: false }
    ]
  },
  {
    id: 'perbaikan-korektif',
    title: 'Perbaikan Korektif',
    icon: '🔧',
    ready: true,
    fields: [
      { name: 'tanggalKerusakan', label: 'Tanggal Kerusakan', type: 'date', required: true, defaultToday: true },
      { name: 'tanggalLapor', label: 'Tanggal Lapor', type: 'date', required: true, defaultToday: true },
      { name: 'tanggalSelesai', label: 'Tanggal Selesai', type: 'date', required: false },
      {
        name: 'sumberLaporan',
        label: 'Sumber Laporan',
        type: 'select-async',
        required: true,
        master: 'setting:LOG_INSPEKSI_PERAWATAN:SETTING:Sumber Laporan Korektif'
      },
      { name: 'lokasiItem', label: 'Lokasi/Item Rusak', type: 'text', required: true },
      {
        name: 'kategori',
        label: 'Kategori',
        type: 'select-async',
        required: true,
        master: 'setting:LOG_INSPEKSI_PERAWATAN:SETTING:kategori korektif'
      },
      {
        name: 'penyebab',
        label: 'Penyebab',
        type: 'select-async',
        required: false,
        master: 'setting:LOG_INSPEKSI_PERAWATAN:SETTING:Penyebab'
      },
      { name: 'deskripsi', label: 'Deskripsi Kerusakan', type: 'textarea', required: true },
      {
        name: 'prioritas',
        label: 'Prioritas',
        type: 'select-async',
        required: true,
        master: 'setting:LOG_INSPEKSI_PERAWATAN:SETTING:Prioritas'
      },
      {
        name: 'pelaksana',
        label: 'Pelaksana',
        type: 'select-async',
        required: false,
        master: 'setting:LOG_INSPEKSI_PERAWATAN:SETTING:PIC'
      },
      { name: 'vendor', label: 'Vendor', type: 'text', required: false },
      { name: 'biaya', label: 'Biaya (Rp)', type: 'number', required: false },
      {
        name: 'status',
        label: 'Status',
        type: 'select-async',
        required: true,
        master: 'setting:LOG_INSPEKSI_PERAWATAN:SETTING:Status'
      },
      { name: 'catatan', label: 'Catatan/Dokumentasi', type: 'textarea', required: false }
    ]
  },
  {
    id: 'inspeksi-kebersihan',
    title: 'Inspeksi Kebersihan',
    icon: '🧹',
    ready: true,
    fields: [
      { name: 'tanggal', label: 'Tanggal', type: 'date', required: true, defaultToday: true },
      { name: 'area', label: 'Area', type: 'select-async', required: true, master: 'setting:LOGBOOK_INSPEKSI_KEBERSIHAN:SETTING:Area' },
      {
        name: 'hasilKondisi',
        label: 'Hasil/Kondisi',
        type: 'select-async',
        required: true,
        master: 'setting:LOGBOOK_INSPEKSI_KEBERSIHAN:SETTING:Hasil'
      },
      { name: 'temuan', label: 'Temuan', type: 'textarea', required: false },
      { name: 'tindakLanjut', label: 'Tindak Lanjut', type: 'textarea', required: false },
      {
        name: 'petugas',
        label: 'Petugas',
        type: 'select-async',
        required: true,
        master: 'setting:LOGBOOK_INSPEKSI_KEBERSIHAN:SETTING:Petugas'
      }
    ]
  },
  {
    id: 'inspeksi-fasilitas',
    title: 'Inspeksi Fasilitas',
    icon: '📋',
    ready: true,
    fields: [
      { name: 'tanggal', label: 'Tanggal', type: 'date', required: true, defaultToday: true },
      {
        name: 'areaFasilitas',
        label: 'Area/Fasilitas',
        type: 'select-async',
        required: true,
        master: 'setting:LOG_INSPEKSI_PERAWATAN:SETTING:Area'
      },
      { name: 'kondisiDitemukan', label: 'Kondisi Ditemukan', type: 'textarea', required: true },
      {
        name: 'kategori',
        label: 'Kategori',
        type: 'select-async',
        required: true,
        master: 'setting:LOG_INSPEKSI_PERAWATAN:SETTING:Kategori Inspeksi'
      },
      {
        name: 'tindakLanjutPerlu',
        label: 'Tindak Lanjut Diperlukan?',
        type: 'select-async',
        required: true,
        master: 'setting:LOG_INSPEKSI_PERAWATAN:SETTING:Tindak Lanjut'
      },
      {
        name: 'petugas',
        label: 'Petugas Inspeksi',
        type: 'select-async',
        required: true,
        master: 'setting:LOG_INSPEKSI_PERAWATAN:SETTING:PIC'
      },
      { name: 'catatan', label: 'Catatan', type: 'textarea', required: false }
    ]
  }
];
