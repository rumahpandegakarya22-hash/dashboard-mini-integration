import { turso } from '@/lib/core/turso';
import { normalisasiStatus } from '@/lib/core/complain';
import type { Periode } from '../types';
import { tglPendek } from '../format';

export interface FeedbackMentah { tanggal: string; kamar: string | null; kategori: string | null; deskripsi: string; status: string }
export interface PelanggaranRow { tanggal: string; jenis: string; deskripsi: string; pihak: string; tindakan: string }
export interface KecelakaanRow { tanggal: string; lokasi: string; petugas: string; kronologi: string; tindakan: string }

export interface DataKinerjaAdmin {
  periode: Periode;
  dibuat: Date;
  feedback: { total: number; selesai: number; proses: number; biaya: number; kategori: string };
  pelanggaran: { total: number; jenis: string };
  kecelakaan: { total: number; lokasi: string };
  lampiran: { feedback: string[][]; pelanggaran: string[][]; kecelakaan: string[][] };
}

// Titik sambung: tabel Pelanggaran/Kecelakaan belum ada. Ganti isi fungsi ini saja; template tidak berubah.
export async function ambilPelanggaran(_periode: Periode): Promise<PelanggaranRow[]> {
  return [];
}
export async function ambilKecelakaan(_periode: Periode): Promise<KecelakaanRow[]> {
  return [];
}

// Nilai terbanyak sebagai "Nama (N)"; seri diurut abjad. Kosong -> '-'.
function teratas(nilai: (string | null | undefined)[]): string {
  const m = new Map<string, number>();
  for (const v of nilai) {
    const k = v?.trim();
    if (k) m.set(k, (m.get(k) ?? 0) + 1);
  }
  const t = [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  return t ? `${t[0]} (${t[1]})` : '-';
}

export function susunKinerjaAdmin(
  periode: Periode,
  dibuat: Date,
  feedback: FeedbackMentah[],
  pelanggaran: PelanggaranRow[],
  kecelakaan: KecelakaanRow[],
): DataKinerjaAdmin {
  const status = feedback.map(f => normalisasiStatus(f.status));
  return {
    periode,
    dibuat,
    // Tidak ada kolom biaya di tenant_complain, jadi biaya penanganan selalu 0.
    feedback: {
      total: feedback.length,
      selesai: status.filter(s => s === 'Selesai').length,
      proses: status.filter(s => s === 'Menunggu' || s === 'Diproses').length,
      biaya: 0,
      kategori: teratas(feedback.map(f => f.kategori)),
    },
    pelanggaran: { total: pelanggaran.length, jenis: teratas(pelanggaran.map(p => p.jenis)) },
    kecelakaan: { total: kecelakaan.length, lokasi: teratas(kecelakaan.map(k => k.lokasi)) },
    lampiran: {
      // Hanya No. Kamar, tanpa nama/telepon penghuni.
      feedback: feedback.map((f, i) => [tglPendek(f.tanggal), f.kamar?.trim() || '-', f.kategori?.trim() || '-', f.deskripsi, status[i]]),
      pelanggaran: pelanggaran.map(p => [tglPendek(p.tanggal), p.jenis, p.deskripsi, p.pihak, p.tindakan]),
      kecelakaan: kecelakaan.map(k => [tglPendek(k.tanggal), k.lokasi, k.petugas, k.kronologi, k.tindakan]),
    },
  };
}

export async function ambilKinerjaAdmin(periode: Periode, dibuat: Date = new Date()): Promise<DataKinerjaAdmin> {
  // Sumber feedback = tenant_complain (ditulis modul Feedback & aplikasi penghuni); tabel `feedback` lama kosong.
  const [res, pelanggaran, kecelakaan] = await Promise.all([
    turso().execute({
      sql: `SELECT substr(c.reported_at, 1, 10) AS tanggal,
                   (SELECT t.no_kamar FROM active_tenant t WHERE t.id_penghuni = c.id_penghuni LIMIT 1) AS no_kamar, c.category, c.description, c.status
            FROM tenant_complain c
            WHERE substr(c.reported_at, 1, 10) BETWEEN ? AND ? ORDER BY c.reported_at, c.id_complain`,
      args: [periode.dari, periode.sampai],
    }),
    ambilPelanggaran(periode),
    ambilKecelakaan(periode),
  ]);
  const teks = (v: unknown) => (v == null ? null : String(v));
  return susunKinerjaAdmin(
    periode, dibuat,
    res.rows.map(r => ({
      tanggal: String(r.tanggal), kamar: teks(r.no_kamar), kategori: teks(r.category),
      deskripsi: teks(r.description) ?? '', status: teks(r.status) ?? '',
    })),
    pelanggaran, kecelakaan,
  );
}
