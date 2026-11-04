import { turso } from '@/lib/core/turso';
import { buildArusKas, buildLabaRugi } from '@/lib/laporan/generator';
import { ambilTransaksiJurnal, ekstrakKeuangan } from './keuangan';
import type { Periode } from '../types';
import { argTanggal, kondisiTanggal } from '../tanggal';
import { labaRugiRingkas, metrikBulan, periodeLalu, rincianLabaRugi, type Ringkasan } from '../ringkasan';

export { ekstrakKeuangan };

export interface DataOwner {
  periode: Periode;
  dibuat: Date;
  masuk: { nama: string; kamar: string; institusi: string; tglMasuk: string }[];
  keluar: { nama: string; kamar: string; tglKeluar: string }[];
  keuangan: {
    pendapatan: number; beban: number; laba: number;
    kasMasuk: number; kasKeluar: number; arusBersih: number;
    transaksi: { tanggal: string; keterangan: string; debit: string; kredit: string; nominal: number }[];
  };
  operasional: {
    korektifSelesai: number; preventifSelesai: number; inspeksi: number; darurat: number; biaya: number;
    rincian: { tanggal: string; jenis: string; item: string; biaya: number; status: string }[];
  };
  marketing: { leads: number; booking: number };
  ringkasan: Ringkasan;
  rekomendasi: string[];
}

export function susunRekomendasi(d: Omit<DataOwner, 'rekomendasi'>): string[] {
  const r: string[] = [];
  if (d.operasional.inspeksi === 0) r.push('Dokumentasikan inspeksi fasilitas rutin agar kondisi bangunan terpantau setiap bulan.');
  if (d.keuangan.transaksi.length === 0) r.push('Input penerimaan sewa dan transaksi keuangan ke jurnal agar laporan keuangan terisi.');
  if (d.marketing.leads === 0) r.push('Isi rekap leads marketing agar kinerja pemasaran dapat dievaluasi.');
  return r.length ? r : ['Data periode ini sudah lengkap; tidak ada rekomendasi tambahan.'];
}

const teks = (v: unknown) => (v == null ? '' : String(v));
const angka = (v: unknown) => { const n = Number(v ?? 0); return Number.isFinite(n) ? n : 0; };

// Penghuni yang masih tinggal pada tanggal tsb (mulai <= tgl, belum selesai atau selesai sesudahnya).
function kamarTerisi(tgl: string): Promise<number> {
  return turso()
    .execute({
      sql: `SELECT COUNT(DISTINCT no_kamar) AS n FROM occupancy_history
            WHERE tanggal_mulai <= ? AND (tanggal_selesasi IS NULL OR tanggal_selesasi > ?)`,
      args: [tgl, tgl],
    })
    .then(r => angka(r.rows[0]?.n));
}

