import type { AlatListrik, HasilHitung, HasilTipe, SkenarioInput } from './tipe';

const MAKS_RUPIAH = 1e10;

const angka = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const jepit = (v: unknown, min: number, max: number): number => Math.min(max, Math.max(min, angka(v)));
const bulat = (v: unknown, min: number, max: number): number => Math.round(jepit(v, min, max));
const jumlahkan = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);
/** ceil yang tahan galat float: 12.0000000001 tetap 12. */
const ceil = (x: number): number => Math.ceil(x - 1e-9);
const bagi = (a: number, b: number): number | null => (b > 0 ? a / b : null);

const rapiAlat = (a: AlatListrik): AlatListrik => ({
  nama: String(a.nama ?? ''),
  watt: jepit(a.watt, 0, 1e5),
  jumlah: jepit(a.jumlah, 0, 1e4),
  jamPerHari: jepit(a.jamPerHari, 0, 24),
  faktorPemakaian: jepit(a.faktorPemakaian, 1, 100),
  aktif: !!a.aktif
});

/** Salinan input dengan semua angka dijepit ke rentang wajar dan NaN jadi 0. Input asli tidak diubah. */
export function normalisasi(input: SkenarioInput): SkenarioInput {
  const tipeKamar = input.tipeKamar.map((t) => {
    const jumlahKamar = bulat(t.jumlahKamar, 0, 1000);
    return {
      nama: String(t.nama ?? ''),
      jumlahKamar,
      kamarTerisi: bulat(t.kamarTerisi, 0, jumlahKamar),
      hargaSewa: jepit(t.hargaSewa, 0, MAKS_RUPIAH),
      alatListrik: t.alatListrik.map(rapiAlat),
      itemBiaya: t.itemBiaya.map((b) => ({
        nama: String(b.nama ?? ''),
        nominal: jepit(b.nominal, 0, MAKS_RUPIAH),
        sifat: b.sifat === 'variabel' ? ('variabel' as const) : ('tetap' as const),
        // Penyusutan selalu biaya tetap: aset menyusut walau kamar kosong.
        penyusutan: b.sifat !== 'variabel' && !!b.penyusutan,
        aktif: !!b.aktif
      }))
    };
  });
  const totalKamar = jumlahkan(tipeKamar.map((t) => t.jumlahKamar));
  const { umum, pbb, upgrade } = input;
  return {
    umum: {
      hariPerBulan: jepit(umum.hariPerBulan, 1, 31),
      tarifListrik: jepit(umum.tarifListrik, 0, MAKS_RUPIAH),
      pajakAktif: !!umum.pajakAktif,
      pajakPersen: jepit(umum.pajakPersen, 0, 100)
    },
    tipeKamar,
    fasum: input.fasum.map((f) => ({
      nama: String(f.nama ?? ''),
      jumlah: jepit(f.jumlah, 0, 1e6),
      harga: jepit(f.harga, 0, MAKS_RUPIAH),
      penyusutan: !!f.penyusutan,
      aktif: !!f.aktif
    })),
    listrikFasum: { aktif: !!input.listrikFasum.aktif, alat: input.listrikFasum.alat.map(rapiAlat) },
    pbb: {
      aktif: !!pbb.aktif,
      pbbTahunan: jepit(pbb.pbbTahunan, 0, MAKS_RUPIAH),
      luasRumah: jepit(pbb.luasRumah, 0, 1e7),
      luasKos: jepit(pbb.luasKos, 0, 1e7)
    },
    investasi: { modalAwal: jepit(input.investasi.modalAwal, 0, 1e13) },
    upgrade: {
      aktif: !!upgrade.aktif,
      biayaInvestasi: jepit(upgrade.biayaInvestasi, 0, 1e13),
      kenaikanSewaPerKamar: jepit(upgrade.kenaikanSewaPerKamar, 0, MAKS_RUPIAH),
      kamarTerdampak: bulat(upgrade.kamarTerdampak, 0, totalKamar),
      tambahanBiayaPerBulan: jepit(upgrade.tambahanBiayaPerBulan, 0, MAKS_RUPIAH)
    },
    akuisisi: {
      biaya: input.akuisisi.biaya.map((b) => ({ nama: String(b.nama ?? ''), nominal: jepit(b.nominal, 0, MAKS_RUPIAH) })),
      penghuniBaru: bulat(input.akuisisi.penghuniBaru, 0, 1e6)
    },
    barangTambahan: {
      alat: input.barangTambahan.alat.map(rapiAlat),
      pembulatanKe: jepit(input.barangTambahan.pembulatanKe, 0, 1e7)
    }
  };
}

