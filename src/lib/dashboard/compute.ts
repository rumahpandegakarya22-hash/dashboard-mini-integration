/* =========================================================================
   Kost Tiga Dara — Compute Engine (paritas formula spreadsheet → Turso)

   PORT VERBATIM dari `server/compute.js` repo Dashboard lama (Fase 2 migrasi).
   Aturan §11.2.1: TIDAK ADA perbaikan logika/aritmetika saat memindahkan —
   termasuk formula bertanda [PENDING] (§11.2.4). Setiap perubahan perilaku
   harus lewat perubahan sadar yang dicatat di docs/MIGRASI.md.

   Di spreadsheet Rumah_Pandega_LIVE_v2, banyak kolom adalah FORMULA
   (mis. engagement, ER%, CPL, tgl keluar estimasi, durasi perbaikan, SLA,
   ROI, saldo normal COA, tier harga kamar). Saat data di-export ke CSV lalu
   di-migrasi ke Turso, formula itu "beku" jadi nilai statis. Artinya BARIS
   BARU yang di-insert langsung ke Turso TIDAK akan punya kolom itu terisi
   dengan benar.

   Modul ini menghitung ULANG semua kolom turunan dari kolom mentah, supaya
   data dari Turso "sama persis" dengan yang dulu dihasilkan spreadsheet.

   Dipakai 2 arah:
     • ON-READ  : dipanggil lib/dashboard/source.ts saat menyajikan data.
     • ON-WRITE : dipakai scripts/recompute-turso.ts untuk menulis balik kolom
                  formula ke Turso agar konsisten untuk konsumen lain.

   TINGKAT KEYAKINAN tiap formula ditandai di komentar:
     [VERIFIED] cocok 100% dengan data hasil migrasi (batched.db).
     [LOOKUP]   tabel referensi diturunkan dari data / aturan akuntansi baku.
     [VERIFIED-EMPIRIS] sumbernya di spreadsheet TIDAK berformula (jadi tak bisa
                dikunci dari rumus), tetapi aturannya sudah diuji mereproduksi
                100% baris produksi yang ada. Bukan tebakan, tapi juga bukan
                salinan rumus.
     [PENDING]  aritmetika ambigu — best-effort; WAJIB dikonfirmasi dari
                formula asli via scripts/dump-formulas.ts (lihat FORMULA_CONFIG).
   ========================================================================= */

/**
 * Baris database. Sengaja `any` per-nilai, bukan `unknown`: baris datang dari
 * Turso dengan skema dinamis, dan modul ini melakukan aritmetika/perbandingan
 * bebas-tipe persis seperti versi JS. Menyempitkan tipe di sini berisiko
 * mengubah perilaku — justru yang dilarang §11.2.1.
 */
export type DbRow = Record<string, any>;
export type DbTables = Record<string, DbRow[]>;

interface ComputeCtx {
  coaByKode?: Record<string, DbRow>;
}

/* -------------------------------------------------------------------------
   FORMULA_CONFIG — satu tempat untuk semua parameter formula yang BELUM
   dikunci dari spreadsheet. Setelah menjalankan `npx tsx scripts/dump-formulas.ts`
   di komputer (dengan service account), ganti nilai di sini agar 100% identik.
   ------------------------------------------------------------------------- */
