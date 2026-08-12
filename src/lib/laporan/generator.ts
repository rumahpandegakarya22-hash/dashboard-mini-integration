import { turso } from '@/lib/core/turso';

/* =========================================================================
   Mesin laporan PSAK — meniru arsitektur spreadsheet referensi:
     Transaksi (jurnal_transaksi) → Neraca Saldo per akun → Laba Rugi /
     Arus Kas / Neraca.
   Prinsip periode:
     - Laba Rugi & Arus Kas = arus SELAMA periode (dari..sampai).
     - Neraca = posisi SAMPAI akhir periode (<= sampai).
     - Saldo kas awal & laba ditahan = dari transaksi sebelum periode.
   ========================================================================= */

export interface Baris {
  label: string;
  nilai: number | null;   // null = baris '-' (tidak ada nilai kolom)
  bold?: boolean;
  seksi?: boolean;        // judul seksi (uppercase)
}

export interface LaporanTable {
  judul: string;
  baris: Baris[];
}

/* ---- Mesin: saldo per akun (Neraca Saldo) ---- */

interface AkunSaldo {
  kode: number;
  nama: string;
  tipe: string;
  saldoNormal: string;
  kategoriArusKas: string | null;
  grup: string | null;
  netPeriode: number;   // pergerakan selama periode (searah saldo normal)
  saldoSampai: number;  // saldo kumulatif s/d sampai (searah saldo normal)
}

async function neracaSaldo(dari: string, sampai: string): Promise<AkunSaldo[]> {
  const res = await turso().execute({
    sql: `
      SELECT c.kode, c.nama_akun, c.tipe_akun, c.saldo_normal, c.kategori_arus_kas, c.grup_laporan,
        COALESCE(dp.t,0) AS debit_periode, COALESCE(kp.t,0) AS kredit_periode,
        COALESCE(ds.t,0) AS debit_sampai,  COALESCE(ks.t,0) AS kredit_sampai
      FROM coa c
      LEFT JOIN (SELECT akun_debit_kode k, SUM(nominal) t FROM jurnal_transaksi WHERE tanggal BETWEEN ? AND ? GROUP BY 1) dp ON dp.k=c.kode
      LEFT JOIN (SELECT akun_kredit_kode k, SUM(nominal) t FROM jurnal_transaksi WHERE tanggal BETWEEN ? AND ? GROUP BY 1) kp ON kp.k=c.kode
      LEFT JOIN (SELECT akun_debit_kode k, SUM(nominal) t FROM jurnal_transaksi WHERE tanggal <= ? GROUP BY 1) ds ON ds.k=c.kode
      LEFT JOIN (SELECT akun_kredit_kode k, SUM(nominal) t FROM jurnal_transaksi WHERE tanggal <= ? GROUP BY 1) ks ON ks.k=c.kode
    `,
    args: [dari, sampai, dari, sampai, sampai, sampai],
  });

  return res.rows.map((r) => {
    const saldoNormal = String(r[3] ?? 'Debit');
    const dPer = Number(r[6] ?? 0), kPer = Number(r[7] ?? 0);
    const dSmp = Number(r[8] ?? 0), kSmp = Number(r[9] ?? 0);
    const arah = saldoNormal === 'Debit' ? 1 : -1;
    return {
      kode: Number(r[0]),
      nama: String(r[1] ?? ''),
      tipe: String(r[2] ?? ''),
      saldoNormal,
      kategoriArusKas: r[4] != null ? String(r[4]) : null,
      grup: r[5] != null ? String(r[5]) : null,
      netPeriode: arah * (dPer - kPer),
      saldoSampai: arah * (dSmp - kSmp),
    };
  });
}

const sumGrup = (a: AkunSaldo[], grup: string, field: 'netPeriode' | 'saldoSampai') =>
  a.filter((x) => x.grup === grup).reduce((s, x) => s + x[field], 0);
const sumKode = (a: AkunSaldo[], kode: number, field: 'netPeriode' | 'saldoSampai') =>
  a.filter((x) => x.kode === kode).reduce((s, x) => s + x[field], 0);

/* =======================  LABA RUGI  ======================= */

