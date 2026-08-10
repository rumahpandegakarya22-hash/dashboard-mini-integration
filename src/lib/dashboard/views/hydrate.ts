/* =========================================================================
   Hidrasi data Dashboard — PORT dari `loadLiveData()` public/app.js (Fase 4).

   Mengubah keluaran `/api/dashboard/sheets` (peta judul-tab → array 2D) menjadi
   model tampilan ber-tipe. Deteksi tab & kolom memakai **pencocokan header
   fuzzy** yang sama persis dengan versi lama — itu disengaja: judul tab dan
   label kolom bisa bergeser di spreadsheet, dan detektor longgar inilah yang
   membuat dashboard tidak langsung pecah saat itu terjadi.

   Perbedaan mendasar dari sumber: `loadLiveData()` MEMUTASI variabel global
   (`PENGHUNI`, `LEADS`, …). Di sini semuanya fungsi murni yang MENGEMBALIKAN
   nilai, sehingga bisa dijalankan di Server Component, dites tanpa DOM, dan
   tidak punya urutan-panggil tersembunyi (§3, §7).

   Fallback data sintetis milik app.js (PENGHUNI_RAW, logbookRows(), tiketRows(),
   dst.) TIDAK ikut di-port: itu data demo yang menyamar jadi data nyata saat
   sumber kosong. Perilaku baru: sumber kosong → daftar kosong → empty-state.
   Dicatat sebagai penyimpangan sadar di docs/MIGRASI.md.
   ========================================================================= */

import { parseDate, parseDateTime, fmtDateID, startOfDay } from '../format';
import type { SheetsOut, SheetGrid } from '../source';
import type {
  DashboardData,
  Penghuni,
  LogbookRow,
  PaymentRaw,
  LeadRow,
  SurveyRow,
  BookingRow,
  TiketRow,
  VendorRow,
  KamarRow,
  DokumenRow,
  OccupantRow,
  Retention,
  RoomRow,
  Stats,
  Tempo,
  PembayaranRow,
  Pill
} from './types';

/* ----------------------------------------------------- konstanta (verbatim) */

const PRICE: Record<string, string> = {
  Eco: 'Rp850.000',
  Classic: 'Rp1.200.000',
  Comfy: 'Rp1.600.000'
};

const ROOM_TYPE = (no: number): string =>
  no >= 29 ? 'Comfy' : no >= 17 && no <= 19 ? 'Classic' : 'Eco';

/* ------------------------------------------------- util deteksi (verbatim) */

const pad3 = (n: number): string => String(n).padStart(3, '0');
const num = (s: unknown): number => {
  const n = parseInt(String(s).replace(/[^0-9]/g, ''), 10);
  return isNaN(n) ? 0 : n;
};

/** Cari tab pertama yang headernya memenuhi predikat. */
function findTab(sheets: SheetsOut, pred: (h: string[]) => boolean): SheetGrid | null {
  for (const k of Object.keys(sheets)) {
    const r = sheets[k];
    if (Array.isArray(r) && r.length >= 2) {
      const h = r[0].map((x) => String(x).toLowerCase());
      if (pred(h)) return r;
    }
  }
  return null;
}

const has = (h: string[], s: string): boolean => h.some((x) => x.includes(s));

/** Ubah grid → array objek sesuai peta kolom fuzzy. */
function objs(rows: SheetGrid, colMap: Record<string, string[]>): Record<string, string>[] {
  const h = rows[0].map((x) => String(x).toLowerCase());
  const ix = (names: string[]): number => {
    for (const n of names) {
      const i = h.findIndex((x) => x.includes(n));
      if (i >= 0) return i;
    }
    return -1;
  };
  const ci: Record<string, number> = {};
  for (const k in colMap) ci[k] = ix(colMap[k]);
  const g = (r: any[], i: number) => (i >= 0 && r[i] != null ? String(r[i]).trim() : '');
  return rows.slice(1).map((r) => {
    const o: Record<string, string> = {};
    for (const k in ci) o[k] = g(r, ci[k]);
    return o;
  });
}

/* ------------------------------------------------------------- per-bagian */

