import type { Client } from '@libsql/client';
import { turso } from '@/lib/core/turso';
import type { Periode } from '../types';
import { argTanggal, kondisiTanggal } from '../tanggal';
import { barisMarketing, type BarisKpi } from '../kpi-laporan';
import { ambilKpiLaporan } from './kpi';
import { hitungKemunculan, jumlahPerKunci, perMinggu, type Titik } from '../grafik';

export interface DataKinerjaMarketing {
  periode: Periode;
  dibuat: Date;
  leads: { total: number; sumberTeratas: string; statusRingkas: string };
  konten: { post: number; reach: number; likes: number; komentar: number; shareSaves: number; platformTeraktif: string };
  kampanye: { jumlah: number; budget: number; spend: number; targetLeads: number; leadsAktual: number; bookingDariPromo: number };
  grafik: {
    sumberLeads: Titik[]; statusLeads: Titik[]; platformKonten: Titik[]; engagementPlatform: Titik[]; spendKampanye: Titik[];
    mingguan: { leads: Titik[]; konten: Titik[] };
  };
  /** Detail data untuk tabel lampiran (tanpa nama atau nomor telepon calon penyewa). */
  rincian: {
    leads: { tanggal: string; sumber: string; platform: string; status: string }[];
    konten: { tanggal: string; platform: string; tipe: string; judul: string; reach: number; likes: number; komentar: number; shareSaves: number }[];
    kampanye: { nama: string; platform: string; mulai: string; selesai: string; budget: number; spend: number; targetLeads: number; leadsAktual: number; booking: number }[];
  };
  kpi: BarisKpi[];
}

export interface LeadMentah { tanggal: string; sumber: string | null; status: string | null; platform?: string | null }
export interface KontenMentah { tanggal: string; platform: string | null; likes: number; komentar: number; shareSaves: number; reach: number; tipe?: string | null; judul?: string | null }
export interface PromoMentah {
  mulai: string; selesai: string | null; budget: number; spend: number; targetLeads: number; leadsAktual: number; booking: number;
  nama?: string | null; platform?: string | null;
}

const dua = (n: string) => n.padStart(2, '0');

