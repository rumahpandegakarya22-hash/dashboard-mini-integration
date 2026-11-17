import { turso } from '@/lib/core/turso';
import type { Periode } from '../types';
import { argTanggal, kondisiTanggal } from '../tanggal';
import { barisSales, type BarisKpi } from '../kpi-laporan';
import { ambilKpiLaporan } from './kpi';
import { hitungKemunculan, jumlahPerKunci, perMinggu, type Titik } from '../grafik';

export interface DataKinerjaSales {
  periode: Periode;
  dibuat: Date;
  checkIn: number; konfirmasi: number; batal: number; nilaiBooking: number; sumberTeratas: string;
  booking: { tanggal: string; nama: string; kamar: string; status: string; harga: number; sumber: string }[];
  grafik: {
    statusBooking: Titik[]; sumber: Titik[]; nilaiPerSumber: Titik[]; nilaiPerKamar: Titik[]; funnel: Titik[]; mingguan: Titik[];
    /** Rekap per sumber leads (booking non-batal). */
    rekapSumber: { sumber: string; jumlah: number; nilai: number }[];
  };
  kpi: BarisKpi[];
}

export interface BookingMentah {
  tanggal: string; nama: string; kamar: number | string | null; status: string | null; harga: number; sumber: string | null;
}

// Nilai nyata (dropdown settings LOG_SALES "Status Booking"): Pending, Konfirmasi, Check-In, Check-Out, Dibatalkan.
// Check-Out dihitung sebagai check-in karena booking itu memang sudah check-in. Pending/lainnya = 'lain'.
export function klasifikasiBooking(status: string | null | undefined): 'checkIn' | 'konfirmasi' | 'batal' | 'lain' {
  const s = (status ?? '').toLowerCase();
  if (s.includes('batal') || s.includes('cancel')) return 'batal';
  if (s.startsWith('check')) return 'checkIn';
  if (s.includes('konfirmasi')) return 'konfirmasi';
  return 'lain';
}

export function susunSales(periode: Periode, dibuat: Date, booking: BookingMentah[], kpi: BarisKpi[] = [], funnel: { leads: number; survey: number } = { leads: 0, survey: 0 }): DataKinerjaSales {
  const hitung = { checkIn: 0, konfirmasi: 0, batal: 0, lain: 0 };
  const sumber = new Map<string, number>();
  let nilaiBooking = 0;
  const baris = booking.map(b => {
    const jenis = klasifikasiBooking(b.status);
    hitung[jenis]++;
    if (jenis !== 'batal') nilaiBooking += b.harga;
    const asal = b.sumber?.trim();
    if (asal) sumber.set(asal, (sumber.get(asal) ?? 0) + 1);
    const status = b.status?.trim() || '-';
    return { tanggal: b.tanggal, nama: b.nama, kamar: b.kamar == null || b.kamar === '' ? '-' : String(b.kamar), status, harga: b.harga, sumber: asal || '-' };
  });
  const teratas = [...sumber].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  return {
    periode, dibuat,
    checkIn: hitung.checkIn, konfirmasi: hitung.konfirmasi, batal: hitung.batal,
    nilaiBooking,
    sumberTeratas: teratas ? `${teratas[0]} (${teratas[1]})` : '-',
    booking: baris,
    grafik: susunGrafikSales(periode, baris, hitung, funnel),
    kpi,
  };
}

function susunGrafikSales(
  periode: Periode,
  baris: DataKinerjaSales['booking'],
  hitung: { checkIn: number; konfirmasi: number; batal: number; lain: number },
  funnel: { leads: number; survey: number },
): DataKinerjaSales['grafik'] {
  const aktif = baris.filter(b => klasifikasiBooking(b.status) !== 'batal');
  const rekap = new Map<string, { jumlah: number; nilai: number }>();
  for (const b of aktif) {
    const k = b.sumber === '-' ? 'Tanpa sumber' : b.sumber;
    const cur = rekap.get(k) ?? { jumlah: 0, nilai: 0 };
    rekap.set(k, { jumlah: cur.jumlah + 1, nilai: cur.nilai + b.harga });
  }
  return {
    statusBooking: [
      { label: 'Check-in', nilai: hitung.checkIn }, { label: 'Konfirmasi', nilai: hitung.konfirmasi },
      { label: 'Dibatalkan', nilai: hitung.batal }, { label: 'Pending/lain', nilai: hitung.lain },
    ].filter(t => t.nilai > 0),
    sumber: hitungKemunculan(baris.map(b => (b.sumber === '-' ? null : b.sumber))),
    nilaiPerSumber: jumlahPerKunci(aktif.map(b => ({ kunci: b.sumber === '-' ? 'Tanpa sumber' : b.sumber, nilai: b.harga }))),
    nilaiPerKamar: jumlahPerKunci(aktif.filter(b => b.kamar !== '-').map(b => ({ kunci: `Kamar ${b.kamar}`, nilai: b.harga }))),
    funnel: [
      { label: 'Leads', nilai: funnel.leads }, { label: 'Survey', nilai: funnel.survey }, { label: 'Booking', nilai: aktif.length },
    ],
    mingguan: perMinggu(baris.map(b => ({ tanggal: b.tanggal })), periode),
    rekapSumber: [...rekap].map(([sumber, v]) => ({ sumber, ...v })).sort((a, b) => b.jumlah - a.jumlah || a.sumber.localeCompare(b.sumber)),
  };
}

export async function ambilKinerjaSales(periode: Periode, dibuat: Date = new Date()): Promise<DataKinerjaSales> {
  const db = turso();
  const a = argTanggal(periode);
  const [booking, dataKpi, leads, survey] = await Promise.all([
    db.execute({
      sql: `SELECT tanggal_booking, nama_penyewa, kamar_no, status_booking, harga_disepakati, sumber_leads
            FROM booking WHERE ${kondisiTanggal('tanggal_booking')} ORDER BY tanggal_booking, no_booking`,
      args: a,
    }),
    ambilKpiLaporan(periode, dibuat, 'sales'),
    db.execute({ sql: `SELECT COUNT(*) AS n FROM leads WHERE ${kondisiTanggal('tanggal')}`, args: a }),
    db.execute({ sql: `SELECT COUNT(*) AS n FROM survey WHERE ${kondisiTanggal('tanggal_survey')}`, args: a }),
  ]);
  const teks = (v: unknown) => (v == null ? null : String(v));
  return susunSales(
    periode, dibuat,
    booking.rows.map(r => ({
      tanggal: teks(r.tanggal_booking) ?? '', nama: teks(r.nama_penyewa) ?? '', kamar: teks(r.kamar_no),
      status: teks(r.status_booking), harga: Number(r.harga_disepakati ?? 0) || 0, sumber: teks(r.sumber_leads),
    })),
    barisSales(dataKpi),
    { leads: Number(leads.rows[0]?.n ?? 0) || 0, survey: Number(survey.rows[0]?.n ?? 0) || 0 },
  );
}