export function hydratePenghuni(sheets: SheetsOut): Penghuni[] {
  const key = Object.keys(sheets).find((k) => /penghuni/i.test(k));
  const rows = key ? sheets[key] : null;
  if (!Array.isArray(rows) || rows.length < 2) return [];

  const header = rows[0].map((h) => String(h).toLowerCase());
  const col = (...names: string[]): number => {
    for (const n of names) {
      const i = header.findIndex((h) => h.includes(n));
      if (i >= 0) return i;
    }
    return -1;
  };
  const ci = {
    no: col('no'), id: col('id'), nama: col('nama lengkap', 'nama'), panggil: col('panggil'),
    kamar: col('no kamar', 'kamar'), jenis: col('jenis'), asal: col('asal'), kerja: col('pekerjaan'),
    instansi: col('instansi'), durasi: col('lama tinggal', 'durasi'), masuk: col('tgl masuk', 'masuk'),
    tempo: col('jatuh tempo', 'tempo'), status: col('status'), email: col('email'),
    darurat1: col('nomor darurat 1', 'kontak darurat'), relasi1: col('relasi 1'),
    namaDarurat1: col('nama kontak 1', 'nama kontak'), darurat2: col('nomor darurat 2'),
    relasi2: col('relasi 2'), namaDarurat2: col('nama kontak 2'),
    sisa: col('sisa hari', 'sisa'), flag: col('flag tagih', 'flag'),
    hp: col('no hp penghuni', 'no hp', 'hp penghuni')
  };
  const get = (r: any[], i: number, d: any = '') => (i >= 0 && r[i] != null ? r[i] : d);

  return rows
    .slice(1)
    .filter((r) => get(r, ci.nama))
    .map((r, i) => {
      const kamar = +(String(get(r, ci.kamar, '0')).replace(/[^0-9]/g, '') || 0);
      const sisaRaw = String(get(r, ci.sisa)).replace(/[^0-9-]/g, '');
      return {
        no: ci.no >= 0 ? get(r, ci.no, i + 1) : i + 1,
        id: String(get(r, ci.id)),
        nama: String(get(r, ci.nama)),
        panggil: String(get(r, ci.panggil)),
        kamar,
        jenis: String(get(r, ci.jenis) || ROOM_TYPE(kamar)),
        asal: String(get(r, ci.asal)),
        kerja: String(get(r, ci.kerja)),
        instansi: String(get(r, ci.instansi)),
        durasi: String(get(r, ci.durasi)),
        masuk: String(get(r, ci.masuk)),
        tempo: String(get(r, ci.tempo)),
        status: String(get(r, ci.status)),
        kontak: String(get(r, ci.darurat1)),
        email: String(get(r, ci.email)),
        darurat1: String(get(r, ci.darurat1)),
        relasi1: String(get(r, ci.relasi1)),
        namaDarurat1: String(get(r, ci.namaDarurat1)),
        darurat2: String(get(r, ci.darurat2)),
        relasi2: String(get(r, ci.relasi2)),
        namaDarurat2: String(get(r, ci.namaDarurat2)),
        sisa: sisaRaw === '' ? null : +sisaRaw,
        flag: String(get(r, ci.flag)),
        // No HP Penghuni → tombol WA
        hp: String(get(r, ci.hp) || get(r, ci.darurat1)),
        wa: String(get(r, ci.hp) || get(r, ci.darurat1))
      };
    });
}

export function hydrateLogbook(sheets: SheetsOut): LogbookRow[] {
  const lbKey = Object.keys(sheets).find((k) => /logbook/i.test(k));
  const lbRows = lbKey ? sheets[lbKey] : null;
  if (!Array.isArray(lbRows) || lbRows.length < 2) return [];
  const o = objs(lbRows, {
    tanggal: ['tanggal'],
    name: ['task', 'deskripsi'],
    pic: ['pic', 'petugas'],
    divisi: ['divisi'],
    deadline: ['deadline'],
    logStatus: ['status']
  });
  return o.filter((r) => r.tanggal) as unknown as LogbookRow[];
}