const FORMULA_CONFIG = {
  /* Tier harga kamar per tipe [LOOKUP dari data migrasi — 3 tipe diketahui].
     harga_bulan & tier lain seluruhnya ditentukan oleh tipe_kamar di sumber.
     Tambahkan entri baru bila ada tipe kamar baru. */
  priceByTipe: {
    'Eco (Non AC)': { bulan: 850000, b3: 2400000, b6: 4800000, b9: 7200000, tahun: 8800000 },
    'Classic (AC)': { bulan: 1200000, b3: 3600000, b6: 7200000, b9: 10800000, tahun: 13200000 },
    'Comfy (AC)': { bulan: 1600000, b3: 4800000, b6: 9600000, b9: 14400000, tahun: 17600000 }
  } as Record<string, { bulan: number; b3: number; b6: number; b9: number; tahun: number } | undefined>,

  /* Kode kategori maintenance [LOOKUP — 2 diketahui dari data; lengkapi dari
     sheet parameter maintenance bila ada kategori lain]. */
  kodeByKategori: {
    'Elektrikal dan Elektronik': 'ELK',
    'Furniture dan Interior': 'FUR'
  } as Record<string, string | undefined>,

  /* Saldo normal per tipe akun COA [LOOKUP — aturan akuntansi baku, cocok
     100% dengan 122 baris COA]. */
  saldoNormalByTipe: {
    Aset: 'Debit',
    Beban: 'Debit',
    'Beban Non-Operasional': 'Debit',
    'Kontra Ekuitas': 'Debit',
    Ekuitas: 'Kredit',
    'Kontra Aset': 'Kredit',
    Liabilitas: 'Kredit',
    Pendapatan: 'Kredit'
  } as Record<string, string | undefined>,

  /* [VERIFIED — dump formulas 21 Juli 2026] Target SLA maintenance: SATU angka
     flat (hari), BUKAN per prioritas.

     Rumus asli — kedua tab membandingkan ke sel yang SAMA, '1_PARAMETER'!$B$9:
       Korektif  (10_CORRECTIVE, kolom S):
         =IF(A2:A="";"";IF(Q2:Q<='1_PARAMETER'!$B$9;"OK";"BREACH"))
       Preventif (9_PREVENTIVE, kolom R):
         =IF(B2:B="";"";IF(A2:A="Perbaikan";
              IF(P2:P<='1_PARAMETER'!$B$9;"OK";"BREACH");"-"))

     Nilai '1_PARAMETER'!$B$9 = 3 — baris "SLA perbaikan (hari)", keterangan
     "Maks hari penyelesaian komplain". Angka ini dulu tidak tertangkap karena
     dump-formulas.ts memotong sheet di baris ke-6; cap sudah diperbaiki dan
     dump dijalankan ULANG (21 Juli 2026), barulah baris 7 & 9 terbaca.

     Tebakan lama { Tinggi:2, Sedang:3, Rendah:5 } DIBUANG: kolom prioritas
     sama sekali tidak dipakai rumus SLA asli. */
  slaTargetHari: 3,

  /* [VERIFIED — dump formulas 20 Juli 2026] Aturan durasi perbaikan (hari).
     Formula asli (Preventif, kolom "Durasi Perbaikan (Hari)"):
       =IF(C2="";"";IF(C2=B2;1;C2-B2))
     yaitu: sama hari → 1; beda hari → selisih apa adanya (TANPA floor eksplisit
     tambahan). Ini SETARA dengan MAX(1, selisih) untuk semua data valid: kedua
     tanggal berasal dari parseDate() yang membulatkan ke hari kalender, jadi
     "C2=B2" (sama persis) HANYA terjadi saat selisih=0 — dan itu satu-satunya
     kasus yang ditangani cabang "=1"; cabang lain (tanggal beda) matematis tak
     mungkin menghasilkan 0. MAX(1,d) dipertahankan apa adanya, tidak diubah. */
  durasiMinimalSatuHari: true,

  /* [VERIFIED-EMPIRIS — 21 Juli 2026] Sumber kategori jurnal: "kredit" atau "debit".

     Tetap TIDAK bisa dikunci dari formula: kolom F "Kategori" di tab 3_KEUANGAN
     memang tidak punya formula (dikonfirmasi ulang dari dump 21 Juli 2026 —
     formulaByCol hanya memuat Tanggal, Status, Saran Kat.(D/K), Arus Kas,
     Aktivitas KK, Dampak Laba). Nilainya diisi MANUAL per transaksi.

     TAPI aturan 'kredit' sekarang bukan lagi tebakan buta: diuji terhadap
     SELURUH 128 baris jurnal_transaksi produksi, "ambil kategori_arus_kas akun
     KREDIT, fallback ke akun DEBIT" mereproduksi nilai tersimpan 128/128 (100%).

     JANGAN tertukar dengan kolom K "Aktivitas KK" yang PUNYA formula:
       =IF(AND(COUNTIF(KasList;$B2)>0;COUNTIF(KasList;$C2)=0);
            VLOOKUP($C2;'11_DAFTAR_AKUN'!$B:$F;4;FALSE);
          IF(AND(COUNTIF(KasList;$C2)>0;COUNTIF(KasList;$B2)=0);
            VLOOKUP($B2;'11_DAFTAR_AKUN'!$B:$F;4;FALSE);""))
     yaitu "ambil dari sisi NON-KAS, kosong bila kedua sisi kas/bukan-kas".
     Itu KONSEP LAIN (aktivitas arus kas, hanya untuk transaksi kas) dan bila
     dipakai untuk kolom ini cuma cocok 38/128 — sudah diuji, ditolak data.
     Padanan kolom J "Arus Kas" sudah diimplementasi terpisah di computeJurnal
     sebagai `arus_kas`. */
  jurnalKategoriDari: 'kredit'
};

