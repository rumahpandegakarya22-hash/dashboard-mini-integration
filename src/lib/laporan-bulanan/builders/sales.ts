import { turso } from '@/lib/core/turso';
import type { Periode } from '../types';
import { argTanggal, kondisiTanggal } from '../tanggal';
import { barisSales, type BarisKpi } from '../kpi-laporan';
import { ambilKpiLaporan } from './kpi';

export interface DataKinerjaSales {
  periode: Periode;
  dibuat: Date;
  checkIn: number; konfirmasi: number; batal: number; nilaiBooking: number; sumberTeratas: string;
  booking: { tanggal: string; nama: string; kamar: string; status: string; harga: number; sumber: string }[];
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

export function susunSales(periode: Periode, dibuat: Date, booking: BookingMentah[], kpi: BarisKpi[] = []): DataKinerjaSales {
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
    kpi,
  };
}

export async function ambilKinerjaSales(periode: Periode, dibuat: Date = new Date()): Promise<DataKinerjaSales> {
  const db = turso();
  const a = argTanggal(periode);
  const [booking, dataKpi] = await Promise.all([
    db.execute({
      sql: `SELECT tanggal_booking, nama_penyewa, kamar_no, status_booking, harga_disepakati, sumber_leads
            FROM booking WHERE ${kondisiTanggal('tanggal_booking')} ORDER BY tanggal_booking, no_booking`,
      args: a,
    }),
    ambilKpiLaporan(periode, dibuat, 'sales'),
  ]);
  const teks = (v: unknown) => (v == null ? null : String(v));
  return susunSales(
    periode, dibuat,
    booking.rows.map(r => ({
      tanggal: teks(r.tanggal_booking) ?? '', nama: teks(r.nama_penyewa) ?? '', kamar: teks(r.kamar_no),
      status: teks(r.status_booking), harga: Number(r.harga_disepakati ?? 0) || 0, sumber: teks(r.sumber_leads),
    })),
    barisSales(dataKpi),
  );
}