export function hydratePayments(sheets: SheetsOut): PaymentRaw[] {
  const payKey = Object.keys(sheets).find((k) => /payment/i.test(k));
  const payRows = payKey ? sheets[payKey] : null;
  if (!Array.isArray(payRows) || payRows.length < 2) return [];
  const o = objs(payRows, {
    idP: ['id penghuni'], inv: ['no invoice', 'id payment'], awal: ['periode awal'],
    akhir: ['periode akhir'], amount: ['nominal'], tgl: ['tanggal bayar'],
    metode: ['metode'], status: ['status'], notes: ['catatan']
  });
  return o.filter((x) => x.idP || x.inv) as unknown as PaymentRaw[];
}

export function hydrateLeads(sheets: SheetsOut): LeadRow[] {
  const rows = findTab(sheets, (h) => has(h, 'nama leads') && has(h, 'status leads'));
  if (!rows) return [];
  const o = objs(rows, {
    name: ['nama leads'], wa: ['no hp', 'no. hp', 'wa'], asal: ['sumber leads', 'sumber'],
    platform: ['platform'], tanggal: ['tanggal'], status: ['status leads']
  });
  const pill = (s: string): Pill => {
    const t = s.toLowerCase();
    if (t.includes('follow')) return { t: 'Follow Up', c: 's-followup' };
    if (t.includes('survey')) return { t: 'Survey', c: 's-progress' };
    if (t.includes('booking') || t.includes('closing')) return { t: 'Closing', c: 's-complete' };
    return { t: s || 'Baru', c: 's-leads' };
  };
  return o
    .filter((x) => x.name)
    .map((x, i) => ({
      check: false, id: 'LD-' + pad3(i + 1), name: x.name, wa: x.wa,
      asal: x.asal || x.platform, tanggal: x.tanggal, status: pill(x.status)
    }));
}

export function hydrateSurvey(sheets: SheetsOut): SurveyRow[] {
  const rows = findTab(sheets, (h) => has(h, 'tanggal survey') && has(h, 'hasil survey'));
  if (!rows) return [];
  const o = objs(rows, {
    name: ['nama calon', 'nama'], wa: ['no. hp', 'no hp', 'hp'], asal: ['dari mana', 'sumber'],
    pertimbangan: ['keberatan', 'kendala'], hasil: ['hasil survey'], tanggal: ['tanggal survey', 'tanggal']
  });
  return o
    .filter((x) => x.name)
    .map((x) => ({
      check: false, nama: x.name, wa: x.wa, asal: x.asal,
      pertimbangan: x.pertimbangan || x.hasil, tanggal: x.tanggal
    }));
}

export function hydrateBooking(sheets: SheetsOut): BookingRow[] {
  const rows = findTab(
    sheets,
    (h) => has(h, 'status booking') || has(h, 'no. booking') || has(h, 'no booking')
  );
  if (!rows) return [];
  const o = objs(rows, {
    nama: ['nama penyewa', 'nama'], kamar: ['kamar'], status: ['status booking', 'status'],
    durasi: ['durasi'], harga: ['harga'], tanggal: ['tanggal booking', 'tanggal'], cancel: ['alasan cancel']
  });
  return o.filter((x) => x.nama) as unknown as BookingRow[];
}