export async function buildLabaRugi(dari: string, sampai: string): Promise<LaporanTable> {
  const a = await neracaSaldo(dari, sampai);
  const F = 'netPeriode' as const;

  const sewa = sumGrup(a, 'Pendapatan Sewa', F);
  const tambahan = sumGrup(a, 'Pendapatan Tambahan', F);
  const totalPendapatan = sewa + tambahan;

  const hpp = sumGrup(a, 'HPP Perawatan', F);
  const labaKotor = totalPendapatan - hpp;

  const listrik = sumKode(a, 5101, F);
  const gaji = sumKode(a, 5104, F);
  const internet = sumKode(a, 5102, F);
  const pbb = sumKode(a, 5106, F);
  const iuran = sumKode(a, 5103, F);
  const pemasaran = sumKode(a, 5105, F);
  const totalOperasional = sumGrup(a, 'Beban Operasional', F);
  const bahan = totalOperasional - (listrik + gaji + internet + pbb + iuran + pemasaran);
  const labaOperasional = labaKotor - totalOperasional;

  const penyBangunan = sumKode(a, 6101, F);
  const penyElektronik = sumKode(a, 6102, F);
  const penyFurniture = sumKode(a, 6103, F);
  const penyPeralatan = sumKode(a, 6104, F);
  const bunga = sumGrup(a, 'Beban Bunga', F);
  const totalNonOp = penyBangunan + penyElektronik + penyFurniture + penyPeralatan + bunga;
  const labaBersih = labaOperasional - totalNonOp;

  return {
    judul: 'Laporan Laba Rugi',
    baris: [
      { label: 'PENDAPATAN PENJUALAN', nilai: null, seksi: true },
      { label: 'Penerimaan Sewa Kamar', nilai: sewa },
      { label: 'Pendapatan Tambahan', nilai: tambahan },
      { label: 'Total Pendapatan', nilai: totalPendapatan, bold: true },
      { label: 'HARGA POKOK / BEBAN PERAWATAN', nilai: null, seksi: true },
      { label: 'Beban Perbaikan & Perawatan (HPP)', nilai: hpp },
      { label: 'Laba Kotor', nilai: labaKotor, bold: true },
      { label: 'BEBAN OPERASIONAL', nilai: null, seksi: true },
      { label: 'Listrik', nilai: listrik },
      { label: 'Gaji Karyawan', nilai: gaji },
      { label: 'Internet', nilai: internet },
      { label: 'PBB', nilai: pbb },
      { label: 'Iuran Lingkungan', nilai: iuran },
      { label: 'Pemasaran', nilai: pemasaran },
      { label: 'Beban Bahan & Perlengkapan', nilai: bahan },
      { label: 'Total Beban Operasional', nilai: totalOperasional, bold: true },
      { label: 'Laba Operasional', nilai: labaOperasional, bold: true },
      { label: 'BEBAN NON-OPERASIONAL', nilai: null, seksi: true },
      { label: 'Penyusutan Bangunan', nilai: penyBangunan },
      { label: 'Penyusutan Elektronik', nilai: penyElektronik },
      { label: 'Penyusutan Furniture', nilai: penyFurniture },
      { label: 'Penyusutan Peralatan Operasional', nilai: penyPeralatan },
      { label: 'Bunga Pinjaman', nilai: bunga },
      { label: 'Total Beban Non-Operasional', nilai: totalNonOp, bold: true },
      { label: 'LABA BERSIH', nilai: labaBersih, bold: true },
    ],
  };
}

/* =======================  ARUS KAS  ======================= */

/** Arus kas per baris: hanya transaksi yang menyentuh akun Kas & Bank.
 *  Klasifikasi berdasar akun lawan (grup / kategori arus kas). */
