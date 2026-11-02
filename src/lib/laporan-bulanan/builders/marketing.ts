import { turso } from '@/lib/core/turso';
import type { Periode } from '../types';

export interface DataKinerjaMarketing {
  periode: Periode;
  dibuat: Date;
  leads: { total: number; sumberTeratas: string; statusRingkas: string };
  konten: { post: number; reach: number; likes: number; komentar: number; shareSaves: number; engagementPersen: number; platformTeraktif: string };
  kampanye: { jumlah: number; budget: number; spend: number; targetLeads: number; leadsAktual: number; capaianPersen: number; bookingDariPromo: number };
}

export interface LeadMentah { tanggal: string; sumber: string | null; status: string | null }
export interface KontenMentah { tanggal: string; platform: string | null; likes: number; komentar: number; shareSaves: number; reach: number }
export interface PromoMentah {
  mulai: string; selesai: string | null; budget: number; spend: number; targetLeads: number; leadsAktual: number; booking: number;
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

export function susunMarketing(periode: Periode, dibuat: Date, leads: LeadMentah[], konten: KontenMentah[], promo: PromoMentah[]): DataKinerjaMarketing {
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
  // Sama dengan content.er_persen: (likes+komentar+share_saves) * 100 / reach, di sini dari total bulan.
  const er = reach > 0 ? Math.round(((likes + komentar + shareSaves) * 1000) / reach) / 10 : 0;

  const P = promo.filter(p => kampanyeBeririsan(p.mulai, p.selesai, periode.dari, periode.sampai));
  const jml = (f: (p: PromoMentah) => number) => P.reduce((s, p) => s + f(p), 0);
  const targetLeads = jml(p => p.targetLeads);
  const leadsAktual = jml(p => p.leadsAktual);

  return {
    periode, dibuat,
    leads: {
      total: L.length,
      sumberTeratas: teratas ? `${teratas[0]} (${teratas[1]})` : '-',
      statusRingkas: status.size ? urut(status).map(([k, n]) => `${k} (${n})`).join(', ') : '-',
    },
    konten: { post: K.length, reach, likes, komentar, shareSaves, engagementPersen: er, platformTeraktif: aktif ? `${aktif[0]} (${aktif[1]})` : '-' },
    kampanye: {
      jumlah: P.length, budget: jml(p => p.budget), spend: jml(p => p.spend), targetLeads, leadsAktual,
      capaianPersen: targetLeads > 0 ? Math.round((leadsAktual * 100) / targetLeads) : 0,
      bookingDariPromo: jml(p => p.booking),
    },
  };
}

export async function ambilKinerjaMarketing(periode: Periode, dibuat: Date = new Date()): Promise<DataKinerjaMarketing> {
  const db = turso();
  // Tanggal bertipe teks bisa non-ISO, jadi saring di susunMarketing, bukan di SQL.
  const [leads, konten, promo] = await Promise.all([
    db.execute('SELECT tanggal, sumber_leads, status_leads FROM leads'),
    db.execute('SELECT tgl_post, platform, likes, komentar, share_saves, reach FROM content'),
    db.execute('SELECT tgl_mulai, tgl_selesai, budget, spend_aktual, target_leads, leads_aktual, booking_dr_promo FROM promotion'),
  ]);
  const teks = (v: unknown) => (v == null ? null : String(v));
  const angka = (v: unknown) => Number(v ?? 0) || 0;
  return susunMarketing(
    periode, dibuat,
    leads.rows.map(r => ({ tanggal: teks(r.tanggal) ?? '', sumber: teks(r.sumber_leads), status: teks(r.status_leads) })),
    konten.rows.map(r => ({
      tanggal: teks(r.tgl_post) ?? '', platform: teks(r.platform),
      likes: angka(r.likes), komentar: angka(r.komentar), shareSaves: angka(r.share_saves), reach: angka(r.reach),
    })),
    promo.rows.map(r => ({
      mulai: teks(r.tgl_mulai) ?? '', selesai: teks(r.tgl_selesai), budget: angka(r.budget), spend: angka(r.spend_aktual),
      targetLeads: angka(r.target_leads), leadsAktual: angka(r.leads_aktual), booking: angka(r.booking_dr_promo),
    })),
  );
}