/** kWh/bulan = watt × jumlah × jam/hari × hari × faktor% / 1000. Watt label = daya nyata, tanpa faktor 0,707. */
export function biayaListrik(alat: AlatListrik[], hari: number, tarif: number): { kwhBulan: number; biaya: number } {
  const kwhBulan = jumlahkan(
    alat.filter((a) => a.aktif).map((a) => (a.watt * a.jumlah * a.jamPerHari * hari * (a.faktorPemakaian / 100)) / 1000)
  );
  return { kwhBulan, biaya: kwhBulan * tarif };
}

export function hitung(input: SkenarioInput): HasilHitung {
  const s = normalisasi(input);
  const { hariPerBulan: hari, tarifListrik: tarif } = s.umum;
  const p = s.umum.pajakAktif ? s.umum.pajakPersen / 100 : 0;
  const up = s.upgrade;

  const lf = s.listrikFasum.aktif ? biayaListrik(s.listrikFasum.alat, hari, tarif) : { kwhBulan: 0, biaya: 0 };
  const luasTotal = s.pbb.luasRumah + s.pbb.luasKos;
  const pbbBulanan = s.pbb.aktif && luasTotal > 0 ? (s.pbb.pbbTahunan * s.pbb.luasKos) / luasTotal / 12 : 0;
  const fasumAktif = s.fasum.filter((f) => f.aktif);
  const fasumTotal = jumlahkan(fasumAktif.map((f) => f.jumlah * f.harga)) + lf.biaya + pbbBulanan;
  const fasumPenyusutan = jumlahkan(fasumAktif.filter((f) => f.penyusutan).map((f) => f.jumlah * f.harga));

  const totalKamar = jumlahkan(s.tipeKamar.map((t) => t.jumlahKamar));
  const kamarTerisi = jumlahkan(s.tipeKamar.map((t) => t.kamarTerisi));
  const kenaikanTotal = up.kamarTerdampak * up.kenaikanSewaPerKamar;
  const tambahanHarga = up.aktif && totalKamar > 0 ? kenaikanTotal / totalKamar : 0;
  const tambahanTetap = up.aktif ? up.tambahanBiayaPerBulan : 0;

  const tipe = s.tipeKamar.map((t) => {
    const aktif = t.itemBiaya.filter((b) => b.aktif);
    const listrikPerKamar = biayaListrik(t.alatListrik, hari, tarif).biaya;
    const variabelPerKamar = listrikPerKamar + jumlahkan(aktif.filter((b) => b.sifat === 'variabel').map((b) => b.nominal));
    const tetap = aktif.filter((b) => b.sifat === 'tetap');
    const tetapPerKamar = jumlahkan(tetap.map((b) => b.nominal));
    const penyusutanPerKamar = jumlahkan(tetap.filter((b) => b.penyusutan).map((b) => b.nominal));
    const hargaEfektif = t.hargaSewa + tambahanHarga;
    const cm = hargaEfektif * (1 - p) - variabelPerKamar;
    return { t, listrikPerKamar, variabelPerKamar, tetapPerKamar, penyusutanPerKamar, hargaEfektif, cm };
  });

  const pendapatan = jumlahkan(s.tipeKamar.map((t) => t.kamarTerisi * t.hargaSewa)) + (up.aktif ? kenaikanTotal : 0);
  const biayaVariabel = jumlahkan(tipe.map((x) => x.t.kamarTerisi * x.variabelPerKamar));
  const biayaTetap = fasumTotal + jumlahkan(tipe.map((x) => x.t.jumlahKamar * x.tetapPerKamar)) + tambahanTetap;
  const penyusutan = fasumPenyusutan + jumlahkan(tipe.map((x) => x.t.jumlahKamar * x.penyusutanPerKamar));
  const opex = biayaVariabel + biayaTetap - penyusutan;
  const labaSebelumPajak = pendapatan - biayaVariabel - biayaTetap;
  const pajak = pendapatan * p;
  const labaBersih = labaSebelumPajak - pajak;

  // Bauran memakai kapasitas (jumlah kamar), bukan kamar terisi.
  const mix = (x: (typeof tipe)[number]) => x.t.jumlahKamar / totalKamar;
  const wacm = totalKamar > 0 ? jumlahkan(tipe.map((x) => x.cm * mix(x))) : null;
  const bep = wacm !== null && wacm > 0 ? ceil(biayaTetap / wacm) : null;
  const hargaRata = totalKamar > 0 ? jumlahkan(tipe.map((x) => x.hargaEfektif * mix(x))) : 0;
  const cmRatioRata = wacm !== null && hargaRata > 0 ? wacm / hargaRata : null;

  const perTipe: HasilTipe[] = tipe.map((x) => ({
    nama: x.t.nama,
    jumlahKamar: x.t.jumlahKamar,
    kamarTerisi: x.t.kamarTerisi,
    pendapatan: x.t.kamarTerisi * x.t.hargaSewa,
    listrikPerKamar: x.listrikPerKamar,
    variabelPerKamar: x.variabelPerKamar,
    tetapPerKamar: x.tetapPerKamar,
    cm: x.cm,
    cmRatio: bagi(x.cm, x.hargaEfektif),
    labaPerKamar: totalKamar > 0 ? x.cm - (fasumTotal + tambahanTetap) / totalKamar - x.tetapPerKamar : null
  }));

  const sensitivitas = Array.from({ length: 21 }, (_, i) => {
    const okupansi = i * 5;
    const laba = jumlahkan(tipe.map((x) => x.t.jumlahKamar * (okupansi / 100) * x.cm)) - biayaTetap;
    return { okupansi, laba };
  });

  const deltaLaba = kenaikanTotal * (1 - p) - up.tambahanBiayaPerBulan;
  const modal = s.investasi.modalAwal;
  const biayaAkuisisi = jumlahkan(s.akuisisi.biaya.map((b) => b.nominal));
  const cac = bagi(biayaAkuisisi, s.akuisisi.penghuniBaru);

  const bt = biayaListrik(s.barangTambahan.alat, hari, tarif);
  const k = s.barangTambahan.pembulatanKe;

  const peringatan = [
    ...s.tipeKamar.filter((t) => t.kamarTerisi > 0 && !t.alatListrik.some((a) => a.aktif)).map((t) => `Listrik kamar ${t.nama} belum diisi`),
    ...(labaBersih < 0 ? ['Biaya tetap belum tertutup: laba negatif'] : [])
  ];

  return {
    totalKamar,
    kamarTerisi,
    okupansi: bagi(kamarTerisi, totalKamar),
    pendapatan,
    biayaVariabel,
    biayaTetap,
    penyusutan,
    opex,
    oer: bagi(opex, pendapatan),
    listrikFasum: lf.biaya,
    listrikFasumKwhHari: lf.kwhBulan / hari,
    pbbBulanan,
    labaSebelumPajak,
    pajak,
    labaBersih,
    perTipe,
    wacm,
    bep,
    bepOkupansi: bep !== null ? bagi(bep, totalKamar) : null,
    bepPendapatan: cmRatioRata !== null && cmRatioRata > 0 ? biayaTetap / cmRatioRata : null,
    marginOfSafety: bep !== null && kamarTerisi > 0 ? (kamarTerisi - bep) / kamarTerisi : null,
    roiTahunan: modal > 0 ? (labaBersih * 12) / modal : null,
    paybackUsaha: modal > 0 && labaBersih > 0 ? ceil(modal / labaBersih) : null,
    upgrade: {
      deltaLaba,
      payback: up.biayaInvestasi > 0 && deltaLaba > 0 ? ceil(up.biayaInvestasi / deltaLaba) : null,
      roiTahunan: up.biayaInvestasi > 0 ? (deltaLaba * 12) / up.biayaInvestasi : null
    },
    cac,
    cacPayback: cac !== null && wacm !== null && wacm > 0 ? cac / wacm : null,
    sensitivitas,
    barangTambahan: { kwhBulan: bt.kwhBulan, biaya: bt.biaya, tarifDibulatkan: k > 0 ? ceil(bt.biaya / k) * k : bt.biaya },
    peringatan
  };
}