/** Tiket = Preventive + Corrective. Pembeda: Korektif punya "tanggal kerusakan". */
export function hydrateTiket(sheets: SheetsOut): TiketRow[] {
  const tiketMap = {
    lokasi: ['lokasi / item rusak', 'item rusak', 'lokasi'],
    desk: ['deskripsi kerusakan', 'deskripsi', 'kategori'],
    prioritas: ['prioritas'], biaya: ['biaya'], status: ['status'],
    tgl: ['tanggal lapor', 'tgl lapor', 'tanggal'], idTiket: ['id tiket'],
    durasiHari: ['durasi perbaikan'], tglKerusakan: ['tanggal kerusakan', 'tgl kerusakan'],
    tglLapor: ['tanggal lapor', 'tgl lapor'], tglSelesai: ['tanggal selesai', 'tgl selesai']
  };
  const tpill = (s: string): Pill => {
    const t = s.toLowerCase();
    if (t.includes('selesai') || t.includes('complete')) return { t: 'Complete', c: 's-complete' };
    if (t.includes('proses') || t.includes('progress')) return { t: 'In Progress', c: 's-progress' };
    return { t: s || 'Pending', c: 's-pending' };
  };
  const mapTiket = (rows: SheetGrid, jenis: string): TiketRow[] =>
    objs(rows, tiketMap)
      .filter((x) => x.lokasi || x.desk)
      .map((x, i) => {
        const tK = parseDateTime(x.tglKerusakan);
        const tL = parseDateTime(x.tglLapor || x.tgl);
        const tS = parseDateTime(x.tglSelesai);
        // Response Time (jam) & Resolution Time (hari) dihitung sendiri, bukan dari kolom.
        const _respJam = tK && tL && tL >= tK ? (tL.getTime() - tK.getTime()) / 3600000 : null;
        const _resolHari = tK && tS && tS >= tK ? (tS.getTime() - tK.getTime()) / 86400000 : null;
        return {
          check: false,
          id: x.idTiket || 'TK-' + jenis[0] + pad3(i + 1),
          pekerjaan: x.desk || x.lokasi,
          jenis,
          lokasi: x.lokasi,
          tanggal: x.tglLapor || x.tgl,
          status: tpill(x.status),
          _biaya: num(x.biaya),
          _respJam,
          _resolHari
        };
      });

  const corrTab = findTab(sheets, (h) => has(h, 'item rusak') && has(h, 'tanggal kerusakan'));
  const prevTab = findTab(sheets, (h) => has(h, 'item rusak') && !has(h, 'tanggal kerusakan'));
  let tk: TiketRow[] = [];
  if (prevTab) tk = tk.concat(mapTiket(prevTab, 'Preventif'));
  if (corrTab) tk = tk.concat(mapTiket(corrTab, 'Korektif'));
  return tk;
}

export function hydrateVendor(sheets: SheetsOut): VendorRow[] {
  const rows = findTab(sheets, (h) => has(h, 'nama vendor'));
  if (!rows) return [];
  const o = objs(rows, {
    nama: ['nama vendor'], kategori: ['kategori'], kontak: ['nomor telp', 'telp', 'kontak'], hasil: ['hasil']
  });
  return o
    .filter((x) => x.nama)
    .map((x, i) => ({
      id: 'VD-' + pad3(i + 1), nama: x.nama, kategori: x.kategori,
      kontak: x.kontak, hasil: x.hasil || '-', wa: x.kontak
    }));
}

export function hydrateKamar(sheets: SheetsOut): KamarRow[] {
  const rows = findTab(
    sheets,
    (h) => has(h, 'no kamar') && has(h, 'tipe') && has(h, 'harga') && has(h, 'status')
  );
  if (!rows) return [];
  const o = objs(rows, {
    id: ['id'], kamar: ['no kamar'], nama: ['nama'], tipe: ['tipe'], harga: ['harga'], status: ['status']
  });
  return o
    .filter((x) => String(x.kamar).replace(/[^0-9]/g, ''))
    .map((x) => ({
      id: x.id, kamar: +String(x.kamar).replace(/[^0-9]/g, ''), nama: x.nama,
      tipe: x.tipe, harga: x.harga, status: x.status
    }));
}

export function hydrateDokumen(sheets: SheetsOut): DokumenRow[] {
  const rows = findTab(sheets, (h) => has(h, 'judul') && (has(h, 'role') || has(h, 'link drive')));
  if (!rows) return [];
  const o = objs(rows, {
    id: ['id'], name: ['judul', 'nama'], role: ['role'], kategori: ['kategori'],
    tanggal: ['tanggal'], link: ['link drive', 'link']
  });
  return o
    .filter((x) => x.name)
    .map((x, i) => ({
      id: x.id || 'DOC-' + pad3(i + 1), name: x.name, role: x.role, kategori: x.kategori,
      tanggal: x.tanggal, link: x.link || 'https://drive.google.com/drive/my-drive'
    }));
}

