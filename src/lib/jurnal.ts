import { turso } from './core/turso';

/* ==========================================================================
   Pembentukan baris jurnal untuk pembayaran Sewa & DP.

   Menggantikan Apps Script "Kost Tools" yang dulu membaca sheet
   'Input Sewa Dimuka' lalu menulis jurnal. Pola akunnya MENGIKUTI 129 baris
   jurnal produksi yang sudah ada, bukan aturan baru:

     Terima uang     : debit akun kas/bank  → kredit 2105 (Pendapatan Diterima di Muka)
     Pengakuan sewa  : debit 2105           → kredit 4101 (Pendapatan Sewa), per bulan
     Pengakuan listrik: debit 2105          → kredit 4101, per bulan (ikut pola lama,
                        bukan 4103, supaya sebanding dengan data historis)
     Pengakuan denda : debit 2105           → kredit 4102 (Denda)
     DP              : debit akun kas/bank  → kredit 2104 (Deposit Penghuni)

   Baris pengakuan dibuat SEKALIGUS di muka untuk seluruh bulan periode —
   sama seperti perilaku lama (di produksi ada baris pengakuan bertanggal
   bulan-bulan mendatang).
   ========================================================================== */

const AKUN = {
  pendapatanDimuka: 2105,
  pendapatanSewa: 4101,
  denda: 4102,
  depositPenghuni: 2104,
  hutangPajak: 2106,
  bebanDiskon: 5129,
  bebanDibayarDimuka: 1170
};

const KATEGORI = 'Operasional';

export type BarisJurnal = {
  tanggal: string;
  debit: number;
  kredit: number;
  nominal: number;
  keterangan: string;
  kategori: string;
};

/**
 * Nama akun kas/bank dari form (opsi dropdown-nya memang diambil dari
 * coa.nama_akun grup 'Kas & Bank'), jadi pemetaan ke kode akun lewat COA.
 */
export async function kodeAkunKas(namaAkun: string): Promise<number | null> {
  const res = await turso().execute({
    sql: "SELECT kode FROM coa WHERE nama_akun = ? AND grup_laporan = 'Kas & Bank' LIMIT 1",
    args: [namaAkun.trim()]
  });
  return res.rows.length ? Number(res.rows[0].kode) : null;
}

