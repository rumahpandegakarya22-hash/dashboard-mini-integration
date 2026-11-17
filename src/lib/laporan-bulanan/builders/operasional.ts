import { turso } from '@/lib/core/turso';
import type { DailyTaskRow, Periode } from '../types';
import { argTanggal, kondisiTanggal } from '../tanggal';
import { barisOps, type BarisKpi } from '../kpi-laporan';
import { ambilKpiLaporan } from './kpi';
import { hitungKemunculan, jumlahPerKunci, perMinggu, type Titik } from '../grafik';

export type SubOperasional = 'Maintenance' | 'Inspeksi' | 'Kebersihan';
type StatusDb = DailyTaskRow['status'];

export interface DataKerjaOperasional {
  periode: Periode;
  dibuat: Date;
  sub: {
    nama: SubOperasional;
    tugas: { tanggal: string; task: string; pic: string; deadline: string | null; status: StatusDb }[];
  }[];
}

export interface BarisPreventif { tgl: string; fasilitas: string; jenis: string; prioritas: string; biaya: number; status: string }
export interface BarisKorektif { tgl: string; lokasi: string; kerusakan: string; prioritas: string; biaya: number; status: string }

export interface DataKinerjaOperasional {
  periode: Periode;
  dibuat: Date;
  inspeksi: { total: number; perluTindakLanjut: number; rows: BarisInspeksi[] };
  preventif: { total: number; selesai: number; belum: number; biaya: number; rows: BarisPreventif[] };
  korektif: { total: number; selesai: number; belum: number; darurat: number; biaya: number; rows: BarisKorektif[] };
  totalBiaya: number;
  grafik: {
    statusPekerjaan: Titik[]; prioritasKorektif: Titik[]; komposisiBiaya: Titik[]; biayaPerLokasi: Titik[]; inspeksiKategori: Titik[];
    mingguan: { inspeksi: Titik[]; preventif: Titik[]; korektif: Titik[] };
  };
  kpi: BarisKpi[];
}

export interface BarisInspeksi { tanggal: string; area: string; kondisi: string; kategori: string; tindakLanjut: string; petugas: string }
export interface InspeksiMentah { tindakLanjut: string | null; tanggal?: string; area?: string | null; kondisi?: string | null; kategori?: string | null; petugas?: string | null }
export interface PreventifMentah { tanggal: string; fasilitas: string; jenis: string; prioritas: string; biaya: number; status: string }
export interface KorektifMentah { tanggal: string; lokasi: string; kerusakan: string; prioritas: string; biaya: number; status: string }

// Nilai daily_tasks.divisi di database -> nama bagian di laporan.
const SUB_DB: [SubOperasional, string][] = [
  ['Maintenance', 'Maintenance'],
  ['Inspeksi', 'Inspeksi'],
  ['Kebersihan', 'Cleaning'],
];

export function susunKerjaOperasional(periode: Periode, dibuat: Date, rowsDb: DailyTaskRow[]): DataKerjaOperasional {
  return {
    periode,
    dibuat,
    sub: SUB_DB.map(([nama, divisiDb]) => ({
      nama,
      tugas: rowsDb
        .filter(r => r.divisi === divisiDb)
        .map(r => ({ tanggal: r.tanggal, task: r.task, pic: r.pic || '-', deadline: r.deadline, status: r.status })),
    })),
  };
}

export async function ambilKerjaOperasional(periode: Periode, dibuat: Date = new Date()): Promise<DataKerjaOperasional> {
  const res = await turso().execute({
    sql: `SELECT id, tanggal, task, pic, divisi, deadline, status FROM daily_tasks
          WHERE divisi IN ('Maintenance', 'Inspeksi', 'Cleaning') AND ${kondisiTanggal('tanggal')} ORDER BY tanggal, id`,
    args: argTanggal(periode),
  });
  return susunKerjaOperasional(periode, dibuat, res.rows.map(r => ({
    id: Number(r.id),
    tanggal: String(r.tanggal),
    task: String(r.task),
    pic: r.pic == null ? null : String(r.pic),
    divisi: String(r.divisi),
    deadline: r.deadline == null ? null : String(r.deadline),
    status: String(r.status) as StatusDb,
  })));
}

const selesai = (s: string) => s.trim().toLowerCase() === 'selesai';
const jumlah = (xs: { biaya: number }[]) => xs.reduce((a, x) => a + x.biaya, 0);

