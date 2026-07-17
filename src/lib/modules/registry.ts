// Registry 14 modul. Definisi field & target sheet dilengkapi di Tahap 2-5.
// id harus konsisten dengan MODULE_ACCESS di lib/roles.ts

import type { FieldDef } from './types';

export interface ModuleMeta {
  id: string;
  title: string;
  /** Ikon dirender dari peta lucide di src/components/module-icons.tsx (bukan emoji). */
  ready: boolean; // false = form belum di-build, menu menampilkan "segera"
  fields?: FieldDef[]; // diisi saat modul di-build; handler submit terkait ada di modules/handlers/
  hasPreview?: boolean; // true = sebelum submit, tampilkan preview (hitung via /api/preview/[id]) + minta konfirmasi
  autoFillTrigger?: string[]; // field yg saat berubah & terisi semua, memicu POST /api/autofill/[id] utk isi field lain otomatis
}

export const MODULES: ModuleMeta[] = [
  {
    id: 'penghuni-baru',
    title: 'Penghuni Baru',
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
      { name: 'catatan', label: 'Catatan', type: 'textarea', required: false },
      {
        name: 'lampiran',
        label: 'Foto/Dokumen (KTP dsb., opsional)',
        type: 'file',
        required: false,
        uploadKind: 'penghuni',
        accept: 'application/pdf,image/png,image/jpeg',
        maxSizeMb: 2,
        placeholder: 'Pilih foto/pdf (maks 2 MB)'
      }
    ]
  },
  {
    id: 'pembayaran-sewa',
    title: 'Pembayaran Sewa',
    ready: true,
    hasPreview: true,
    // Improvement v1.2 §1: begitu Penghuni + Jenis terisi, Periode Awal Sewa diisi otomatis
    // dari MAX(periode_akhir) payment di Turso (tanggal bayar ≠ tanggal awal sewa).
    autoFillTrigger: ['penghuni', 'jenisPembayaran'],
    fields: [
      {
        name: 'penghuni',
        label: 'Nama Penghuni',
        type: 'select-async',
        required: true,
        master: 'tenants',
        masterValue: 'label', // value tetap "KTD-x — Nama" (format baku handler/preview)
        masterLabel: 'nama' // tampilan dropdown cukup nama saja (Improvement v1.1 §5)
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
      { name: 'tanggalBayar', label: 'Tanggal Pembayaran', type: 'date', required: true, defaultToday: true },
      // --- Field khusus Sewa (samakan persis dgn Invoice Generator "Sewa") ---
      {
        name: 'jumlahBulan',
        label: 'Lama Sewa',
        type: 'select-async',
        required: true,
        showIf: { field: 'jenisPembayaran', equals: 'Sewa' },
        master: 'invoice-sewa-durasi',
        masterValue: 'id',
        masterLabel: 'label',
        helpText: 'Opsi durasi diambil langsung dari tabel harga Invoice Generator Sewa.'
      },
      {
        name: 'periodeAwalSewa',
        label: 'Periode Awal Sewa',
        type: 'date',
        required: true,
        showIf: { field: 'jenisPembayaran', equals: 'Sewa' },
        helpText:
          'Terisi otomatis dari tanggal habis sewa terakhir di database — BUKAN tanggal pembayaran. Sesuaikan manual kalau perlu.'
      },
      {
        name: 'biayaDendaPerUnit',
        label: 'Biaya Denda / unit',
        type: 'number',
        required: false,
        showIf: { field: 'jenisPembayaran', equals: 'Sewa' },
        helpText: 'Kosongkan/0 jika tidak ada denda.'
      },
      {
        name: 'jumlahDenda',
        label: 'Jumlah Denda',
        type: 'number',
        required: false,
        showIf: { field: 'jenisPembayaran', equals: 'Sewa' }
      },
      // --- Field Pajak/Diskon: dipakai baik Sewa maupun DP (sama di kedua Invoice Generator) ---
      { name: 'pajak', label: 'Pajak (Rp)', type: 'number', required: false, helpText: 'Kosongkan/0 jika tidak ada pajak.' },
      { name: 'diskon', label: 'Diskon (Rp)', type: 'number', required: false, helpText: 'Kosongkan/0 jika tidak ada diskon.' },
      // --- Field internal mini app (bukan bagian Invoice Generator) — buat pencatatan ledger ---
      // Nominal TIDAK lagi input manual — otomatis = Grand Total hasil preview (kriteria harga sheet
      // Invoice Generator), lihat previewPembayaranSewa & submitPembayaranSewa.
      {
        name: 'akunKasBank',
        label: 'Akun Kas/Bank Tujuan',
        type: 'select-async',
        required: true,
        master: 'kaslist',
        masterValue: 'id',
        masterLabel: 'label'
      },
      {
        name: 'lampiran',
        label: 'Bukti Pembayaran (foto/pdf, opsional)',
        type: 'file',
        required: false,
        uploadKind: 'pembayaran',
        accept: 'application/pdf,image/png,image/jpeg',
        maxSizeMb: 2,
        placeholder: 'Pilih foto/pdf (maks 2 MB)'
      }
    ]
  },
  {
    id: 'pindah-kamar',
    title: 'Pindah Kamar',
    ready: true,
    // Skema baru (Mini App Improvement §5): tulis ke Turso rooms_transfer +
    // update penghuni + occupancy_history, dengan validasi kamar kosong /
    // booking aktif / penghuni aktif di handler.
    fields: [
      { name: 'tanggal', label: 'Tanggal', type: 'date', required: true, defaultToday: true },
      {
        name: 'penghuni',
        label: 'Penghuni',
        type: 'select-async',
        required: true,
        master: 'penghuni-turso',
        masterValue: 'id',
        masterLabel: 'label',
        helpText: 'Kamar lama otomatis terdeteksi dari data penghuni ini.'
      },
      {
        name: 'kamarBaru',
        label: 'Kamar Baru',
        type: 'select-async',
        required: true,
        master: 'kamar-kosong-turso',
        masterValue: 'id',
        masterLabel: 'label',
        helpText: 'Hanya kamar kosong tanpa booking aktif yang muncul di sini.'
      },
      { name: 'alasan', label: 'Alasan', type: 'textarea', required: true },
      { name: 'notes', label: 'Catatan', type: 'textarea', required: false }
    ]
  },
  {
    id: 'checkout',
    title: 'Checkout',
    ready: true,
    autoFillTrigger: ['penghuni', 'tanggalCheckout'],
    fields: [
      { name: 'tanggalCheckout', label: 'Tanggal Checkout', type: 'date', required: true, defaultToday: true },
      {
        name: 'penghuni',
        label: 'Penghuni',
        type: 'select-async',
        required: true,
        master: 'tenants',
        masterValue: 'label',
        masterLabel: 'label',
        helpText: 'Tgl Masuk & Tunggakan di bawah terisi otomatis begitu Penghuni dipilih — cek ulang sebelum kirim.'
      },
      {
        name: 'tglMasuk',
        label: 'Tgl Masuk (penghuni ini)',
        type: 'date',
        required: false,
        helpText: 'Otomatis dari Database Penghuni kalau tersedia. Kosong = belum ada datanya, isi manual.'
      },
      {
        name: 'adaTunggakan',
        label: 'Tunggakan?',
        type: 'select',
        required: true,
        options: [
          { value: 'Tidak', label: 'Tidak' },
          { value: 'Ya', label: 'Ya' }
        ],
        helpText:
          'Otomatis dari riwayat pembayaran di database (tabel payment) — invoice belum lunas dihitung tunggakan. Sesuaikan manual kalau perlu.'
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
      { name: 'catatanKerusakan', label: 'Catatan Kerusakan', type: 'textarea', required: false },
      {
        name: 'lampiran',
        label: 'Foto/Dokumen (kondisi kamar dsb., opsional)',
        type: 'file',
        required: false,
        uploadKind: 'penghuni',
        accept: 'application/pdf,image/png,image/jpeg',
        maxSizeMb: 2,
        placeholder: 'Pilih foto/pdf (maks 2 MB)'
      }
    ]
  },
  {
    id: 'pengeluaran',
    title: 'Pencatatan Pengeluaran',
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
        helpText: 'Beban = operasional (tunai atau pemakaian stok); Beban Non-Operasional = penyusutan.'
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
        master: 'sumber-dana',
        masterValue: 'id',
        masterLabel: 'label',
        dependsOn: 'tipeAkun',
        filterBy: 'tipe',
        helpText:
          'Tunai → pilih kas/bank. Pemakaian bahan dari stok → pilih akun Stok-nya. Penyusutan → pilih Akumulasi Penyusutan.'
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
      },
      {
        name: 'lampiran',
        label: 'Nota/Bukti (foto/pdf, opsional)',
        type: 'file',
        required: false,
        uploadKind: 'nota',
        accept: 'application/pdf,image/png,image/jpeg',
        maxSizeMb: 2,
        placeholder: 'Pilih foto/pdf (maks 2 MB)'
      }
    ]
  },
  {
    id: 'feedback',
    title: 'Feedback',
    ready: true,
    // Improvement v1.1 §7: data masuk database Turso — Kategori "Komplain" → tabel
    // tenant_complain, selain itu (Saran/Kritik) → tabel feedback. Kedua tabel punya
    // CHECK constraint kolom category, makanya kategoriTerkait pilihan tetap di bawah.
    fields: [
      { name: 'tanggal', label: 'Tanggal', type: 'date', required: true, defaultToday: true },
      {
        name: 'sumber',
        label: 'Sumber',
        type: 'select-async',
        required: true,
        master: 'tenants',
        masterValue: 'label',
        masterLabel: 'label'
      },
      {
        name: 'kategoriFeedback',
        label: 'Kategori Feedback',
        type: 'select-async',
        required: true,
        master: 'setting:LOGBOOK_FEEDBACK:SETTING:Kategori',
        helpText: 'Komplain dicatat sebagai keluhan penghuni (tenant complain); Saran/Kritik masuk log feedback.'
      },
      {
        name: 'kategoriTerkait',
        label: 'Terkait',
        type: 'select',
        required: true,
        // HARUS sama persis dgn CHECK(category) di tabel feedback & tenant_complain
        options: ['Internet', 'Listrik', 'Air', 'AC', 'kebersihan', 'Keamanan', 'Fasilitas', 'Pelayanan', 'Lainnya'].map(
          (v) => ({ value: v, label: v === 'kebersihan' ? 'Kebersihan' : v })
        )
      },
      { name: 'isi', label: 'Isi', type: 'textarea', required: true },
      { name: 'status', label: 'Status', type: 'select-async', required: true, master: 'setting:LOGBOOK_FEEDBACK:SETTING:Status' }
    ]
  },
  {
    id: 'survey',
    title: 'Log Survey',
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
      { name: 'catatan', label: 'Catatan/Dokumentasi', type: 'textarea', required: false },
      {
        name: 'lampiran',
        label: 'Foto/Dokumen (opsional)',
        type: 'file',
        required: false,
        uploadKind: 'maintenance',
        accept: 'application/pdf,image/png,image/jpeg',
        maxSizeMb: 2,
        placeholder: 'Pilih foto/pdf (maks 2 MB)'
      }
    ]
  },
  {
    id: 'perbaikan-korektif',
    title: 'Perbaikan Korektif',
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
      { name: 'catatan', label: 'Catatan/Dokumentasi', type: 'textarea', required: false },
      {
        name: 'lampiran',
        label: 'Foto/Dokumen (opsional)',
        type: 'file',
        required: false,
        uploadKind: 'maintenance',
        accept: 'application/pdf,image/png,image/jpeg',
        maxSizeMb: 2,
        placeholder: 'Pilih foto/pdf (maks 2 MB)'
      }
    ]
  },
  {
    id: 'inspeksi-kebersihan',
    title: 'Inspeksi Kebersihan',
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
    id: 'daily-task',
    title: 'Tugas Harian', // istilah Indonesia (Improvement v1.1 §8); id tetap 'daily-task' (URL/roles/handler)
    ready: true,
    // Format mengikuti tabel Turso daily_tasks (Mini App Improvement §1):
    // Tanggal, Task, PIC, Divisi, Deadline, Status — push ke database Turso.
    fields: [
      { name: 'tanggal', label: 'Tanggal', type: 'date', required: true, defaultToday: true },
      { name: 'task', label: 'Tugas', type: 'text', required: true, placeholder: 'Contoh: Follow-up leads WA' },
      { name: 'pic', label: 'PIC', type: 'text', required: true, placeholder: 'Nama petugas' },
      {
        name: 'divisi',
        label: 'Divisi',
        type: 'select',
        required: true,
        options: [
          { value: 'Admin', label: 'Admin' },
          { value: 'Cleaning', label: 'Cleaning' },
          { value: 'Finance', label: 'Finance' },
          { value: 'Inspeksi', label: 'Inspeksi' },
          { value: 'Maintenance', label: 'Maintenance' },
          { value: 'Marketing', label: 'Marketing' },
          { value: 'Sales', label: 'Sales' }
        ]
      },
      { name: 'deadline', label: 'Deadline', type: 'date', required: true },
      {
        name: 'status',
        label: 'Status',
        type: 'select',
        required: true,
        options: [
          { value: 'Pending', label: 'Pending' },
          { value: 'In Progress', label: 'In Progress' },
          { value: 'Complete', label: 'Complete' }
        ]
      }
    ]
  },
  {
    id: 'inspeksi-fasilitas',
    title: 'Inspeksi Fasilitas',
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
  },
  // Modul "Upload Dokumen" dihapus (Improvement v1.1 §4) — tabel Turso `dokumen` tetap
  // dipakai sebagai tempat metadata lampiran modul-modul lain (lihat helpers saveLampiran).
  ...makeWorkOrderModules()
];

