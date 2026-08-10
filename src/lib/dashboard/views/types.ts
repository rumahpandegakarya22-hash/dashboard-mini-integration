/* =========================================================================
   Model tampilan Dashboard — bentuk data yang dikonsumsi komponen halaman.

   PORT dari variabel global `app.js` (PENGHUNI, LOGBOOK, LEADS, SURVEY, …).
   Perbedaan mendasar: di app.js ini semua adalah `let` global yang dimutasi
   `loadLiveData()`; di sini ia jadi NILAI KEMBALIAN fungsi murni sehingga bisa
   dihitung di Server Component dan diuji tanpa DOM (§3, §7).
   ========================================================================= */

export interface Penghuni {
  no: number | string;
  id: string;
  nama: string;
  panggil: string;
  kamar: number;
  jenis: string;
  asal: string;
  kerja: string;
  instansi: string;
  durasi: string;
  masuk: string;
  tempo: string;
  status: string;
  kontak: string;
  email: string;
  darurat1: string;
  relasi1: string;
  namaDarurat1: string;
  darurat2: string;
  relasi2: string;
  namaDarurat2: string;
  sisa: number | null;
  flag: string;
  hp: string;
  wa: string;
}

export interface LogbookRow {
  tanggal: string;
  name: string;
  pic: string;
  divisi: string;
  deadline: string;
  logStatus: string;
}

export interface PaymentRaw {
  idP: string;
  inv: string;
  awal: string;
  akhir: string;
  amount: string;
  tgl: string;
  metode: string;
  status: string;
  notes: string;
  nama?: string;
}

/** Pil status bergaya `{t,c}` — dipakai renderer sel tabel. */
export interface Pill {
  t: string;
  c: string;
}

export interface LeadRow {
  check: boolean;
  id: string;
  name: string;
  wa: string;
  asal: string;
  tanggal: string;
  status: Pill;
}

export interface SurveyRow {
  check: boolean;
  nama: string;
  wa: string;
  asal: string;
  pertimbangan: string;
  tanggal: string;
}

export interface BookingRow {
  nama: string;
  kamar: string;
  status: string;
  durasi: string;
  harga: string;
  tanggal: string;
  cancel: string;
}

export interface TiketRow {
  check: boolean;
  id: string;
  pekerjaan: string;
  jenis: string;
  lokasi: string;
  tanggal: string;
  status: Pill;
  _biaya: number;
  _respJam: number | null;
  _resolHari: number | null;
}

export interface VendorRow {
  id: string;
  nama: string;
  kategori: string;
  kontak: string;
  hasil: string;
  wa: string;
}

export interface KamarRow {
  id: string;
  kamar: number;
  nama: string;
  tipe: string;
  harga: string;
  status: string;
}

export interface DokumenRow {
  id: string;
  name: string;
  role: string;
  kategori: string;
  tanggal: string;
  link: string;
}

export interface OccupantRow {
  id: string;
  nama: string;
  kamar: string;
  masuk: string;
  keluar: string;
  status: string;
}

export interface Retention {
  total: number;
  churned: number;
  rate: number;
  churn: number;
  avgTenure: number | null;
}

/** Baris "Data Kamar" hasil turunan (ROOMS di app.js). */
export interface RoomRow {
  no: string;
  _n: number;
  jenis: string;
  penghuni: string;
  wa: string;
  harga: string;
  status: string;
}

export interface Stats {
  aktif: number;
  booking: number;
  tunggakan: number;
  jatuhTempo: number;
  kapasitas: number;
  occupied: number;
  kosong: number;
  okupansi: number;
}

export interface TempoEntry {
  name: string;
  nama: string;
  wa: string;
  tempo: string;
  sisa: string;
  _s: number;
  idPenghuni?: string;
}

export interface Tempo {
  list: TempoEntry[];
  tunggakan: number;
  jatuhTempo: number;
}

export interface PembayaranRow {
  check: boolean;
  tanggal: string;
  _t: Date | null;
  idPenghuni: string;
  nama: string;
  name: string;
  jenisTx: Pill;
  namaTx: string;
  jumlah: string;
  keterangan: string;
}

/** Baris tabel Transaksi (pendapatan non-sewa + pengeluaran). */
export interface TransaksiRow {
  tanggal: string;
  namaTx: string;
  jenisTx: string;
  jumlah: string;
  keterangan: string;
}

export interface WaitingListRow {
  id: string;
  name: string;
  wa: string;
  tipe: string;
  rencanaTanggal: string;
  budgetMax: string;
  status: string;
  keterangan: string;
  aksi: string;
}

/** Seluruh data dashboard hasil hidrasi satu kali dari /api/dashboard/sheets. */
export interface DashboardData {
  penghuni: Penghuni[];
  logbook: LogbookRow[];
  payments: PaymentRaw[];
  leads: LeadRow[];
  survey: SurveyRow[];
  booking: BookingRow[];
  tiket: TiketRow[];
  vendor: VendorRow[];
  kamar: KamarRow[];
  dokumen: DokumenRow[];
  occupants: OccupantRow[];
  retention: Retention | null;
  rooms: RoomRow[];
  stats: Stats;
  tempo: Tempo | null;
  pembayaran: PembayaranRow[];
  transaksi: TransaksiRow[];
}