export function susunKinerjaOperasional(
  periode: Periode,
  dibuat: Date,
  inspeksi: InspeksiMentah[],
  preventif: PreventifMentah[],
  korektif: KorektifMentah[],
  kpi: BarisKpi[] = [],
): DataKinerjaOperasional {
  // Isian tindak_lanjut_perlu berupa pilihan bebas dari daftar setting, mis. "Ya, jadwalkan Perawatan".
  const perlu = inspeksi.filter(i => /^ya\b/i.test((i.tindakLanjut ?? '').trim())).length;

  const pSelesai = preventif.filter(p => selesai(p.status)).length;
  const kSelesaiRows = korektif.filter(k => selesai(k.status));

  const bP = jumlah(preventif);
  const bK = jumlah(korektif);
  return {
    periode,
    dibuat,
    inspeksi: {
      total: inspeksi.length, perluTindakLanjut: perlu,
      rows: inspeksi.map(i => ({
        tanggal: i.tanggal ?? '', area: i.area?.trim() || '-', kondisi: i.kondisi?.trim() || '-',
        kategori: i.kategori?.trim() || '-', tindakLanjut: i.tindakLanjut?.trim() || '-', petugas: i.petugas?.trim() || '-',
      })),
    },
    preventif: {
      total: preventif.length, selesai: pSelesai, belum: preventif.length - pSelesai, biaya: bP,
      rows: preventif.map(p => ({ tgl: p.tanggal, fasilitas: p.fasilitas, jenis: p.jenis, prioritas: p.prioritas, biaya: p.biaya, status: p.status })),
    },
    korektif: {
      total: korektif.length, selesai: kSelesaiRows.length, belum: korektif.length - kSelesaiRows.length,
      darurat: korektif.filter(k => k.prioritas.trim().toLowerCase() === 'darurat').length,
      biaya: bK,
      rows: korektif.map(k => ({ tgl: k.tanggal, lokasi: k.lokasi, kerusakan: k.kerusakan, prioritas: k.prioritas, biaya: k.biaya, status: k.status })),
    },
    totalBiaya: bP + bK,
    grafik: {
      statusPekerjaan: [
        { label: 'Selesai', nilai: pSelesai + kSelesaiRows.length },
        { label: 'Proses/Tertunda', nilai: (preventif.length - pSelesai) + (korektif.length - kSelesaiRows.length) },
      ].filter(t => t.nilai > 0),
      prioritasKorektif: hitungKemunculan(korektif.map(k => k.prioritas === '-' ? null : k.prioritas)),
      komposisiBiaya: [{ label: 'Perawatan (preventif)', nilai: bP }, { label: 'Perbaikan (korektif)', nilai: bK }].filter(t => t.nilai > 0),
      biayaPerLokasi: jumlahPerKunci([
        ...korektif.map(k => ({ kunci: k.lokasi, nilai: k.biaya })),
        ...preventif.map(p => ({ kunci: p.fasilitas, nilai: p.biaya })),
      ]),
      inspeksiKategori: hitungKemunculan(inspeksi.map(i => i.kategori)),
      mingguan: {
        inspeksi: perMinggu(inspeksi.map(i => ({ tanggal: i.tanggal ?? '' })), periode),
        preventif: perMinggu(preventif.map(p => ({ tanggal: p.tanggal })), periode),
        korektif: perMinggu(korektif.map(k => ({ tanggal: k.tanggal })), periode),
      },
    },
    kpi,
  };
}

const teks = (v: unknown) => (v == null ? '' : String(v));
const angka = (v: unknown) => Number(v ?? 0) || 0;

export async function ambilKinerjaOperasional(periode: Periode, dibuat: Date = new Date()): Promise<DataKinerjaOperasional> {
  const db = turso();
  const a = argTanggal(periode);
  const [insp, pm, cm, dataKpi] = await Promise.all([
    db.execute({ sql: `SELECT tanggal, area_fasilitas, kondisi_ditemukan, kategori, tindak_lanjut_perlu, petugas FROM inspeksi_fasilitas WHERE ${kondisiTanggal('tanggal')} ORDER BY tanggal, id`, args: a }),
    // maintenance_pm: tanggal_lapor = tanggal jadwal, sumber_laporan = fasilitas, lokasi_item = jenis perawatan.
    db.execute({
      sql: `SELECT tanggal_lapor, sumber_laporan, lokasi_item, prioritas, biaya, status FROM maintenance_pm
            WHERE ${kondisiTanggal('tanggal_lapor')} ORDER BY tanggal_lapor, no_urut`,
      args: a,
    }),
    db.execute({
      sql: `SELECT tanggal_kerusakan, lokasi_item, deskripsi_kerusakan, prioritas, biaya, status FROM maintenance_cm
            WHERE ${kondisiTanggal('tanggal_kerusakan')} ORDER BY tanggal_kerusakan, no_urut`,
      args: a,
    }),
    ambilKpiLaporan(periode, dibuat, 'operasional'),
  ]);
  return susunKinerjaOperasional(
    periode, dibuat,
    insp.rows.map(r => ({
      tindakLanjut: r.tindak_lanjut_perlu == null ? null : String(r.tindak_lanjut_perlu),
      tanggal: teks(r.tanggal).slice(0, 10), area: teks(r.area_fasilitas), kondisi: teks(r.kondisi_ditemukan), kategori: teks(r.kategori), petugas: teks(r.petugas),
    })),
    pm.rows.map(r => ({
      tanggal: teks(r.tanggal_lapor).slice(0, 10), fasilitas: teks(r.sumber_laporan) || '-', jenis: teks(r.lokasi_item) || '-',
      prioritas: teks(r.prioritas) || '-', biaya: angka(r.biaya), status: teks(r.status) || '-',
    })),
    cm.rows.map(r => ({
      tanggal: teks(r.tanggal_kerusakan).slice(0, 10), lokasi: teks(r.lokasi_item) || '-', kerusakan: teks(r.deskripsi_kerusakan) || '-',
      prioritas: teks(r.prioritas) || '-', biaya: angka(r.biaya), status: teks(r.status) || '-',
    })),
    barisOps(dataKpi),
  );
}