/** Historical Customer → Retention Rate + daftar occupant untuk metrik tempo. */
export function hydrateHistorical(sheets: SheetsOut): {
  occupants: OccupantRow[];
  retention: Retention | null;
} {
  const rows = findTab(
    sheets,
    (h) => has(h, 'nama lengkap') && has(h, 'tanggal masuk') && has(h, 'tanggal keluar')
  );
  if (!rows) return { occupants: [], retention: null };

  const o = objs(rows, {
    id: ['id penghuni'], nama: ['nama lengkap', 'nama'], kamar: ['no kamar'],
    masuk: ['tanggal masuk'], keluar: ['tanggal keluar'], status: ['status huni', 'status']
  });
  const recs = o.filter((x) => x.nama) as unknown as OccupantRow[];

  const hasKeluar = (v: unknown) => {
    const t = String(v || '').trim();
    return !!t && t !== '-';
  };
  const churnedRecs = recs.filter((x) => hasKeluar(x.keluar));
  const total = recs.length;
  const churned = churnedRecs.length;

  // Rata-rata lama tinggal (bln) SEMUA pelanggan: yang sudah keluar = keluar−masuk;
  // yang masih tinggal (belum ada Tgl Keluar) = tanggal sekarang − masuk.
  const MONTH_MS = 2629800000;
  const now = new Date();
  const tenures = recs
    .map((x) => {
      const a = parseDate(x.masuk);
      if (!a) return null;
      const b = hasKeluar(x.keluar) ? parseDate(x.keluar) : now;
      return b ? (b.getTime() - a.getTime()) / MONTH_MS : null;
    })
    .filter((v): v is number => v != null && v >= 0);
  const avgTenure = tenures.length
    ? Math.round(tenures.reduce((s, v) => s + v, 0) / tenures.length)
    : null;

  const retention: Retention | null = total
    ? {
        total,
        churned,
        rate: Math.round(((total - churned) / total) * 100),
        churn: Math.round((churned / total) * 100),
        avgTenure
      }
    : null;

  return { occupants: recs, retention };
}

/* ------------------------------------------- turunan okupansi & tempo ----- */

