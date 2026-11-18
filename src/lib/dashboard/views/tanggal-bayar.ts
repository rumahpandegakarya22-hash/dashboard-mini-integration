/* =========================================================================
   Tautan "pengakuan sewa" → tanggal uang diterima.

   Jurnal sewa (lihat lib/jurnal.ts) terdiri dari:
     • 1 baris   "Terima sewa N bln dimuka {nama} KTD {kamar}"          (tgl bayar)
     • N+ baris  "Pengakuan sewa bln-k {Sewa|Listrik} {nama} ({kamar})"  (per irisan bulan)
   Tidak ada kunci relasi di tabel, jadi tautan dibuat dari nama + kamar, lalu
   pembayaran dicocokkan berurutan: pembayaran ke-j menguasai irisan yang jatuh
   dalam [irisan pertama yang tersisa, + N bulan - 1 hari].

   Dipakai grafik Pendapatan Kotor vs Beban vs Laba Bersih agar pendapatan
   tergambar di tanggal uang masuk (nilai tetap = pengakuan Laba Rugi).
   Irisan yang tidak bisa ditautkan tidak ada di hasil → pemanggil memakai
   tanggalnya sendiri.
   ========================================================================= */

export interface BarisTautan {
  d: Date;
  ket: string;
}

const RE_TERIMA = /^Terima sewa\s+(\d+)\s*bln dimuka\s+(.+?)\s+KTD\s+(.+?)\s*$/i;
const RE_PENGAKUAN = /^Pengakuan sewa bln-\d+\s+(?:Sewa|Listrik)\s+(.+?)\s+\(([^()]+)\)\s*(?:\[s\/d [^\]]*\])?\s*$/i;

/** Telat bayar paling lama / bayar di muka paling jauh (hari) yang masih dianggap satu pembayaran. */
const TOLERANSI_TELAT = 90;
const TOLERANSI_MUKA = 366;

const kunci = (nama: string, kamar: string) => `${nama.trim().replace(/\s+/g, ' ').toLowerCase()}|${kamar.trim().toLowerCase()}`;
const geser = (d: Date, hari: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + hari);

/** Tambah n bulan; tanggal 31 jatuh ke akhir bulan tujuan (sama dengan jurnal.ts). */
function tambahBulan(d: Date, n: number): Date {
  const hariDiTujuan = new Date(d.getFullYear(), d.getMonth() + n + 1, 0).getDate();
  return new Date(d.getFullYear(), d.getMonth() + n, Math.min(d.getDate(), hariDiTujuan));
}

/** indeks baris pengakuan → tanggal bayar pembayaran asalnya. */
export function petaTanggalBayar(baris: BarisTautan[]): Map<number, Date> {
  const terima = new Map<string, { d: Date; n: number }[]>();
  const pengakuan = new Map<string, { i: number; d: Date }[]>();

  baris.forEach((b, i) => {
    const t = RE_TERIMA.exec(b.ket);
    if (t) {
      const k = kunci(t[2], t[3]);
      (terima.get(k) ?? terima.set(k, []).get(k)!).push({ d: b.d, n: Math.max(1, +t[1]) });
      return;
    }
    const p = RE_PENGAKUAN.exec(b.ket);
    if (p) {
      const k = kunci(p[1], p[2]);
      (pengakuan.get(k) ?? pengakuan.set(k, []).get(k)!).push({ i, d: b.d });
    }
  });

  const hasil = new Map<number, Date>();
  for (const [k, daftarTerima] of terima) {
    const irisan = pengakuan.get(k);
    if (!irisan) continue;
    irisan.sort((a, b) => a.d.getTime() - b.d.getTime() || a.i - b.i);
    daftarTerima.sort((a, b) => a.d.getTime() - b.d.getTime());

    let p = 0;
    for (const t of daftarTerima) {
      if (p >= irisan.length) break;
      const awal = irisan[p].d;
      if (awal < geser(t.d, -TOLERANSI_TELAT) || awal > geser(t.d, TOLERANSI_MUKA)) continue;
      const akhir = geser(tambahBulan(awal, t.n), -1);
      while (p < irisan.length && irisan[p].d <= akhir) hasil.set(irisan[p++].i, t.d);
    }
  }
  return hasil;
}