/**
 * Modul Input Work Order divisi Inspeksi & Cleaning (Mini App Improvement §2).
 * Data masuk tabel Turso work_orders → muncul di joblist divisi tujuan.
 * Bukti foto diunggah ke Drive via /api/upload (value = URL Drive).
 */
function makeWorkOrderModules(): ModuleMeta[] {
  const KATEGORI = [
    'Elektrikal dan Elektronik',
    'Sanitasi dan Plumbing',
    'Sipil dan Bangunan',
    'Furniture dan Interior',
    'Fasum dan Keamanan',
    'Kebersihan'
  ].map((v) => ({ value: v, label: v }));
  const PRIORITAS = ['Tinggi', 'Sedang', 'Rendah', 'Darurat'].map((v) => ({ value: v, label: v }));

  const fieldsFor = (tujuan: string[]): FieldDef[] => [
    { name: 'tanggalInput', label: 'Tanggal Input', type: 'date', required: true, defaultToday: true },
    { name: 'petugas', label: 'Petugas', type: 'text', required: true, placeholder: 'Nama petugas pelapor' },
    { name: 'lokasiItem', label: 'Lokasi/Item', type: 'text', required: true, placeholder: 'Contoh: Kamar 3 — AC' },
    { name: 'kategori', label: 'Kategori', type: 'select', required: true, options: KATEGORI },
    { name: 'deskripsi', label: 'Deskripsi', type: 'textarea', required: true },
    { name: 'prioritas', label: 'Prioritas', type: 'select', required: true, options: PRIORITAS },
    {
      name: 'tujuanDivisi',
      label: 'Tujuan Divisi',
      type: 'select',
      required: true,
      options: tujuan.map((v) => ({ value: v, label: v })),
      helpText: 'Work order akan muncul di joblist divisi ini.'
    },
    { name: 'targetDeadline', label: 'Target Deadline', type: 'date', required: true },
    { name: 'catatan', label: 'Catatan', type: 'textarea', required: false },
    {
      name: 'buktiFoto',
      label: 'Bukti Foto',
      type: 'file',
      required: false,
      uploadKind: 'work-order',
      accept: 'image/jpeg,image/png',
      maxSizeMb: 2,
      placeholder: 'Pilih foto (jpg/png, maks 2 MB)'
    }
  ];

  return [
    { id: 'wo-inspeksi', title: 'Input Work Order', ready: true, fields: fieldsFor(['Cleaning', 'Maintenance']) },
    { id: 'wo-cleaning', title: 'Input Work Order', ready: true, fields: fieldsFor(['Maintenance', 'Inspeksi']) }
  ];
}