// Tabel ini bertipe TEKS: terima YYYY-MM-DD[...] dan d/m/yyyy; selain itu '' (dilewati).
export function tanggalIso(v: string | null | undefined): string {
  const s = (v ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  return m ? `${m[3]}-${dua(m[2])}-${dua(m[1])}` : '';
}

// Dipakai Kinerja Marketing dan Owner agar hitungan leads/konten sama.
export function tanggalDalamPeriode(t: string | null | undefined, dari: string, sampai: string): boolean {
  const i = tanggalIso(t);
  return i >= dari && i <= sampai;
}

// Kampanye beririsan dengan periode; tgl_selesai kosong = masih berjalan.
export function kampanyeBeririsan(mulai: string, selesai: string | null, dari: string, sampai: string): boolean {
  const a = tanggalIso(mulai);
  if (!a) return false;
  const b = tanggalIso(selesai);
  return a <= sampai && (!b || b >= dari);
}

const urut = (m: Map<string, number>) => [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
const tambah = (m: Map<string, number>, k: string | null | undefined) => {
  const v = k?.trim();
  if (v) m.set(v, (m.get(v) ?? 0) + 1);
};

export function susunMarketing(periode: Periode, dibuat: Date, leads: LeadMentah[], konten: KontenMentah[], promo: PromoMentah[], kpi: BarisKpi[] = []): DataKinerjaMarketing {
  const dalam = (t: string) => tanggalDalamPeriode(t, periode.dari, periode.sampai);

  const L = leads.filter(l => dalam(l.tanggal));
  const sumber = new Map<string, number>();
  const status = new Map<string, number>();
  for (const l of L) { tambah(sumber, l.sumber); tambah(status, l.status); }
  const teratas = urut(sumber)[0];

  const K = konten.filter(k => dalam(k.tanggal));
  const platform = new Map<string, number>();
  let likes = 0, komentar = 0, shareSaves = 0, reach = 0;
  for (const k of K) {
    tambah(platform, k.platform);
    likes += k.likes; komentar += k.komentar; shareSaves += k.shareSaves; reach += k.reach;
  }
  const aktif = urut(platform)[0];

  const P = promo.filter(p => kampanyeBeririsan(p.mulai, p.selesai, periode.dari, periode.sampai));
  const jml = (f: (p: PromoMentah) => number) => P.reduce((s, p) => s + f(p), 0);

  return {
    periode, dibuat,
    leads: {
      total: L.length,
      sumberTeratas: teratas ? `${teratas[0]} (${teratas[1]})` : '-',
      statusRingkas: status.size ? urut(status).map(([k, n]) => `${k} (${n})`).join(', ') : '-',
    },
    konten: { post: K.length, reach, likes, komentar, shareSaves, platformTeraktif: aktif ? `${aktif[0]} (${aktif[1]})` : '-' },
    kampanye: {
      jumlah: P.length, budget: jml(p => p.budget), spend: jml(p => p.spend),
      targetLeads: jml(p => p.targetLeads), leadsAktual: jml(p => p.leadsAktual),
      bookingDariPromo: jml(p => p.booking),
    },
    grafik: {
      sumberLeads: hitungKemunculan(L.map(l => l.sumber)),
      statusLeads: hitungKemunculan(L.map(l => l.status)),
      platformKonten: hitungKemunculan(K.map(k => k.platform)),
      engagementPlatform: jumlahPerKunci(K.map(k => ({ kunci: k.platform, nilai: k.likes + k.komentar + k.shareSaves }))),
      spendKampanye: jumlahPerKunci(P.map(p => ({ kunci: p.nama || p.platform || 'Kampanye', nilai: p.spend }))),
      mingguan: {
        leads: perMinggu(L.map(l => ({ tanggal: tanggalIso(l.tanggal) })), periode),
        konten: perMinggu(K.map(k => ({ tanggal: tanggalIso(k.tanggal) })), periode),
      },
    },
    rincian: {
      leads: L.map(l => ({ tanggal: tanggalIso(l.tanggal), sumber: l.sumber?.trim() || '-', platform: l.platform?.trim() || '-', status: l.status?.trim() || '-' })),
      konten: K.map(k => ({
        tanggal: tanggalIso(k.tanggal), platform: k.platform?.trim() || '-', tipe: k.tipe?.trim() || '-', judul: k.judul?.trim() || '-',
        reach: k.reach, likes: k.likes, komentar: k.komentar, shareSaves: k.shareSaves,
      })),
      kampanye: P.map(p => ({
        nama: p.nama?.trim() || '-', platform: p.platform?.trim() || '-', mulai: tanggalIso(p.mulai), selesai: tanggalIso(p.selesai),
        budget: p.budget, spend: p.spend, targetLeads: p.targetLeads, leadsAktual: p.leadsAktual, booking: p.booking,
      })),
    },
    kpi,
  };
}

/** `kpi` hanya diisi pengujian; biasanya dihitung dari database. */
export async function ambilKinerjaMarketing(periode: Periode, dibuat: Date = new Date(), db: Client = turso(), kpi?: BarisKpi[]): Promise<DataKinerjaMarketing> {
  // Saring periode di SQL (hanya baris yang relevan yang dikirim); susunMarketing menyaring lagi sebagai pengaman.
  const a = argTanggal(periode);
  const [leads, konten, promo, barisKpi] = await Promise.all([
    db.execute({ sql: `SELECT tanggal, sumber_leads, status_leads, platform FROM leads WHERE ${kondisiTanggal('tanggal')}`, args: a }),
    db.execute({ sql: `SELECT tgl_post, platform, tipe_konten, judul_caption, likes, komentar, share_saves, reach FROM content WHERE ${kondisiTanggal('tgl_post')}`, args: a }),
    // Kampanye beririsan dengan periode: mulai sebelum hari-setelah-sampai dan (belum selesai atau selesai >= dari).
    db.execute({
      sql: `SELECT nama_promosi, platform, tgl_mulai, tgl_selesai, budget, spend_aktual, target_leads, leads_aktual, booking_dr_promo FROM promotion
            WHERE tgl_mulai < ? AND (tgl_selesai IS NULL OR tgl_selesai = '' OR tgl_selesai >= ?)`,
      args: [a[1], periode.dari],
    }),
    kpi ?? ambilKpiLaporan(periode, dibuat, 'marketing').then(barisMarketing),
  ]);
  const teks = (v: unknown) => (v == null ? null : String(v));
  const angka = (v: unknown) => Number(v ?? 0) || 0;
  return susunMarketing(
    periode, dibuat,
    leads.rows.map(r => ({ tanggal: teks(r.tanggal) ?? '', sumber: teks(r.sumber_leads), status: teks(r.status_leads), platform: teks(r.platform) })),
    konten.rows.map(r => ({
      tanggal: teks(r.tgl_post) ?? '', platform: teks(r.platform), tipe: teks(r.tipe_konten), judul: teks(r.judul_caption),
      likes: angka(r.likes), komentar: angka(r.komentar), shareSaves: angka(r.share_saves), reach: angka(r.reach),
    })),
    promo.rows.map(r => ({
      mulai: teks(r.tgl_mulai) ?? '', selesai: teks(r.tgl_selesai), budget: angka(r.budget), spend: angka(r.spend_aktual), nama: teks(r.nama_promosi), platform: teks(r.platform),
      targetLeads: angka(r.target_leads), leadsAktual: angka(r.leads_aktual), booking: angka(r.booking_dr_promo),
    })),
    barisKpi,
  );
}
