import type { Client } from '@libsql/client';
import { turso } from '@/lib/core/turso';
import { normalisasiStatus } from '@/lib/core/complain';
import type { Periode } from '../types';
import { tglMentah } from '../format';
import { argTanggal, kondisiTanggal } from '../tanggal';
import { barisAdmin, type BarisKpi } from '../kpi-laporan';
import { hitungKemunculan, perMinggu, type Titik } from '../grafik';
import { ambilKpiLaporan } from './kpi';

export interface FeedbackMentah { tanggal: string; kamar: string | null; kategori: string | null; deskripsi: string; status: string }
export interface PelanggaranRow { tanggal: string; jenis: string; deskripsi: string; pihak: string; tindakan: string }
export interface KecelakaanRow { tanggal: string; lokasi: string; petugas: string; kronologi: string; tindakan: string }

export interface DataKinerjaAdmin {
  periode: Periode;
  dibuat: Date;
  feedback: { total: number; selesai: number; proses: number; kategori: string };
  pelanggaran: { total: number; jenis: string };
  kecelakaan: { total: number; lokasi: string };
  lampiran: { feedback: string[][]; pelanggaran: string[][]; kecelakaan: string[][] };
  /** Data chart laporan: komposisi dan tren mingguan. */
  grafik: {
    statusFeedback: Titik[]; kategoriFeedback: Titik[]; jenisPelanggaran: Titik[]; lokasiKecelakaan: Titik[];
    mingguan: { feedback: Titik[]; pelanggaran: Titik[]; kecelakaan: Titik[] };
  };
  kpi: BarisKpi[];
}

const teksDb = (v: unknown) => (v == null ? '' : String(v));

// Pihak = nama penghuni dan kamarnya dari riwayat hunian, jadi tetap terbaca setelah penghuni check-out.
export async function ambilPelanggaran(periode: Periode, db: Client = turso()): Promise<PelanggaranRow[]> {
  const res = await db.execute({
    sql: `SELECT p.tanggal, p.jenis, p.deskripsi, p.tindakan, o.nama, o.no_kamar
          FROM pelanggaran_peraturan p LEFT JOIN occupancy_history o ON o.id_penghuni = p.id_penghuni
          WHERE ${kondisiTanggal('p.tanggal')} ORDER BY p.tanggal, p.id`,
    args: argTanggal(periode),
  });
  return res.rows.map(r => ({
    tanggal: teksDb(r.tanggal), jenis: teksDb(r.jenis), deskripsi: teksDb(r.deskripsi),
    pihak: r.nama ? `${teksDb(r.nama)} (Kamar ${teksDb(r.no_kamar)})` : '-',
    tindakan: teksDb(r.tindakan) || '-',
  }));
}

export async function ambilKecelakaan(periode: Periode, db: Client = turso()): Promise<KecelakaanRow[]> {
  const res = await db.execute({
    sql: `SELECT tanggal, lokasi, petugas, kronologi, tindakan FROM kecelakaan_kerja
          WHERE ${kondisiTanggal('tanggal')} ORDER BY tanggal, id`,
    args: argTanggal(periode),
  });
  return res.rows.map(r => ({
    tanggal: teksDb(r.tanggal), lokasi: teksDb(r.lokasi), petugas: teksDb(r.petugas),
    kronologi: teksDb(r.kronologi), tindakan: teksDb(r.tindakan) || '-',
  }));
}

// Nilai terbanyak sebagai "Nama (N)"; seri diurut abjad. Kosong -> '-'.
export function teratas(nilai: (string | null | undefined)[]): string {
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
  kpi: BarisKpi[] = [],
): DataKinerjaAdmin {
  const status = feedback.map(f => normalisasiStatus(f.status));
  return {
    periode,
    dibuat,
    feedback: {
      total: feedback.length,
      selesai: status.filter(s => s === 'Selesai').length,
      proses: status.filter(s => s === 'Menunggu' || s === 'Diproses').length,
      kategori: teratas(feedback.map(f => f.kategori)),
    },
    pelanggaran: { total: pelanggaran.length, jenis: teratas(pelanggaran.map(p => p.jenis)) },
    kecelakaan: { total: kecelakaan.length, lokasi: teratas(kecelakaan.map(k => k.lokasi)) },
    lampiran: {
      // Hanya No. Kamar, tanpa nama/telepon penghuni.
      feedback: feedback.map((f, i) => [tglMentah(f.tanggal), f.kamar?.trim() || '-', f.kategori?.trim() || '-', f.deskripsi, status[i]]),
      pelanggaran: pelanggaran.map(p => [tglMentah(p.tanggal), p.jenis, p.deskripsi, p.pihak, p.tindakan]),
      kecelakaan: kecelakaan.map(k => [tglMentah(k.tanggal), k.lokasi, k.petugas, k.kronologi, k.tindakan]),
    },
    grafik: {
      statusFeedback: hitungKemunculan(status),
      kategoriFeedback: hitungKemunculan(feedback.map(f => f.kategori)),
      jenisPelanggaran: hitungKemunculan(pelanggaran.map(p => p.jenis)),
      lokasiKecelakaan: hitungKemunculan(kecelakaan.map(k => k.lokasi)),
      mingguan: {
        feedback: perMinggu(feedback.map(f => ({ tanggal: f.tanggal })), periode),
        pelanggaran: perMinggu(pelanggaran.map(p => ({ tanggal: p.tanggal })), periode),
        kecelakaan: perMinggu(kecelakaan.map(k => ({ tanggal: k.tanggal })), periode),
      },
    },
    kpi,
  };
}

export async function ambilKinerjaAdmin(periode: Periode, dibuat: Date = new Date()): Promise<DataKinerjaAdmin> {
  // Sumber feedback = tenant_complain (ditulis modul Feedback & aplikasi penghuni); tabel `feedback` lama kosong.
  const [res, pelanggaran, kecelakaan, dataKpi] = await Promise.all([
    turso().execute({
      sql: `SELECT substr(c.reported_at, 1, 10) AS tanggal,
                   (SELECT t.no_kamar FROM active_tenant t WHERE t.id_penghuni = c.id_penghuni LIMIT 1) AS no_kamar, c.category, c.description, c.status
            FROM tenant_complain c
            WHERE ${kondisiTanggal('c.reported_at')} ORDER BY c.reported_at, c.id_complain`,
      args: argTanggal(periode),
    }),
    ambilPelanggaran(periode),
    ambilKecelakaan(periode),
    ambilKpiLaporan(periode, dibuat, 'admin_finance'),
  ]);
  const teks = (v: unknown) => (v == null ? null : String(v));
  return susunKinerjaAdmin(
    periode, dibuat,
    res.rows.map(r => ({
      tanggal: String(r.tanggal), kamar: teks(r.no_kamar), kategori: teks(r.category),
      deskripsi: teks(r.description) ?? '', status: teks(r.status) ?? '',
    })),
    pelanggaran, kecelakaan, barisAdmin(dataKpi),
  );
}
