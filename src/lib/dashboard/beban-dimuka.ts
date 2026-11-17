/* Daftar Beban Dimuka: satu baris per pembayaran di muka, dihitung dari jurnal_transaksi.
   Murni (tanpa DB) supaya bisa diuji; pembacaan data ada di beban-dimuka-db.ts. */

export interface BarisJurnalDimuka {
  tanggal: string;
  /** Nama akun (bukan kode) sisi debit dan kredit. */
  akunDebit: string;
  akunKredit: string;
  nominal: number;
  keterangan: string;
  grupId: string;
}

export interface ItemBebanDimuka {
  grupId: string;
  tanggalBayar: string;
  keterangan: string;
  akunBeban: string;
  total: number;
  bulan: number;
  /** Jumlah yang sudah menjadi beban sampai hari ini. */
  diakui: number;
  /** Total dikurangi diakui; masih tercatat sebagai aset (akun 1170). */
  sisa: number;
  bulanBerjalan: number;
  selesaiPada: string;
  status: 'Berjalan' | 'Selesai';
}

const BAYAR = /^Bayar dimuka (\d+) bln: (.*)$/;
const AMORTISASI = /^Amortisasi bln-\d+\/\d+: /;

/**
 * Kelompokkan baris jurnal per grup_id. Baris pertama bertanda "Bayar dimuka N bln: ..." adalah pembayaran;
 * baris "Amortisasi bln-i/N: ..." adalah jadwal beban. Beban diakui bila tanggal amortisasi <= hariIni (YYYY-MM-DD).
 */
export function susunBebanDimuka(rows: BarisJurnalDimuka[], hariIni: string): ItemBebanDimuka[] {
  const grup = new Map<string, BarisJurnalDimuka[]>();
  for (const r of rows) {
    if (!r.grupId) continue;
    (grup.get(r.grupId) ?? grup.set(r.grupId, []).get(r.grupId)!).push(r);
  }

  const out: ItemBebanDimuka[] = [];
  for (const [grupId, baris] of grup) {
    const bayar = baris.find((b) => BAYAR.test(b.keterangan));
    if (!bayar) continue;
    const m = BAYAR.exec(bayar.keterangan)!;
    const amort = baris.filter((b) => AMORTISASI.test(b.keterangan)).sort((a, b) => a.tanggal.localeCompare(b.tanggal));
    if (!amort.length) continue;

    const diakuiRows = amort.filter((a) => a.tanggal <= hariIni);
    const diakui = diakuiRows.reduce((s, a) => s + a.nominal, 0);
    out.push({
      grupId,
      tanggalBayar: bayar.tanggal,
      keterangan: m[2],
      akunBeban: amort[0].akunDebit,
      total: bayar.nominal,
      bulan: Number(m[1]),
      diakui,
      sisa: bayar.nominal - diakui,
      bulanBerjalan: diakuiRows.length,
      selesaiPada: amort[amort.length - 1].tanggal,
      status: diakuiRows.length >= amort.length ? 'Selesai' : 'Berjalan'
    });
  }
  // Yang masih berjalan dulu, lalu yang terbaru.
  return out.sort((a, b) => (a.status === b.status ? b.tanggalBayar.localeCompare(a.tanggalBayar) : a.status === 'Berjalan' ? -1 : 1));
}