/** Tambah n bulan, tetap di akhir bulan kalau tanggal asalnya tidak ada (31 → 30/28). */
function tambahBulan(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00`);
  const tgl = d.getDate();
  d.setMonth(d.getMonth() + n);
  if (d.getDate() < tgl) d.setDate(0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const tambahHari = (iso: string, n: number): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const selisihHari = (a: string, b: string): number =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
const akhirBulanIso = (iso: string): string => {
  const [y, m] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};

/**
 * Pecah rentang [mulai, akhir] per bulan kalender, nominal dibagi menurut jumlah hari.
 * Irisan terakhir menyerap sisa pembulatan supaya totalnya tetap sama. Dipakai agar
 * pendapatan sewa jatuh di bulan yang benar (date-to-date), bukan sebulan penuh di tanggal mulai.
 */
export function irisPerBulan(mulai: string, akhir: string, nominal: number): { mulai: string; akhir: string; nominal: number }[] {
  const hariTotal = selisihHari(mulai, akhir) + 1;
  const irisan: { mulai: string; akhir: string; nominal: number }[] = [];
  let awal = mulai;
  let terpakai = 0;
  while (awal <= akhir) {
    const eom = akhirBulanIso(awal);
    const ujung = eom < akhir ? eom : akhir;
    const hari = selisihHari(awal, ujung) + 1;
    const porsi = ujung === akhir ? nominal - terpakai : Math.round((nominal * hari) / hariTotal);
    irisan.push({ mulai: awal, akhir: ujung, nominal: porsi });
    terpakai += porsi;
    awal = tambahHari(ujung, 1);
  }
  return irisan;
}

/** Penanda akhir irisan di keterangan; dibaca dashboard untuk mengakui pendapatan sampai tanggal berjalan. */
export const penandaAkhir = (akhir: string) => ` [s/d ${akhir}]`;

export type InputJurnalSewa = {
  kodeKas: number;
  nama: string;
  noKamar: string;
  tanggalBayar: string;
  periodeAwal: string;
  jumlahBulan: number;
  totalSewa: number;
  totalListrik: number;
  totalDenda: number;
  diskon: number;
  pajak: number;
  grandTotal: number;
  /** true = bentuk lama: sebulan penuh dijurnal di tanggal mulai. Hanya untuk mencocokkan jurnal lama saat edit invoice. */
  lama?: boolean;
};

/**
 * Baris penerimaan uang, dipakai Sewa maupun DP. Sisi kredit "penampung" berbeda
 * (2105 utk sewa, 2104 utk DP) tapi cara diskon & pajak diperlakukan sama:
 *
 *   Debit kas          / Kredit penampung  = subtotal - diskon
 *   Debit Beban Diskon / Kredit penampung  = diskon      <- bulan pertama
 *   Debit kas          / Kredit Hutang Pajak = pajak
 *
 * Hasilnya: kredit ke penampung berjumlah subtotal — sama persis dengan total
 * baris pengakuan yang mendebitnya, jadi tidak ada sisa mengendap. Debit ke kas
 * berjumlah (subtotal - diskon + pajak) = grand total, yaitu uang yang benar-benar
 * masuk. Pajak tidak menyentuh akun pendapatan karena itu titipan untuk disetor.
 */
function barisPenerimaan(p: {
  kodeKas: number;
  penampung: number;
  subtotal: number;
  diskon: number;
  pajak: number;
  tanggalBayar: string;
  tanggalDiskon: string;
  keteranganUtama: string;
  keteranganEkor: string;
}): BarisJurnal[] {
  const baris: BarisJurnal[] = [
    {
      tanggal: p.tanggalBayar,
      debit: p.kodeKas,
      kredit: p.penampung,
      nominal: p.subtotal - p.diskon,
      keterangan: p.keteranganUtama,
      kategori: KATEGORI
    }
  ];

  // Diskon dibebankan SEKALIGUS di bulan pertama, bukan dicicil per bulan.
  if (p.diskon > 0) {
    baris.push({
      tanggal: p.tanggalDiskon,
      debit: AKUN.bebanDiskon,
      kredit: p.penampung,
      nominal: p.diskon,
      keterangan: `Diskon ${p.keteranganEkor}`,
      kategori: KATEGORI
    });
  }

  if (p.pajak > 0) {
    baris.push({
      tanggal: p.tanggalBayar,
      debit: p.kodeKas,
      kredit: AKUN.hutangPajak,
      nominal: p.pajak,
      keterangan: `Pajak dipungut ${p.keteranganEkor}`,
      kategori: KATEGORI
    });
  }

  return baris;
}

/**
 * Baris jurnal untuk satu pembayaran Sewa: 1 baris terima uang + baris pengakuan
 * per bulan (sewa & listrik dipisah, mengikuti bentuk keterangan lama) + denda.
 */
export function barisJurnalSewa(p: InputJurnalSewa): BarisJurnal[] {
  const subtotal = p.totalSewa + p.totalListrik + p.totalDenda;
  const baris = barisPenerimaan({
    kodeKas: p.kodeKas,
    penampung: AKUN.pendapatanDimuka,
    subtotal,
    diskon: p.diskon,
    pajak: p.pajak,
    tanggalBayar: p.tanggalBayar,
    tanggalDiskon: p.periodeAwal, // bulan pertama periode sewa
    keteranganUtama: `Terima sewa ${p.jumlahBulan} bln dimuka ${p.nama} KTD ${p.noKamar}`,
    keteranganEkor: `sewa ${p.nama} KTD ${p.noKamar}`
  });

  const sewaPerBulan = Math.round(p.totalSewa / p.jumlahBulan);
  const listrikPerBulan = Math.round(p.totalListrik / p.jumlahBulan);

  for (let i = 0; i < p.jumlahBulan; i++) {
    const tanggal = tambahBulan(p.periodeAwal, i);
    const ke = i + 1;
    // Bulan terakhir menyerap sisa pembulatan supaya jumlah baris pengakuan
    // sama persis dengan total di invoice (tidak menyisakan rupiah di 2105).
    const sisaSewa = i === p.jumlahBulan - 1 ? p.totalSewa - sewaPerBulan * (p.jumlahBulan - 1) : sewaPerBulan;
    const sisaListrik = i === p.jumlahBulan - 1 ? p.totalListrik - listrikPerBulan * (p.jumlahBulan - 1) : listrikPerBulan;

    const akhirPeriode = tambahHari(tambahBulan(p.periodeAwal, i + 1), -1);
    const tambahPengakuan = (jenis: string, nominal: number) => {
      if (nominal <= 0) return;
      const dasar = `Pengakuan sewa bln-${ke} ${jenis} ${p.nama} (${p.noKamar})`;
      if (p.lama) {
        baris.push({ tanggal, debit: AKUN.pendapatanDimuka, kredit: AKUN.pendapatanSewa, nominal, keterangan: dasar, kategori: KATEGORI });
        return;
      }
      for (const s of irisPerBulan(tanggal, akhirPeriode, nominal)) {
        baris.push({
          tanggal: s.mulai,
          debit: AKUN.pendapatanDimuka,
          kredit: AKUN.pendapatanSewa,
          nominal: s.nominal,
          keterangan: dasar + penandaAkhir(s.akhir),
          kategori: KATEGORI
        });
      }
    };
    tambahPengakuan('Sewa', sisaSewa);
    tambahPengakuan('Listrik', sisaListrik);
  }

  if (p.totalDenda > 0) {
    baris.push({
      tanggal: p.tanggalBayar,
      debit: AKUN.pendapatanDimuka,
      kredit: AKUN.denda,
      nominal: p.totalDenda,
      keterangan: `Pengakuan denda ${p.nama} (${p.noKamar})`,
      kategori: KATEGORI
    });
  }

  return baris;
}

/** DP diperlakukan sebagai titipan, bukan pendapatan dimuka — kredit 2104. */
export function barisJurnalDp(p: {
  kodeKas: number;
  nama: string;
  noKamar: string;
  tanggalBayar: string;
  subtotal: number;
  diskon: number;
  pajak: number;
}): BarisJurnal[] {
  return barisPenerimaan({
    kodeKas: p.kodeKas,
    penampung: AKUN.depositPenghuni,
    subtotal: p.subtotal,
    diskon: p.diskon,
    pajak: p.pajak,
    tanggalBayar: p.tanggalBayar,
    tanggalDiskon: p.tanggalBayar, // DP tidak punya periode; diskon jatuh di tanggal bayar
    keteranganUtama: `Terima DP ${p.nama} KTD ${p.noKamar}`,
    keteranganEkor: `DP ${p.nama} KTD ${p.noKamar}`
  });
}

/**
 * Beban dibayar di muka (PSAK: aset sampai dipakai). Bayar: debit 1170 / kredit sumber dana.
 * Amortisasi: debit akun beban / kredit 1170, satu baris per bulan kalender, bertanggal akhir bulan,
 * mulai bulan pembayaran. Bulan terakhir menyerap sisa pembulatan.
 */
export function barisBebanDimuka(p: {
  tanggal: string;
  kodeBeban: number;
  kodeSumber: number;
  nominal: number;
  jumlahBulan: number;
  keterangan: string;
  kategori: string;
}): BarisJurnal[] {
  const bulan = Math.max(1, Math.floor(p.jumlahBulan));
  const baris: BarisJurnal[] = [
    {
      tanggal: p.tanggal,
      debit: AKUN.bebanDibayarDimuka,
      kredit: p.kodeSumber,
      nominal: p.nominal,
      keterangan: `Bayar dimuka ${bulan} bln: ${p.keterangan}`,
      kategori: p.kategori
    }
  ];
  const perBulan = Math.round(p.nominal / bulan);
  const [y0, m0] = p.tanggal.split('-').map(Number);
  for (let i = 0; i < bulan; i++) {
    const nominal = i === bulan - 1 ? p.nominal - perBulan * (bulan - 1) : perBulan;
    if (nominal <= 0) continue;
    baris.push({
      tanggal: new Date(Date.UTC(y0, m0 - 1 + i + 1, 0)).toISOString().slice(0, 10),
      debit: p.kodeBeban,
      kredit: AKUN.bebanDibayarDimuka,
      nominal,
      keterangan: `Amortisasi bln-${i + 1}/${bulan}: ${p.keterangan}`,
      kategori: p.kategori
    });
  }
  return baris;
}