/** PORT dari `recomputeFromPenghuni()`. Menghasilkan ROOMS + STATS. */
export function computeRoomsAndStats(
  penghuni: Penghuni[],
  kamar: KamarRow[],
  tempo: Tempo | null
): { rooms: RoomRow[]; stats: Stats } {
  const occByRoom: Record<number, Penghuni> = Object.fromEntries(penghuni.map((p) => [p.kamar, p]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const DAY = 86400000;

  // status kamar dinormalkan dari teks sheet KAMAR + data penghuni
  const normRoomStatus = (raw: unknown, occ?: Penghuni): string => {
    const s = String(raw || '').toLowerCase();
    if (/maint|perbaik|rusak/.test(s)) return 'Maintenance';
    if (/booking|dp/.test(s)) return 'Booking';
    if (/kosong|available|tersedia|empty/.test(s)) return 'Kosong';
    if (/isi|terisi|huni|penuh|occupied|aktif|lunas|belum|tunggak|sewa/.test(s)) return 'Terisi';
    if (occ) return /booking/i.test(occ.status || '') ? 'Booking' : 'Terisi';
    return s ? 'Terisi' : 'Kosong';
  };
  const fmtRpHarga = (h: unknown): string => {
    const n = +String(h).replace(/[^0-9]/g, '');
    return n ? 'Rp' + n.toLocaleString('id-ID') : '';
  };

  let rooms: RoomRow[];
  if (kamar && kamar.length) {
    rooms = kamar
      .map((k) => {
        const occ = occByRoom[k.kamar];
        return {
          no: String(k.kamar).padStart(2, '0'),
          _n: +k.kamar,
          jenis: k.tipe || (occ ? occ.jenis : ROOM_TYPE(+k.kamar)),
          penghuni: (occ ? occ.nama : '') || k.nama || '',
          wa: occ ? occ.hp || occ.kontak : '',
          harga: fmtRpHarga(k.harga) || PRICE[k.tipe] || '',
          status: normRoomStatus(k.status, occ)
        };
      })
      .sort((a, b) => a._n - b._n);
  } else {
    rooms = penghuni
      .map((p) => ({
        no: String(p.kamar).padStart(2, '0'),
        _n: +p.kamar,
        jenis: p.jenis,
        penghuni: p.nama,
        wa: p.hp,
        harga: PRICE[p.jenis] || '',
        status: /booking/i.test(p.status || '') ? 'Booking' : 'Terisi'
      }))
      .sort((a, b) => a._n - b._n);
  }

  // Metrik turunan: jatuh tempo pakai Sisa Hari (ambang 7, sesuai PARAMETER)
  let aktif = 0;
  let booking = 0;
  let tunggakan = 0;
  let jatuhTempo = 0;
  penghuni.forEach((p) => {
    if (/booking/i.test(p.status || '')) booking++;
    else aktif++;
    let sisa = p.sisa;
    if (sisa == null) {
      const d = parseDate(p.tempo);
      if (d) sisa = Math.round((d.getTime() - today.getTime()) / DAY);
    }
    if (sisa != null) {
      if (sisa < 0) tunggakan++;
      else if (sisa <= 7) jatuhTempo++;
    }
  });

  let kapasitas: number;
  let occupied: number;
  let kosong: number;
  if (kamar && kamar.length) {
    const cnt = (re: RegExp) => rooms.filter((r) => re.test(r.status)).length;
    kapasitas = kamar.length;
    kosong = cnt(/kosong/i);
    occupied = cnt(/terisi/i) + cnt(/booking/i);
  } else {
    kapasitas = penghuni.length;
    occupied = penghuni.length;
    kosong = 0;
  }

  const stats: Stats = {
    aktif, booking, tunggakan, jatuhTempo, kapasitas, occupied, kosong,
    okupansi: kapasitas ? Math.round((occupied / kapasitas) * 100) : 0
  };

  // Tunggakan/jatuh tempo dari payment.periode_akhir MENANG atas hitungan booking.
  if (tempo) {
    stats.tunggakan = tempo.tunggakan;
    stats.jatuhTempo = tempo.jatuhTempo;
  }
  return { rooms, stats };
}

/**
 * PORT dari `recomputeTempo()`. Tempo berbasis tabel `payment`:
 * MAX(periode_akhir) per id_penghuni dibanding tanggal hari ini.
 * Penghuni aktif TANPA payment tampil sbg "Belum ada data" (blind spot) dan
 * TIDAK dihitung di scorecard — perilaku itu dipertahankan apa adanya.
 */
export function computeTempo(
  payments: PaymentRaw[],
  occupants: OccupantRow[],
  penghuni: Penghuni[]
): { tempo: Tempo | null; pembayaran: PembayaranRow[] } {
  const occById: Record<string, OccupantRow> = {};
  occupants.forEach((oc) => {
    if (oc.id) occById[oc.id] = oc;
  });

  let pembayaran: PembayaranRow[] = [];
  if (payments.length) {
    const payPill = (s: string): Pill => {
      if (/paid|lunas/i.test(s)) return { t: 'Lunas', c: 's-complete' };
      if (/pend|menunggu/i.test(s)) return { t: 'Menunggu', c: 's-pending' };
      return { t: s || 'Tertunda', c: 's-pending' };
    };
    pembayaran = payments
      .map((x) => {
        const nm = x.nama || (occById[x.idP] || ({} as OccupantRow)).nama || '';
        return {
          check: false,
          tanggal: x.tgl || '',
          _t: parseDate(x.tgl),
          idPenghuni: x.idP,
          nama: nm,
          name: nm,
          jenisTx: payPill(x.status),
          namaTx: x.inv || '',
          jumlah: 'Rp' + (parseInt(String(x.amount).replace(/[^0-9]/g, ''), 10) || 0).toLocaleString('id-ID'),
          keterangan: [x.awal, x.akhir].filter(Boolean).map(fmtDateID).join(' s.d. ')
        };
      })
      .sort((a, b) => (b._t ? b._t.getTime() : -1) - (a._t ? a._t.getTime() : -1));
  }

  if (!occupants.length || !payments.length) return { tempo: null, pembayaran };

  const maxAkhir: Record<string, { d: Date; raw: string }> = {};
  payments.forEach((x) => {
    const d = parseDate(x.akhir);
    if (x.idP && d && (!maxAkhir[x.idP] || d > maxAkhir[x.idP].d)) maxAkhir[x.idP] = { d, raw: x.akhir };
  });

  const today = startOfDay(new Date());
  const DAY = 86400000;
  const aktifOcc = occupants.filter(
    (oc) => !String(oc.keluar || '').trim() && !/check-?out/i.test(oc.status || '')
  );
  const waOf = (oc: OccupantRow): string => {
    const p = penghuni.find(
      (p) =>
        String(p.nama).trim().toLowerCase() === String(oc.nama).trim().toLowerCase() ||
        (oc.kamar && String(p.kamar) === String(+String(oc.kamar).replace(/[^0-9]/g, '')))
    );
    return p ? p.hp || p.kontak || '' : '';
  };

  let tunggakan = 0;
  let jatuhTempo = 0;
  const list: Tempo['list'] = [];
  aktifOcc.forEach((oc) => {
    const mx = maxAkhir[oc.id];
    if (!mx) {
      list.push({ name: oc.nama, nama: oc.nama, wa: waOf(oc), tempo: '—', sisa: 'Belum ada data', _s: 9e9 });
      return;
    }
    const s = Math.round((mx.d.getTime() - today.getTime()) / DAY);
    if (s <= 0) tunggakan++;
    else if (s <= 7) jatuhTempo++;
    if (s <= 7) {
      list.push({
        name: oc.nama, nama: oc.nama, wa: waOf(oc), tempo: mx.raw,
        sisa: s < 0 ? 'Telat ' + -s + ' hr' : s === 0 ? 'Hari ini' : s + ' hr lagi',
        _s: s
      });
    }
  });
  list.sort((a, b) => a._s - b._s);

  return { tempo: { list, tunggakan, jatuhTempo }, pembayaran };
}

/* ------------------------------------------------------------- entry point */

/**
 * Hidrasi SEKALI dari keluaran `readComputedSheets()`.
 * Urutan mengikuti `loadLiveData()`: tempo dihitung setelah payments & occupants
 * siap, lalu rooms/stats memakai hasil tempo (tunggakan/jatuh tempo menang).
 */
export function hydrateDashboard(
  sheets: SheetsOut,
  opts?: {
    tursoPayments?: PaymentRaw[];
    transaksi?: import('./types').TransaksiRow[];
    tursoTempo?: import('./types').Tempo | null;
  }
): DashboardData {
  const penghuni = hydratePenghuni(sheets);
  const logbook = hydrateLogbook(sheets);
  // Pakai Turso payments kalau ada (sumber primer), fallback ke Sheets untuk kompatibilitas.
  const payments = opts?.tursoPayments ?? hydratePayments(sheets);
  const leads = hydrateLeads(sheets);
  const survey = hydrateSurvey(sheets);
  const booking = hydrateBooking(sheets);
  const tiket = hydrateTiket(sheets);
  const vendor = hydrateVendor(sheets);
  const kamar = hydrateKamar(sheets);
  const dokumen = hydrateDokumen(sheets);
  const { occupants, retention } = hydrateHistorical(sheets);

  const { tempo: sheetTempo, pembayaran: calcPembayaran } = computeTempo(payments, occupants, penghuni);
  // tursoTempo (dari active_tenant JOIN payment) lebih akurat: occupancy_history bisa kosong
  // untuk penghuni lama yang check-in sebelum trigger ditambahkan.
  const tempo = opts?.tursoTempo ?? sheetTempo;
  const { rooms, stats } = computeRoomsAndStats(penghuni, kamar, tempo);

  // Synthetic rows: tagihan yang belum dibayar (jatuh tempo & tunggakan) ditambahkan ke pembayaran.
  let pembayaran = calcPembayaran;
  if (opts?.tursoTempo?.list?.length) {
    const synRows: PembayaranRow[] = opts.tursoTempo.list
      .filter((e) => e.idPenghuni)
      .map((e) => ({
        check: false,
        tanggal: e.tempo || '',
        _t: parseDate(e.tempo),
        idPenghuni: e.idPenghuni || '',
        nama: e.nama,
        name: e.nama,
        jenisTx: e._s <= 0 ? { t: 'Tunggakan', c: 's-rejected' } : { t: 'Jatuh Tempo', c: 's-pending' },
        namaTx: '',
        jumlah: '',
        keterangan: ''
      }));
    pembayaran = [...synRows, ...calcPembayaran].sort(
      (a, b) => (b._t ? b._t.getTime() : -1) - (a._t ? a._t.getTime() : -1)
    );
  }

  return {
    penghuni, logbook, payments, leads, survey, booking, tiket, vendor, kamar,
    dokumen, occupants, retention, rooms, stats, tempo, pembayaran,
    transaksi: opts?.transaksi ?? []
  };
}