export async function buildArusKas(dari: string, sampai: string): Promise<LaporanTable> {
  const db = turso();

  // Saldo kas awal = saldo Kas & Bank sebelum periode (< dari).
  const awalRes = await db.execute({
    sql: `SELECT
            COALESCE((SELECT SUM(nominal) FROM jurnal_transaksi jt JOIN coa c ON c.kode=jt.akun_debit_kode  WHERE c.grup_laporan='Kas & Bank' AND jt.tanggal < ?),0)
          - COALESCE((SELECT SUM(nominal) FROM jurnal_transaksi jt JOIN coa c ON c.kode=jt.akun_kredit_kode WHERE c.grup_laporan='Kas & Bank' AND jt.tanggal < ?),0) AS saldo_awal`,
    args: [dari, dari],
  });
  const saldoAwal = Number(awalRes.rows[0]?.[0] ?? 0);

  // Semua baris jurnal dalam periode yang salah satu sisinya Kas & Bank.
  const res = await db.execute({
    sql: `
      SELECT jt.nominal,
             cd.grup_laporan AS d_grup, cd.kategori_arus_kas AS d_kat,
             ck.grup_laporan AS k_grup, ck.kategori_arus_kas AS k_kat
      FROM jurnal_transaksi jt
      JOIN coa cd ON cd.kode = jt.akun_debit_kode
      JOIN coa ck ON ck.kode = jt.akun_kredit_kode
      WHERE jt.tanggal BETWEEN ? AND ?
        AND (cd.grup_laporan='Kas & Bank' OR ck.grup_laporan='Kas & Bank')
        AND NOT (cd.grup_laporan='Kas & Bank' AND ck.grup_laporan='Kas & Bank')
    `,
    args: [dari, sampai],
  });

  let sewaIn = 0, tambahanIn = 0, bungaOut = 0, opsLainOut = 0;
  let jualAset = 0, beliAset = 0, setorModal = 0, priveOut = 0;

  const RENT_GRUPS = new Set(['Pendapatan Sewa', 'Pendapatan Dimuka', 'Piutang Sewa']);

  for (const r of res.rows) {
    const nominal = Number(r[0] ?? 0);
    const kasDebit = String(r[1] ?? '') === 'Kas & Bank'; // kas bertambah (inflow)
    // akun lawan = sisi yang BUKAN kas
    const lawanGrup = kasDebit ? String(r[3] ?? '') : String(r[1] ?? '');
    const lawanKat = kasDebit ? (r[4] != null ? String(r[4]) : '') : (r[2] != null ? String(r[2]) : '');

    if (kasDebit) {
      // inflow
      if (RENT_GRUPS.has(lawanGrup)) sewaIn += nominal;
      else if (lawanGrup === 'Pendapatan Tambahan') tambahanIn += nominal;
      else if (lawanKat === 'Investasi') jualAset += nominal;
      else if (lawanKat === 'Pendanaan') setorModal += nominal;
      else tambahanIn += nominal; // inflow operasional lain
    } else {
      // outflow
      if (lawanGrup === 'Beban Bunga') bungaOut += nominal;
      else if (lawanKat === 'Investasi') beliAset += nominal;
      else if (lawanKat === 'Pendanaan') priveOut += nominal;
      else opsLainOut += nominal; // beban operasional / HPP / dll
    }
  }

  const netOperasional = sewaIn + tambahanIn - bungaOut - opsLainOut;
  const netInvestasi = jualAset - beliAset;
  const netPendanaan = setorModal - priveOut;
  const kenaikan = netOperasional + netInvestasi + netPendanaan;
  const saldoAkhir = saldoAwal + kenaikan;

  return {
    judul: 'Laporan Arus Kas',
    baris: [
      { label: 'Arus Kas Awal Periode', nilai: saldoAwal, bold: true },
      { label: 'AKTIVITAS OPERASIONAL', nilai: null, seksi: true },
      { label: 'Penerimaan Sewa Kamar', nilai: sewaIn },
      { label: 'Penerimaan Tambahan', nilai: tambahanIn },
      { label: 'Pembayaran Bunga Hutang', nilai: bungaOut === 0 ? 0 : -bungaOut },
      { label: 'Pembayaran Operasional Lainnya', nilai: opsLainOut === 0 ? 0 : -opsLainOut },
      { label: 'Arus Kas Bersih Operasional', nilai: netOperasional, bold: true },
      { label: 'AKTIVITAS INVESTASI', nilai: null, seksi: true },
      { label: 'Penjualan Aset', nilai: jualAset },
      { label: 'Pembelian Aset', nilai: beliAset === 0 ? 0 : -beliAset },
      { label: 'Arus Kas Bersih Investasi', nilai: netInvestasi, bold: true },
      { label: 'AKTIVITAS PENDANAAN', nilai: null, seksi: true },
      { label: 'Setoran Modal / Investor', nilai: setorModal },
      { label: 'Prive / Pelunasan Pokok', nilai: priveOut === 0 ? 0 : -priveOut },
      { label: 'Arus Kas Bersih Pendanaan', nilai: netPendanaan, bold: true },
      { label: 'Kenaikan (Penurunan) Kas Bersih', nilai: kenaikan, bold: true },
      { label: 'Arus Kas Akhir Periode', nilai: saldoAkhir, bold: true },
    ],
  };
}

/* =======================  NERACA  ======================= */

export interface NeracaSisi { kiri: Baris[]; kanan: Baris[]; }
export interface NeracaTable { judul: string; sisi: NeracaSisi; }