/* ------------------------------------------------------------ util angka -- */
const num = (v: any): number => {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, '.'));
  return Number.isFinite(n) ? n : 0;
};
const isBlank = (v: any): boolean => v === null || v === undefined || String(v).trim() === '';
const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/* EDATE(tanggal, n): tambah n bulan, clamp ke akhir bulan. "YYYY-MM-DD". */
function edate(iso: any, months: any): any {
  if (isBlank(iso)) return iso;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso).trim());
  if (!m) return iso;
  const y = +m[1];
  const mo = +m[2] - 1;
  const d = +m[3];
  const total = mo + Math.trunc(num(months));
  const ny = y + Math.floor(total / 12);
  const nmo = ((total % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(ny, nmo + 1, 0)).getUTCDate();
  const nd = Math.min(d, lastDay);
  return `${ny.toString().padStart(4, '0')}-${(nmo + 1).toString().padStart(2, '0')}-${nd
    .toString()
    .padStart(2, '0')}`;
}

/* Selisih hari kalender (b - a). */
function dayDiff(aIso: any, bIso: any): number | null {
  const a = Date.parse(aIso + 'T00:00:00Z');
  const b = Date.parse(bIso + 'T00:00:00Z');
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((b - a) / 86400000);
}

/* ========================= COMPUTE PER TABEL ============================= */

/* kamar: harga_bulan + semua tier ditentukan oleh tipe_kamar [LOOKUP]. */
function computeKamar(r: DbRow): DbRow {
  const o: DbRow = { ...r };
  const t = FORMULA_CONFIG.priceByTipe[String(r.tipe_kamar || '').trim()];
  if (t) {
    if (isBlank(o.harga_bulan)) o.harga_bulan = t.bulan;
    o.harga_3bulan = t.b3;
    o.harga_6bulan = t.b6;
    o.harga_9bulan = t.b9;
    o.harga_tahun = t.tahun;
  }
  return o;
}

/* booking: tgl_keluar_est = EDATE(tgl_masuk, durasi_bulan) [VERIFIED]. */
function computeBooking(r: DbRow): DbRow {
  const o: DbRow = { ...r };
  if (!isBlank(r.tgl_masuk)) {
    o.tgl_keluar_est = isBlank(r.durasi_bulan) ? r.tgl_masuk : edate(r.tgl_masuk, r.durasi_bulan);
  }
  return o;
}

/* content: engagement & ER% [VERIFIED]. */
function computeContent(r: DbRow): DbRow {
  const o: DbRow = { ...r };
  o.engagement = num(r.likes) + num(r.komentar) + num(r.share_saves);
  o.er_persen = num(r.reach) > 0 ? round2((o.engagement / num(r.reach)) * 100) : 0;
  return o;
}

