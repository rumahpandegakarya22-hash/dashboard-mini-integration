import { createInsertHandler, type InsertConfig } from './helpers';
import { parseDateISO, required } from '../../core/validate';

function num(v: unknown): number {
  const n = parseInt(String(v ?? '0').replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
}

/* Wave 2 migrasi Sheets → Turso: dulu append ke Log Marketing → 'Log Konten'!A:M.
   Sekarang INSERT ke tabel `content`.

   ⚠️ NAMA KOLOM TURSO TERTUKAR — JANGAN dipetakan menurut namanya:
       content.jam_tayang  sebenarnya berisi VISUAL/aset  ("Foto K-03", "Grafis promo")
       content.jam         sebenarnya berisi JAM TAYANG   ("18:00", "19:00")
   Ini warisan migrasi CSV posisional. Dikonfirmasi dua sumber independen:
     1. isi tabel produksi (jam_tayang berisi teks aset, jam berisi jam), dan
     2. src/lib/dashboard/sheet-map.ts yang melabeli jam_tayang sebagai
        "Aset (Foto/Video)" dan jam sebagai "Jam Tayang".
   Memetakan jamTayang → jam_tayang akan MERUSAK kolom aset di dashboard.

   Kolom formula `engagement` & `er_persen` sengaja TIDAK ditulis — dihitung
   compute.ts / scripts/recompute-turso.ts (lihat FORMULA_COLUMNS). */
export const kontenInsertCfg: InsertConfig = {
  table: 'content',
  target: 'Turso → content',
  buildRow: (values) => ({
    tgl_post: parseDateISO(String(values.tanggalPost ?? '')),
    platform: required(values.platform, 'Platform'),
    tipe_konten: required(values.jenisKonten, 'Tipe Konten'),
    judul_caption: required(values.judulCaption, 'Judul/Caption'),
    jam_tayang: String(values.visual ?? '').trim(), // ← VISUAL, lihat catatan di atas
    link_post: String(values.linkPost ?? '').trim(),
    jam: String(values.jamTayang ?? '').trim(), // ← JAM TAYANG, lihat catatan di atas
    status: required(values.status, 'Status'),
    likes: num(values.likes),
    komentar: num(values.komentar),
    share_saves: num(values.shareSaves),
    reach: num(values.reach),
    catatan: String(values.catatan ?? '').trim()
  })
};

export const submitKonten = createInsertHandler(kontenInsertCfg);