export async function buildNeraca(sampai: string): Promise<NeracaTable> {
  // tahun berjalan: 1 Jan tahun 'sampai'
  const tahun = sampai.slice(0, 4);
  const awalTahun = `${tahun}-01-01`;
  const a = await neracaSaldo(awalTahun, sampai);
  const S = 'saldoSampai' as const;

  // Aset
  const kas = sumGrup(a, 'Kas & Bank', S);
  const piutang = sumGrup(a, 'Piutang Sewa', S);
  const perlengkapan = sumGrup(a, 'Perlengkapan', S);
  const totalLancar = kas + piutang + perlengkapan;

  const tanah = sumGrup(a, 'Tanah', S);
  const bangunan = sumGrup(a, 'Bangunan', S);
  const peralatan = sumGrup(a, 'Peralatan Operasional', S);
  const furniture = sumGrup(a, 'Furniture', S);
  const elektronik = sumGrup(a, 'Elektronik', S);
  // Akumulasi penyusutan = Kontra Aset (saldo normal Kredit → saldoSampai negatif dalam arah debit)
  const akumBangunan = sumGrup(a, 'Akum Bangunan', S);
  const akumElektronik = sumGrup(a, 'Akum Elektronik', S);
  const akumFurniture = sumGrup(a, 'Akum Furniture', S);
  const akumPeralatan = sumGrup(a, 'Akum Peralatan', S);
  const totalTetap = tanah + bangunan + peralatan + furniture + elektronik
    + akumBangunan + akumElektronik + akumFurniture + akumPeralatan;
  const totalAset = totalLancar + totalTetap;

  // Kewajiban
  const hutang = sumGrup(a, 'Hutang', S);
  const hutangSewa = sumGrup(a, 'Hutang Sewa', S);
  const pendapatanDimuka = sumGrup(a, 'Pendapatan Dimuka', S);
  const totalKewajiban = hutang + hutangSewa + pendapatanDimuka;

  // Ekuitas
  const modal = sumGrup(a, 'Modal', S);
  const prive = sumGrup(a, 'Prive', S); // Kontra Ekuitas → saldoSampai positif dalam arah debit
  // Laba tahun berjalan = pendapatan - beban selama tahun berjalan (netPeriode dgn periode = awalTahun..sampai)
  const pendapatanYb = a.filter((x) => x.tipe === 'Pendapatan').reduce((s, x) => s + x.netPeriode, 0);
  const bebanYb = a.filter((x) => x.tipe === 'Beban' || x.tipe === 'Beban Non-Operasional').reduce((s, x) => s + x.netPeriode, 0);
  const labaTahunBerjalan = pendapatanYb - bebanYb;
  // Laba ditahan = akumulasi laba sebelum tahun berjalan = (saldoSampai - netPeriode) untuk pendapatan/beban
  const pendapatanKum = a.filter((x) => x.tipe === 'Pendapatan').reduce((s, x) => s + x.saldoSampai, 0);
  const bebanKum = a.filter((x) => x.tipe === 'Beban' || x.tipe === 'Beban Non-Operasional').reduce((s, x) => s + x.saldoSampai, 0);
  const labaDitahan = (pendapatanKum - bebanKum) - labaTahunBerjalan;
  const totalEkuitas = modal + labaDitahan + labaTahunBerjalan - prive;

  const totalPasiva = totalKewajiban + totalEkuitas;

  return {
    judul: 'Laporan Posisi Keuangan (Neraca)',
    sisi: {
      kiri: [
        { label: 'ASET LANCAR', nilai: null, seksi: true },
        { label: 'Kas dan Bank', nilai: kas },
        { label: 'Piutang Sewa', nilai: piutang },
        { label: 'Perlengkapan', nilai: perlengkapan },
        { label: 'Total Aset Lancar', nilai: totalLancar, bold: true },
        { label: 'ASET TETAP', nilai: null, seksi: true },
        { label: 'Tanah', nilai: tanah },
        { label: 'Bangunan Kost', nilai: bangunan },
        { label: 'Peralatan Operasional', nilai: peralatan },
        { label: 'Furniture', nilai: furniture },
        { label: 'Elektronik', nilai: elektronik },
        { label: 'Akum. Penyusutan Bangunan', nilai: akumBangunan },
        { label: 'Akum. Penyusutan Elektronik', nilai: akumElektronik },
        { label: 'Akum. Penyusutan Furniture', nilai: akumFurniture },
        { label: 'Akum. Penyusutan Peralatan Ops', nilai: akumPeralatan },
        { label: 'Total Aset Tetap', nilai: totalTetap, bold: true },
        { label: 'TOTAL ASET', nilai: totalAset, bold: true },
      ],
      kanan: [
        { label: 'KEWAJIBAN', nilai: null, seksi: true },
        { label: 'Hutang', nilai: hutang },
        { label: 'Hutang Sewa', nilai: hutangSewa },
        { label: 'Pendapatan Diterima di Muka', nilai: pendapatanDimuka },
        { label: 'Total Kewajiban', nilai: totalKewajiban, bold: true },
        { label: 'EKUITAS (MODAL)', nilai: null, seksi: true },
        { label: 'Modal Awal', nilai: modal },
        { label: 'Laba Ditahan', nilai: labaDitahan },
        { label: 'Laba Tahun Berjalan', nilai: labaTahunBerjalan },
        { label: 'Pengambilan Prive', nilai: prive === 0 ? 0 : -prive },
        { label: 'Total Ekuitas', nilai: totalEkuitas, bold: true },
        { label: 'TOTAL PASIVA', nilai: totalPasiva, bold: true },
      ],
    },
  };
}
