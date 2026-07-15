import type { SessionUser } from '../auth';

export type FieldType = 'text' | 'number' | 'date' | 'time' | 'select' | 'select-async' | 'textarea' | 'file';

export interface FieldOption {
  value: string;
  label: string;
}

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: FieldOption[]; // type=select: pilihan tetap
  master?: string; // type=select-async: key ke /api/master/[type]
  masterValue?: string; // properti objek master dipakai sbg value (default 'id')
  masterLabel?: string; // properti objek master dipakai sbg label (default = masterValue)
  placeholder?: string;
  defaultToday?: boolean; // type=date: isi otomatis hari ini
  helpText?: string;
  dependsOn?: string; // type=select-async: nama field lain yg mengontrol filter (mis. "tipeAkun")
  filterBy?: string; // properti objek master dicocokkan dgn nilai field dependsOn (mis. "tipe")
  showIf?: { field: string; equals: string | string[] }; // tampilkan field ini hanya jika field lain bernilai tertentu
  // (mis. { field: 'jenisPembayaran', equals: 'Sewa' }). Field yg disembunyikan tidak divalidasi/dikirim.
  uploadKind?: string; // type=file: kunci folder Drive tujuan di /api/upload (mis. 'work-order'); value field = URL Drive hasil upload
  accept?: string; // type=file: atribut accept input (mis. 'image/jpeg,image/png')
  maxSizeMb?: number; // type=file: batas ukuran (default 2 MB)
}

export interface SubmitContext {
  user: SessionUser;
  requestId: string;
}

export interface SubmitResult {
  target: string; // "namaFile → sheet", dicatat di audit log
  row?: number;
  data: Record<string, unknown>;
  warning?: string; // peringatan non-blokir ditampilkan ke user setelah submit sukses (mis. nominal ganjil)
}

/** Kontrak handler submit per modul. Implementasi konkret ditambahkan modul-per-modul (Tahap 3-5). */
export type SubmitHandler = (values: Record<string, unknown>, ctx: SubmitContext) => Promise<SubmitResult>;

/**
 * Hasil preview: hitung nilai (mis. invoice) TANPA menulis apa pun & TANPA efek samping.
 * `fields` = daftar {label, value} yang ditampilkan ke user sebelum dia konfirmasi kirim.
 */
export interface PreviewResult {
  fields: { label: string; value: string }[];
  raw: Record<string, unknown>; // nilai mentah, dikirim balik ke handler submit saat konfirmasi (hindari hitung ulang/rebeda)
}

/** Kontrak handler preview — dipanggil sebelum submit sungguhan untuk modul dgn hasPreview:true. */
export type PreviewHandler = (values: Record<string, unknown>, ctx: SubmitContext) => Promise<PreviewResult>;

/**
 * Hasil auto-fill: field yg dihitung/diambil otomatis (mis. Tgl Masuk, Tunggakan) berdasarkan
 * field lain yg sudah diisi (mis. Penghuni). `fields` di-merge ke form (overwrite nilai lama —
 * benar, karena kalau penghuni berganti, nilai lama milik penghuni sebelumnya sudah tidak relevan).
 * `note` = penjelasan/langkah manual ditampilkan ke admin kalau sebagian tidak bisa dihitung.
 */
export interface AutoFillResult {
  fields: Record<string, string>;
  note?: string;
}

/** Kontrak handler auto-fill — dipanggil saat field ModuleMeta.autoFillTrigger berubah & terisi semua. */
export type AutoFillHandler = (values: Record<string, unknown>, ctx: SubmitContext) => Promise<AutoFillResult>;
