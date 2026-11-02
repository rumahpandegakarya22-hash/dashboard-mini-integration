import { turso } from '@/lib/core/turso';
import { buildArusKas, buildLabaRugi, type LaporanTable } from '@/lib/laporan/generator';
import type { Periode } from '../types';

export interface TransaksiJurnal {
  tanggal: string; keterangan: string; debit: string; kredit: string; nominal: number;
}

export interface DataKinerjaKeuangan {
  periode: Periode;
  dibuat: Date;
  kasMasuk: number; kasKeluar: number; arusBersih: number; jumlahTransaksi: number;
  pendapatan: number; beban: number; laba: number;
  perKategori: { kategori: string; total: number }[];
  transaksi: { tanggal: string; debit: string; kredit: string; nominal: number; keterangan: string }[];
}

// Angka diambil dari baris Laba Rugi / Arus Kas resmi, bukan dihitung ulang dari jurnal.
// Kas masuk/keluar = jumlah baris rincian arus kas (bukan subtotal, bukan saldo) yang positif/negatif.
export function ekstrakKeuangan(lr: LaporanTable, ak: LaporanTable) {
  const nilai = (t: LaporanTable, label: string, nama: string) => {
    const baris = t.baris.find(b => b.label === label);
    if (!baris) throw new Error(`Baris "${label}" tidak ditemukan di ${nama}.`);
    return baris.nilai ?? 0;
  };
  const pendapatan = nilai(lr, 'Total Pendapatan', 'Laba Rugi');
  const laba = nilai(lr, 'LABA BERSIH', 'Laba Rugi');
  let kasMasuk = 0;
  let kasKeluar = 0;
  for (const b of ak.baris) {
    if (b.seksi || b.bold || b.nilai == null) continue;
    if (b.nilai > 0) kasMasuk += b.nilai;
    else kasKeluar += -b.nilai;
  }
  return { pendapatan, beban: pendapatan - laba, laba, kasMasuk, kasKeluar, arusBersih: nilai(ak, 'Kenaikan (Penurunan) Kas Bersih', 'Arus Kas') };
}

const teks = (v: unknown) => (v == null ? '' : String(v));
const angka = (v: unknown) => { const n = Number(v ?? 0); return Number.isFinite(n) ? n : 0; };

export async function ambilTransaksiJurnal(periode: Periode): Promise<TransaksiJurnal[]> {
  const res = await turso().execute({
    sql: `SELECT j.tanggal, j.keterangan, j.nominal, d.nama_akun AS debit, k.nama_akun AS kredit
          FROM jurnal_transaksi j LEFT JOIN coa d ON d.kode = j.akun_debit_kode LEFT JOIN coa k ON k.kode = j.akun_kredit_kode
          WHERE j.tanggal BETWEEN ? AND ? ORDER BY j.tanggal, j.id`,
    args: [periode.dari, periode.sampai],
  });
  return res.rows.map(r => ({ tanggal: teks(r.tanggal), keterangan: teks(r.keterangan), debit: teks(r.debit) || '-', kredit: teks(r.kredit) || '-', nominal: angka(r.nominal) }));
}

/** Gabungkan per nama kategori, buang total 0, urut dari terbesar (seri: abjad). */
export function susunKategori(rows: { kategori: string | null; total: number }[]): { kategori: string; total: number }[] {
  const peta = new Map<string, number>();
  for (const r of rows) {
    const nama = r.kategori?.trim() || 'Lainnya';
    peta.set(nama, (peta.get(nama) ?? 0) + r.total);
  }
  return [...peta]
    .filter(([, total]) => total !== 0)
    .map(([kategori, total]) => ({ kategori, total }))
    .sort((a, b) => b.total - a.total || a.kategori.localeCompare(b.kategori));
}

// Pengeluaran = mutasi bersih akun bertipe Beban (debit - kredit), selaras dengan beban Laba Rugi.
const TIPE_BEBAN = "('Beban', 'Beban Non-Operasional')";

async function ambilKategori(periode: Periode) {
  const res = await turso().execute({
    sql: `SELECT j.kategori AS kategori,
                 SUM(CASE WHEN d.tipe_akun IN ${TIPE_BEBAN} THEN j.nominal ELSE 0 END)
               - SUM(CASE WHEN k.tipe_akun IN ${TIPE_BEBAN} THEN j.nominal ELSE 0 END) AS total
          FROM jurnal_transaksi j LEFT JOIN coa d ON d.kode = j.akun_debit_kode LEFT JOIN coa k ON k.kode = j.akun_kredit_kode
          WHERE j.tanggal BETWEEN ? AND ? GROUP BY j.kategori`,
    args: [periode.dari, periode.sampai],
  });
  return susunKategori(res.rows.map(r => ({ kategori: r.kategori == null ? null : String(r.kategori), total: angka(r.total) })));
}

export async function ambilKinerjaKeuangan(periode: Periode, dibuat: Date = new Date()): Promise<DataKinerjaKeuangan> {
  const [lr, ak, jurnal, perKategori] = await Promise.all([
    buildLabaRugi(periode.dari, periode.sampai),
    buildArusKas(periode.dari, periode.sampai),
    ambilTransaksiJurnal(periode),
    ambilKategori(periode),
  ]);
  const { pendapatan, beban, laba, kasMasuk, kasKeluar, arusBersih } = ekstrakKeuangan(lr, ak);
  return {
    periode, dibuat, kasMasuk, kasKeluar, arusBersih, jumlahTransaksi: jurnal.length,
    pendapatan, beban, laba, perKategori,
    transaksi: jurnal.map(t => ({ tanggal: t.tanggal, debit: t.debit, kredit: t.kredit, nominal: t.nominal, keterangan: t.keterangan })),
  };
}
