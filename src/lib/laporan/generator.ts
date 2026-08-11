import { turso } from '@/lib/core/turso';

export interface LabaRugiItem {
  kode: number;
  nama_akun: string;
  grup_laporan: string | null;
  tipe: 'Pendapatan' | 'Beban';
  total: number;
}

export interface ArusKasItem {
  kategori: string;
  inflow: number;
  outflow: number;
  net: number;
}

export interface NeracaItem {
  kode: number;
  nama_akun: string;
  tipe_akun: string;
  grup_laporan: string | null;
  saldo: number;
}

export async function queryLabaRugi(dari: string, sampai: string): Promise<LabaRugiItem[]> {
  const res = await turso().execute({
    sql: `
      SELECT c.kode, c.nama_akun, c.grup_laporan, 'Pendapatan' as tipe, SUM(jt.nominal) as total
      FROM jurnal_transaksi jt
      JOIN coa c ON c.kode = jt.akun_kredit_kode AND c.tipe_akun = 'Pendapatan'
      WHERE jt.tanggal BETWEEN ? AND ?
      GROUP BY c.kode

      UNION ALL

      SELECT c.kode, c.nama_akun, c.grup_laporan, 'Beban' as tipe, SUM(jt.nominal) as total
      FROM jurnal_transaksi jt
      JOIN coa c ON c.kode = jt.akun_debit_kode AND c.tipe_akun = 'Beban'
      WHERE jt.tanggal BETWEEN ? AND ?
      GROUP BY c.kode
      ORDER BY tipe DESC, kode
    `,
    args: [dari, sampai, dari, sampai],
  });

  return res.rows.map((r) => ({
    kode: Number(r[0]),
    nama_akun: String(r[1] ?? ''),
    grup_laporan: r[2] != null ? String(r[2]) : null,
    tipe: String(r[3]) as 'Pendapatan' | 'Beban',
    total: Number(r[4] ?? 0),
  }));
}

export async function queryArusKas(dari: string, sampai: string): Promise<ArusKasItem[]> {
  const res = await turso().execute({
    sql: `
      SELECT c_kredit.kategori_arus_kas as kategori, SUM(jt.nominal) as inflow, 0 as outflow
      FROM jurnal_transaksi jt
      JOIN coa c_debit ON c_debit.kode = jt.akun_debit_kode
      JOIN coa c_kredit ON c_kredit.kode = jt.akun_kredit_kode
      WHERE jt.tanggal BETWEEN ? AND ?
        AND c_debit.tipe_akun = 'Aset' AND c_debit.kategori_arus_kas IS NULL
        AND c_kredit.kategori_arus_kas IS NOT NULL
      GROUP BY c_kredit.kategori_arus_kas

      UNION ALL

      SELECT c_debit.kategori_arus_kas as kategori, 0 as inflow, SUM(jt.nominal) as outflow
      FROM jurnal_transaksi jt
      JOIN coa c_debit ON c_debit.kode = jt.akun_debit_kode
      JOIN coa c_kredit ON c_kredit.kode = jt.akun_kredit_kode
      WHERE jt.tanggal BETWEEN ? AND ?
        AND c_kredit.tipe_akun = 'Aset' AND c_kredit.kategori_arus_kas IS NULL
        AND c_debit.kategori_arus_kas IS NOT NULL
      GROUP BY c_debit.kategori_arus_kas
    `,
    args: [dari, sampai, dari, sampai],
  });

  const map = new Map<string, { inflow: number; outflow: number }>();
  for (const r of res.rows) {
    const kategori = String(r[0] ?? '');
    const inflow = Number(r[1] ?? 0);
    const outflow = Number(r[2] ?? 0);
    const existing = map.get(kategori) ?? { inflow: 0, outflow: 0 };
    map.set(kategori, { inflow: existing.inflow + inflow, outflow: existing.outflow + outflow });
  }

  return Array.from(map.entries()).map(([kategori, v]) => ({
    kategori,
    inflow: v.inflow,
    outflow: v.outflow,
    net: v.inflow - v.outflow,
  }));
}

export async function queryNeraca(sampai: string): Promise<NeracaItem[]> {
  const res = await turso().execute({
    sql: `
      SELECT c.kode, c.nama_akun, c.tipe_akun, c.saldo_normal, c.grup_laporan,
             COALESCE(d.total, 0) - COALESCE(k.total, 0) as saldo_debit_kredit
      FROM coa c
      LEFT JOIN (
        SELECT akun_debit_kode as kode, SUM(nominal) as total
        FROM jurnal_transaksi WHERE tanggal <= ?
        GROUP BY akun_debit_kode
      ) d ON d.kode = c.kode
      LEFT JOIN (
        SELECT akun_kredit_kode as kode, SUM(nominal) as total
        FROM jurnal_transaksi WHERE tanggal <= ?
        GROUP BY akun_kredit_kode
      ) k ON k.kode = c.kode
      WHERE c.tipe_akun IN ('Aset', 'Liabilitas', 'Ekuitas')
        AND (COALESCE(d.total, 0) != 0 OR COALESCE(k.total, 0) != 0)
      ORDER BY c.kode
    `,
    args: [sampai, sampai],
  });

  return res.rows.map((r) => {
    const tipeAkun = String(r[2] ?? '');
    const saldobk = Number(r[5] ?? 0);
    const saldo = tipeAkun === 'Aset' ? saldobk : -saldobk;
    return {
      kode: Number(r[0]),
      nama_akun: String(r[1] ?? ''),
      tipe_akun: tipeAkun,
      grup_laporan: r[4] != null ? String(r[4]) : null,
      saldo,
    };
  });
}