export async function ambilOwner(periode: Periode, dibuat: Date = new Date()): Promise<DataOwner> {
  const db = turso();
  const a = argTanggal(periode);
  const lalu = periodeLalu(periode);
  const [lr, ak, masuk, keluar, jurnal, cm, pm, insp, leads, booking, lrLalu, diskon, isiKini, isiLalu, kamar] = await Promise.all([
    buildLabaRugi(periode.dari, periode.sampai),
    buildArusKas(periode.dari, periode.sampai),
    db.execute({
      sql: `SELECT o.nama, o.no_kamar, o.tanggal_mulai, t.instansi FROM occupancy_history o
            LEFT JOIN active_tenant t ON t.id_penghuni = o.id_penghuni
            WHERE ${kondisiTanggal('o.tanggal_mulai')} ORDER BY o.tanggal_mulai, o.id_penghuni`,
      args: a,
    }),
    db.execute({
      sql: `SELECT penghuni_label, no_kamar, tanggal_checkout FROM checkout_log WHERE ${kondisiTanggal('tanggal_checkout')} ORDER BY tanggal_checkout, id`,
      args: a,
    }),
    ambilTransaksiJurnal(periode),
    db.execute({
      sql: `SELECT tanggal_kerusakan AS tgl, lokasi_item, biaya, status, prioritas FROM maintenance_cm WHERE ${kondisiTanggal('tanggal_kerusakan')} ORDER BY tanggal_kerusakan`,
      args: a,
    }),
    db.execute({
      sql: `SELECT tanggal_lapor AS tgl, lokasi_item, biaya, status, prioritas FROM maintenance_pm WHERE ${kondisiTanggal('tanggal_lapor')} ORDER BY tanggal_lapor`,
      args: a,
    }),
    db.execute({
      sql: `SELECT tanggal, area_fasilitas FROM inspeksi_fasilitas WHERE ${kondisiTanggal('tanggal')} ORDER BY tanggal, id`,
      args: a,
    }),
    // Hanya butuh jumlah: hitung di database, jangan tarik barisnya.
    db.execute({ sql: `SELECT COUNT(*) AS n FROM leads WHERE ${kondisiTanggal('tanggal')}`, args: a }),
    db.execute({
      sql: `SELECT COUNT(*) AS n FROM booking WHERE ${kondisiTanggal('tanggal_booking')} AND LOWER(COALESCE(status_booking, '')) NOT LIKE '%cancel%' AND LOWER(COALESCE(status_booking, '')) NOT LIKE '%batal%'`,
      args: a,
    }),
    buildLabaRugi(lalu.dari, lalu.sampai),
    // Satu query untuk dua bulan (bulan lalu s/d bulan laporan), dipisah per bulan.
    db.execute({
      sql: `SELECT substr(j.tanggal, 1, 7) AS bln, COALESCE(SUM(j.nominal), 0) AS n
            FROM jurnal_transaksi j JOIN coa d ON d.kode = j.akun_debit_kode
            WHERE j.tanggal BETWEEN ? AND ? AND LOWER(d.nama_akun) LIKE '%beban diskon%' GROUP BY bln`,
      args: [lalu.dari, periode.sampai],
    }),
    kamarTerisi(periode.sampai),
    kamarTerisi(lalu.sampai),
    db.execute('SELECT COUNT(*) AS n FROM kamar'),
  ]);

  const kerja = (rows: typeof cm.rows, jenis: string) =>
    rows.map(r => ({ tanggal: teks(r.tgl), jenis, item: teks(r.lokasi_item), biaya: angka(r.biaya), status: teks(r.status), darurat: teks(r.prioritas).toLowerCase() === 'darurat' }));
  const korektif = kerja(cm.rows, 'Korektif');
  const preventif = kerja(pm.rows, 'Preventif');
  const inspeksi = insp.rows.map(r => ({ tanggal: teks(r.tanggal), jenis: 'Inspeksi', item: teks(r.area_fasilitas), biaya: 0, status: 'Terdokumentasi', darurat: false }));
  const semua = [...korektif, ...preventif, ...inspeksi].sort((x, y) => x.tanggal.localeCompare(y.tanggal));
  const selesai = (x: { status: string }) => x.status.toLowerCase() === 'selesai';

  const totalKamar = angka(kamar.rows[0]?.n);
  const diskonBulan = (kode: string) => angka(diskon.rows.find(r => teks(r.bln) === kode)?.n);
  const susunRingkasan = (): Ringkasan => ({
    kini: metrikBulan(labaRugiRingkas(lr), diskonBulan(periode.kode), isiKini, totalKamar),
    lalu: metrikBulan(labaRugiRingkas(lrLalu), diskonBulan(lalu.kode), isiLalu, totalKamar),
    labelLalu: lalu.label,
    ...rincianLabaRugi(lr),
    totalKamar,
  });

  const d: Omit<DataOwner, 'rekomendasi'> = {
    periode,
    dibuat,
    masuk: masuk.rows.map(r => ({ nama: teks(r.nama), kamar: teks(r.no_kamar), institusi: teks(r.instansi) || '-', tglMasuk: teks(r.tanggal_mulai) })),
    keluar: keluar.rows.map(r => {
      const label = teks(r.penghuni_label);
      return { nama: label.includes(' — ') ? label.split(' — ').slice(1).join(' — ') : label, kamar: teks(r.no_kamar), tglKeluar: teks(r.tanggal_checkout) };
    }),
    keuangan: {
      ...ekstrakKeuangan(lr, ak),
      transaksi: jurnal,
    },
    operasional: {
      korektifSelesai: korektif.filter(selesai).length,
      preventifSelesai: preventif.filter(selesai).length,
      inspeksi: inspeksi.length,
      darurat: semua.filter(x => x.darurat).length,
      biaya: semua.reduce((s, x) => s + x.biaya, 0),
      rincian: semua.map(x => ({ tanggal: x.tanggal, jenis: x.jenis, item: x.item, biaya: x.biaya, status: x.status })),
    },
    marketing: { leads: angka(leads.rows[0]?.n), booking: angka(booking.rows[0]?.n) },
    ringkasan: susunRingkasan(),
  };
  return { ...d, rekomendasi: susunRekomendasi(d) };
}