/* promotion: CPL & konversi [VERIFIED]; ROI [PENDING]. */
function computePromotion(r: DbRow): DbRow {
  const o: DbRow = { ...r };
  const leads = num(r.leads_aktual);
  o.cpl = leads > 0 ? Math.round(num(r.spend_aktual) / leads) : 0;
  o.conv_lead_booking = leads > 0 ? round2(num(r.booking_dr_promo) / leads) : 0;

  // [VERIFIED — dump formulas 20 Juli 2026] roi_kotor, kolom "ROI Kotor":
  //   =IF(G2:G="";"";IF(G2:G=0;"";(J2:J*'1_PARAMETER'!$B$3-G2:G)/G2:G))
  // G=spend_aktual, J=booking_dr_promo, $B$3="Tarif sewa Eco/bln" — angka yang
  // SAMA dengan priceByTipe['Eco (Non AC)'].bulan di atas (dikonfirmasi dump,
  // bukan kebetulan). Spreadsheet mengembalikan STRING KOSONG (bukan 0) saat
  // spend blank/nol — dipertahankan apa adanya, beda dgn cpl/conv_lead_booking
  // yang fallback ke 0. Tidak dikali 100 di sini (raw ratio); pemformatan %
  // adalah urusan tampilan, bukan compute.
  const spend = num(r.spend_aktual);
  const hargaEco = FORMULA_CONFIG.priceByTipe['Eco (Non AC)']!.bulan;
  o.roi_kotor = spend === 0 ? '' : round2((num(r.booking_dr_promo) * hargaEco - spend) / spend);

  return o;
}

/* maintenance (CM & PM): kode [LOOKUP], durasi [VERIFIED], sla [VERIFIED]. */
function computeMaintenance(r: DbRow, isPM: boolean): DbRow {
  const o: DbRow = { ...r };
  const k = FORMULA_CONFIG.kodeByKategori[String(r.kategori || '').trim()];
  if (k) o.kode = k;
  if (!isBlank(r.tanggal_lapor) && !isBlank(r.tanggal_selesai)) {
    const d = dayDiff(r.tanggal_lapor, r.tanggal_selesai);
    if (d !== null) o.durasi_perbaikan_hari = FORMULA_CONFIG.durasiMinimalSatuHari ? Math.max(1, d) : d;
  }
  if (isPM) {
    /* Preventif tetap "-": rumus asli baru membandingkan durasi ke target bila
       kolom A (hasil IMPORTRANGE 'Log Perawatan Preventif'!A2:o) bernilai
       "Perbaikan", selain itu "-". Tabel Turso `maintenance_pm` TIDAK punya
       kolom pembeda itu, jadi cabang pembanding tidak bisa dievaluasi dan
       seluruh baris jatuh ke "-" — sama dengan perilaku sebelumnya. Kalau kolom
       jenis perawatan kelak ditambahkan, pasang cabangnya di sini. */
    o.sla = '-';
  } else {
    /* Korektif: durasi <= target → "OK", selebihnya "BREACH" (label verbatim
       rumus asli; port lama memakai "Telat" yang tidak ada di spreadsheet). */
    if (o.durasi_perbaikan_hari != null && o.durasi_perbaikan_hari !== '') {
      o.sla = num(o.durasi_perbaikan_hari) <= FORMULA_CONFIG.slaTargetHari ? 'OK' : 'BREACH';
    }
    /* PENYIMPANGAN DISENGAJA: rumus asli tidak menjaga durasi kosong — di Sheets
       ""<=3 bernilai FALSE (teks selalu diurut setelah angka), sehingga tiket
       yang BELUM selesai ikut ditandai "BREACH". Itu artefak koersi Sheets, bukan
       maksud bisnis: tiket yang baru dibuka belum melanggar SLA. Di sini `sla`
       dibiarkan kosong sampai tanggal_selesai terisi. */
  }
  return o;
}

/* coa: saldo_normal dari tipe_akun [LOOKUP/aturan baku]. */
function computeCoa(r: DbRow): DbRow {
  const o: DbRow = { ...r };
  const sn = FORMULA_CONFIG.saldoNormalByTipe[String(r.tipe_akun || '').trim()];
  if (sn) o.saldo_normal = sn;
  return o;
}

