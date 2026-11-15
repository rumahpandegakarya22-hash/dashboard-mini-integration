import { turso } from '@/lib/core/turso';
import { loadKpi } from '@/lib/dashboard/kpi';
import { hariKerjaSetelahAkhirBulan, tgl } from '@/lib/dashboard/kpi-calc';
import { buildLabaRugi } from '@/lib/laporan/generator';
import { isoWib } from '../format';
import type { DataKpi } from '../kpi-laporan';
import { labaRugiRingkas, rincianLabaRugi } from '../ringkasan';
import type { Periode } from '../types';

const angka = (v: unknown) => { const n = Number(v ?? 0); return Number.isFinite(n) ? n : 0; };

/** Kamar yang terisi pada tanggal tsb (mulai <= tgl, belum selesai atau selesai sesudahnya). */
export async function kamarTerisi(tanggal: string): Promise<number> {
  const r = await turso().execute({
    sql: `SELECT COUNT(DISTINCT no_kamar) AS n FROM occupancy_history
          WHERE tanggal_mulai <= ? AND (tanggal_selesasi IS NULL OR tanggal_selesasi > ?)`,
    args: [tanggal, tanggal],
  });
  return angka(r.rows[0]?.n);
}

export type RoleKpi = 'admin_finance' | 'sales' | 'marketing' | 'operasional' | 'owner';

/**
 * Angka KPI satu periode untuk scorecard laporan. `role` membatasi kelompok KPI yang dihitung.
 * Tanggal acuan jatuh tempo/tunggakan = akhir periode (atau hari ini untuk bulan berjalan), jadi laporan bulan lalu
 * tidak ikut berubah karena tunggakan yang baru muncul setelah bulan itu.
 */
export async function ambilKpiLaporan(periode: Periode, dibuat: Date, role: RoleKpi): Promise<DataKpi> {
  const db = turso();
  const range = { from: tgl(periode.dari), to: tgl(periode.sampai) };
  const hariDibuat = tgl(isoWib(dibuat)) as Date;
  const akhir = tgl(periode.sampai) as Date;
  const acuan = hariDibuat < akhir ? hariDibuat : akhir;
  const butuhKeuangan = role === 'admin_finance' || role === 'owner';

  const [kamar, kamarIsi] = await Promise.all([db.execute('SELECT COUNT(*) AS n FROM kamar'), kamarTerisi(periode.sampai)]);
  const kapasitas = angka(kamar.rows[0]?.n);

  const [kpi, lr, diskon, tutup] = await Promise.all([
    loadKpi(role, range, kapasitas, { acuan, segar: true }),
    butuhKeuangan ? buildLabaRugi(periode.dari, periode.sampai) : null,
    butuhKeuangan
      ? db.execute({
          sql: `SELECT COALESCE(SUM(j.nominal), 0) AS n FROM jurnal_transaksi j JOIN coa d ON d.kode = j.akun_debit_kode
                WHERE j.tanggal BETWEEN ? AND ? AND LOWER(d.nama_akun) LIKE '%beban diskon%'`,
          args: [periode.dari, periode.sampai],
        })
      : null,
    // Tutup buku = laporan resmi pertama periode ini. Bila belum ada (laporan ini yang pertama), pakai saat dibuat.
    butuhKeuangan
      ? db.execute({
          sql: `SELECT MIN(created_at) AS dibuat FROM laporan_riwayat WHERE periode = ? AND substr(created_at, 1, 10) > ?`,
          args: [periode.kode, periode.sampai],
        })
      : null,
  ]);

  if (kpi.admin) {
    const pertama = tutup?.rows[0]?.dibuat;
    kpi.admin.tutupBukuHariKerja = hariKerjaSetelahAkhirBulan(periode.kode, pertama ? String(pertama) : isoWib(dibuat));
  }

  const ringkas = lr ? labaRugiRingkas(lr) : { pendapatan: 0, beban: 0, laba: 0 };
  const pendapatanSewa = lr
    ? rincianLabaRugi(lr).income.filter(s => /sewa/i.test(s.label)).reduce((t, s) => t + s.nilai, 0)
    : 0;
  const nilaiDiskon = angka(diskon?.rows[0]?.n);
  // Dashboard menghitung pendapatan, margin, dan persen diskon terhadap pendapatan KOTOR (sebelum diskon).
  const kotor = lr?.baris.find(b => b.label === 'Pendapatan Kotor')?.nilai ?? ringkas.pendapatan + nilaiDiskon;

  return {
    kpi, ...ringkas, pendapatan: kotor, pendapatanSewa, diskon: nilaiDiskon,
    kapasitas, kamarIsi, hari: Number(periode.sampai.slice(8, 10)),
  };
}
