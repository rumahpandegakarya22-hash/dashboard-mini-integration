/* =========================================================================
   Hitungan KPI Dashboard (murni, tanpa database) — dipakai kpi.ts dan dites
   di kpi-calc.test.ts. Semua fungsi mengembalikan null bila datanya belum cukup
   (dashboard menampilkan "—", bukan 0 yang menyesatkan).

   Tanggal berformat 'YYYY-MM-DD' atau 'YYYY-MM-DD HH:MM' (WIB tanpa zona).
   ========================================================================= */

import { selisihMenit } from '../core/validate';

export type Range = { from: Date | null; to: Date | null };

const DAY = 86400000;

/** Date lokal dari bagian tanggal 'YYYY-MM-DD...'; null bila tidak valid. */
export function tgl(s: unknown): Date | null {
  const m = String(s ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function dalamRentang(s: unknown, r: Range): boolean {
  const d = tgl(s);
  if (!d) return false;
  if (r.from && d < r.from) return false;
  if (r.to && d > r.to) return false;
  return true;
}

const selisihHari = (a: Date, b: Date): number => Math.round((b.getTime() - a.getTime()) / DAY);
const pct = (a: number, b: number): number | null => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);
const rata = (xs: number[]): number | null => (xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : null);

/* ------------------------------------------------------------ keuangan ---- */

export interface Invoice {
  idPenghuni: string;
  awal: string;
  akhir: string;
  bayar: string | null;
  total: number;
  bulan: number;
}

/** Siklus jatuh tempo = invoice yang periode_akhir-nya jatuh di rentang dan sudah lewat hari ini. */
function siklusJatuhTempo(inv: Invoice[], r: Range, hariIni: Date): Invoice[] {
  return inv.filter((i) => dalamRentang(i.akhir, r) && (tgl(i.akhir) as Date) <= hariIni);
}

const adaLanjutan = (i: Invoice, semua: Invoice[]): Invoice | undefined =>
  semua.find((n) => n !== i && n.idPenghuni === i.idPenghuni && n.awal >= i.akhir.slice(0, 10) && n.bayar);

/** Collection rate: siklus jatuh tempo milik penghuni AKTIF yang pembayaran lanjutannya masuk paling lambat saat jatuh tempo. */
export function collectionRate(inv: Invoice[], aktif: Set<string>, r: Range, hariIni: Date): number | null {
  const due = siklusJatuhTempo(inv, r, hariIni).filter((i) => aktif.has(i.idPenghuni));
  const tepat = due.filter((i) => {
    const n = adaLanjutan(i, inv);
    return n && String(n.bayar).slice(0, 10) <= i.akhir.slice(0, 10);
  });
  return pct(tepat.length, due.length);
}

/** Renewal rate: siklus jatuh tempo (termasuk yang sudah keluar) yang akhirnya diperpanjang. */
export function renewalRate(inv: Invoice[], r: Range, hariIni: Date): number | null {
  const due = siklusJatuhTempo(inv, r, hariIni);
  return pct(due.filter((i) => adaLanjutan(i, inv)).length, due.length);
}

export interface Aging {
  hari1_7: number;
  hari8_14: number;
  hari15_30: number;
  lebih30: number;
  total: number;
  /** Estimasi nominal: satu tagihan bulanan terakhir per penghuni yang menunggak. */
  nominal: number;
}

/** Tunggakan = penghuni aktif yang masa sewa terakhirnya sudah berakhir (hari ini ikut dihitung, masuk 1-7). */
export function agingTunggakan(inv: Invoice[], aktif: Set<string>, hariIni: Date): Aging {
  const akhirTerakhir = new Map<string, Invoice>();
  for (const i of inv) {
    if (!aktif.has(i.idPenghuni)) continue;
    const cur = akhirTerakhir.get(i.idPenghuni);
    if (!cur || i.akhir > cur.akhir) akhirTerakhir.set(i.idPenghuni, i);
  }
  const a: Aging = { hari1_7: 0, hari8_14: 0, hari15_30: 0, lebih30: 0, total: 0, nominal: 0 };
  for (const i of akhirTerakhir.values()) {
    const akhir = tgl(i.akhir);
    if (!akhir) continue;
    const telat = selisihHari(akhir, hariIni);
    if (telat < 0) continue;
    if (telat <= 7) a.hari1_7++;
    else if (telat <= 14) a.hari8_14++;
    else if (telat <= 30) a.hari15_30++;
    else a.lebih30++;
    a.total++;
    a.nominal += i.bulan > 0 ? Math.round(i.total / i.bulan) : i.total;
  }
  return a;
}

/** Hari kerja (Senin-Jumat) setelah akhir bulan `periode` ('YYYY-MM') sampai `dibuat`; 0 bila dibuat di bulan yang sama. */
export function hariKerjaSetelahAkhirBulan(periode: string, dibuat: string): number | null {
  const m = periode.match(/^(\d{4})-(\d{2})$/);
  const d = tgl(dibuat);
  if (!m || !d) return null;
  const akhirBulan = new Date(Number(m[1]), Number(m[2]), 0);
  if (d <= akhirBulan) return 0;
  let n = 0;
  for (let c = new Date(akhirBulan.getTime() + DAY); c <= d; c = new Date(c.getTime() + DAY)) {
    const w = c.getDay();
    if (w !== 0 && w !== 6) n++;
  }
  return n;
}

/** RevPAR = pendapatan sewa / (kamar tersedia x hari periode). */
export function revpar(pendapatanSewa: number, kamar: number, hari: number): number | null {
  return kamar > 0 && hari > 0 ? Math.round(pendapatanSewa / (kamar * hari)) : null;
}

/* --------------------------------------------------------------- sales ---- */

export interface Hunian {
  kamar: string;
  mulai: string;
  selesai: string | null;
}

/** Rata-rata hari kosong: jeda antara penghuni keluar dan penghuni berikutnya di kamar yang sama (mulai jatuh di rentang). */
export function rataVacancyHari(h: Hunian[], r: Range): number | null {
  const perKamar = new Map<string, Hunian[]>();
  for (const x of h) perKamar.set(x.kamar, [...(perKamar.get(x.kamar) ?? []), x]);
  const jeda: number[] = [];
  for (const list of perKamar.values()) {
    list.sort((a, b) => a.mulai.localeCompare(b.mulai));
    for (let i = 1; i < list.length; i++) {
      const prev = tgl(list[i - 1].selesai);
      const next = tgl(list[i].mulai);
      if (!prev || !next || next < prev || !dalamRentang(list[i].mulai, r)) continue;
      jeda.push(selisihHari(prev, next));
    }
  }
  return rata(jeda);
}

export function rataResponsLeadsMenit(leads: { masuk: string | null; chat: string | null }[]): number | null {
  const m = leads.map((l) => selisihMenit(l.masuk, l.chat)).filter((v): v is number => v != null);
  return rata(m);
}

/** Konversi survey -> booking = booking baru / survey pada rentang yang sama. */
export function konversiSurveyBooking(survey: number, booking: number): number | null {
  return pct(booking, survey);
}

/* ----------------------------------------------------------- marketing ---- */

export function cplRata(promosi: { spend: number; leads: number }[]): number | null {
  const spend = promosi.reduce((s, p) => s + p.spend, 0);
  const leads = promosi.reduce((s, p) => s + p.leads, 0);
  return leads > 0 ? Math.round(spend / leads) : null;
}

/** CAC = (spend promosi + biaya produksi konten) / booking baru. */
export function cac(spendPromosi: number, biayaKonten: number, bookingBaru: number): number | null {
  return bookingBaru > 0 ? Math.round((spendPromosi + biayaKonten) / bookingBaru) : null;
}

export function pencapaianTargetLeads(promosi: { leads: number; target: number }[]): number | null {
  const ada = promosi.filter((p) => p.target > 0);
  return pct(
    ada.reduce((s, p) => s + p.leads, 0),
    ada.reduce((s, p) => s + p.target, 0)
  );
}

/** Engagement rate = (likes + komentar + share) / reach, dijumlahkan seluruh konten bereach > 0. */
export function engagementRate(konten: { likes: number; komentar: number; share: number; reach: number }[]): number | null {
  const ada = konten.filter((k) => k.reach > 0);
  return pct(
    ada.reduce((s, k) => s + k.likes + k.komentar + k.share, 0),
    ada.reduce((s, k) => s + k.reach, 0)
  );
}

/** Konsistensi posting = konten Posted / (Posted + Terjadwal yang tanggalnya sudah lewat). Draft/Ready/Cancel tidak dihitung. */
export function konsistensiPosting(konten: { status: string; tanggal: string }[], hariIni: Date): number | null {
  const posted = konten.filter((k) => /^posted$/i.test(k.status)).length;
  const lewat = konten.filter((k) => /^terjadwal$/i.test(k.status) && (tgl(k.tanggal) as Date) < hariIni).length;
  return pct(posted, posted + lewat);
}

/* ---------------------------------------------------------- operasional ---- */

/**
 * Kepatuhan SLA = tiket "OK" / (OK + "BREACH"), memakai kolom `sla` yang sudah dihitung compute.ts
 * (target 3 hari). Tiket yang belum selesai belum punya nilai SLA dan tidak dihitung.
 */
export function slaPatuh(tiket: { sla: unknown }[]): number | null {
  const ok = tiket.filter((t) => t.sla === 'OK').length;
  const breach = tiket.filter((t) => t.sla === 'BREACH').length;
  return pct(ok, ok + breach);
}

/** Jumlah hari dalam rentang, dipotong sampai hari ini; minimal 1. Rentang terbuka dianggap 30 hari. */
export function hariPeriode(r: Range, hariIni: Date): number {
  if (!r.from) return 30;
  const akhir = r.to && r.to < hariIni ? r.to : hariIni;
  return Math.max(1, selisihHari(r.from, akhir) + 1);
}

/** Jumlah kasus berulang = pasangan (lokasi, kategori) yang muncul >= 2 kali. */
export function tiketBerulang(tiket: { lokasi: string; kategori: string }[]): number {
  const n = new Map<string, number>();
  for (const t of tiket) {
    const k = `${t.lokasi.trim().toLowerCase()}|${t.kategori.trim().toLowerCase()}`;
    n.set(k, (n.get(k) ?? 0) + 1);
  }
  return [...n.values()].filter((v) => v >= 2).length;
}

/** Kepatuhan jadwal preventif = dijadwalkan yang sudah selesai / dijadwalkan yang tanggalnya sudah lewat. */
export function kepatuhanPreventif(pm: { jadwal: string; selesai: string | null }[], hariIni: Date): number | null {
  const lewat = pm.filter((p) => {
    const d = tgl(p.jadwal);
    return d && d <= hariIni;
  });
  return pct(lewat.filter((p) => tgl(p.selesai)).length, lewat.length);
}

/** Kepatuhan inspeksi = hari yang punya minimal satu inspeksi / jumlah hari dalam rentang (sampai hari ini). */
export function kepatuhanInspeksi(tanggalInspeksi: string[], r: Range, hariIni: Date): number | null {
  if (!r.from) return null;
  const akhir = r.to && r.to < hariIni ? r.to : hariIni;
  const hari = selisihHari(r.from, akhir) + 1;
  if (hari <= 0) return null;
  const unik = new Set(tanggalInspeksi.filter((t) => dalamRentang(t, { from: r.from, to: akhir })).map((t) => t.slice(0, 10)));
  return pct(unik.size, hari);
}

/** Rata-rata hari dari checkout sampai kamar siap sewa. */
export function rataKamarSiapHari(rows: { checkout: string; siap: string | null }[]): number | null {
  return rata(
    rows
      .filter((r) => tgl(r.checkout) && tgl(r.siap))
      .map((r) => selisihHari(tgl(r.checkout) as Date, tgl(r.siap) as Date))
      .filter((v) => v >= 0)
  );
}

/* -------------------------------------------------------------- umum ---- */

export function rataSkorCsat(skor: number[]): number | null {
  const r = rata(skor);
  return r == null ? null : Math.round(r * 10) / 10;
}

/** Kelengkapan dokumen = penghuni aktif yang memiliki SEMUA jenis dokumen wajib / penghuni aktif. */
export function kelengkapanDokumen(
  aktif: string[],
  dokumen: { idPenghuni: string; jenis: string }[],
  wajib: string[]
): number | null {
  if (!wajib.length) return null;
  const punya = new Map<string, Set<string>>();
  for (const d of dokumen) punya.set(d.idPenghuni, (punya.get(d.idPenghuni) ?? new Set()).add(d.jenis));
  return pct(aktif.filter((id) => wajib.every((w) => punya.get(id)?.has(w))).length, aktif.length);
}

/** Rata-rata jam dari pengaduan masuk sampai ditanggapi. */
export function rataResponsPengaduanJam(rows: { masuk: string | null; respons: string | null }[]): number | null {
  const m = rows.map((r) => selisihMenit(r.masuk, r.respons)).filter((v): v is number => v != null);
  const r = rata(m);
  return r == null ? null : Math.round((r / 60) * 10) / 10;
}