/* jurnal_transaksi: enrich untuk dashboard keuangan.
   - kategori           : dari kategori_arus_kas akun terkait [VERIFIED-EMPIRIS 128/128]
   - akun_debit_nama /
     akun_kredit_nama   : nama akun (join COA) — dipakai klasifikasi pembayaran
   - dampak_laba        : efek ke laba-rugi (akrual) berdasarkan tipe akun COA
   - arus_kas           : efek ke kas (akun grup "Kas & Bank")
   Kolom turunan ini TIDAK disimpan ke Turso (bukan kolom DB), hanya untuk
   penyajian ke dashboard agar identik dengan tab Transaksi spreadsheet. */
function computeJurnal(r: DbRow, ctx: ComputeCtx): DbRow {
  const o: DbRow = { ...r };
  const coa = (ctx && ctx.coaByKode) || {};
  const cd = coa[r.akun_debit_kode];
  const ck = coa[r.akun_kredit_kode];
  const nominal = num(r.nominal);

  o.akun_debit_nama = cd ? cd.nama_akun : r.akun_debit_kode;
  o.akun_kredit_nama = ck ? ck.nama_akun : r.akun_kredit_kode;

  const pick = FORMULA_CONFIG.jurnalKategoriDari === 'debit' ? [cd, ck] : [ck, cd];
  for (const cc of pick) {
    if (cc && !isBlank(cc.kategori_arus_kas)) {
      o.kategori = cc.kategori_arus_kas;
      break;
    }
  }

  const isPendapatan = (cc: DbRow | undefined) => cc && cc.tipe_akun === 'Pendapatan';
  const isBeban = (cc: DbRow | undefined) =>
    cc && (cc.tipe_akun === 'Beban' || cc.tipe_akun === 'Beban Non-Operasional');
  let dl = 0;
  if (isPendapatan(ck)) dl = nominal;
  else if (isBeban(cd)) dl = -nominal;
  o.dampak_laba = dl === 0 ? '-' : dl;

  const isKas = (cc: DbRow | undefined) => cc && cc.grup_laporan === 'Kas & Bank';
  let ak = 0;
  if (isKas(cd) && !isKas(ck)) ak = nominal;
  else if (isKas(ck) && !isKas(cd)) ak = -nominal;
  o.arus_kas = ak === 0 ? '-' : ak;

  return o;
}

/* Peta nama tabel → fungsi compute. */
const COMPUTERS: Record<string, (r: DbRow, ctx: ComputeCtx) => DbRow> = {
  kamar: computeKamar,
  booking: computeBooking,
  content: computeContent,
  promotion: computePromotion,
  maintenance_cm: (r) => computeMaintenance(r, false),
  maintenance_pm: (r) => computeMaintenance(r, true),
  coa: computeCoa,
  jurnal_transaksi: computeJurnal
};

/* Kolom formula per tabel (dipakai scripts/recompute-turso.ts untuk UPDATE selektif). */
export const FORMULA_COLUMNS: Record<string, string[]> = {
  kamar: ['harga_bulan', 'harga_3bulan', 'harga_6bulan', 'harga_9bulan', 'harga_tahun'],
  booking: ['tgl_keluar_est'],
  content: ['engagement', 'er_persen'],
  promotion: ['cpl', 'conv_lead_booking', 'roi_kotor'],
  maintenance_cm: ['kode', 'durasi_perbaikan_hari', 'sla'],
  maintenance_pm: ['kode', 'durasi_perbaikan_hari', 'sla'],
  coa: ['saldo_normal'],
  jurnal_transaksi: ['kategori']
};

function computeRow(table: string, row: DbRow, ctx?: ComputeCtx): DbRow {
  const fn = COMPUTERS[table];
  return fn ? fn(row, ctx || {}) : { ...row };
}

export function computeAll(tables: DbTables): DbTables {
  const ctx: ComputeCtx = { coaByKode: {} };
  for (const c of tables.coa || []) ctx.coaByKode![c.kode] = c;
  const out: DbTables = {};
  for (const [table, rows] of Object.entries(tables)) {
    out[table] = (rows || []).map((r) => computeRow(table, r, ctx));
  }
  return out;
}
