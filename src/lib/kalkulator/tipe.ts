export interface AlatListrik {
  nama: string;
  watt: number;
  jumlah: number;
  jamPerHari: number;
  /** % waktu alat benar-benar menarik daya (kulkas ber-kompresor < 100). */
  faktorPemakaian: number;
  aktif: boolean;
}

export interface ItemBiaya {
  nama: string;
  /** Rupiah per kamar per bulan. */
  nominal: number;
  /** tetap = ditanggung semua kamar; variabel = hanya kamar terisi. */
  sifat: 'tetap' | 'variabel';
  penyusutan: boolean;
  aktif: boolean;
}

export interface TipeKamar {
  nama: string;
  jumlahKamar: number;
  kamarTerisi: number;
  hargaSewa: number;
  alatListrik: AlatListrik[];
  itemBiaya: ItemBiaya[];
}

export interface ItemFasum {
  nama: string;
  jumlah: number;
  harga: number;
  penyusutan: boolean;
  aktif: boolean;
}

export interface BiayaAkuisisi {
  nama: string;
  nominal: number;
}

export interface SkenarioInput {
  umum: { hariPerBulan: number; tarifListrik: number; pajakAktif: boolean; pajakPersen: number };
  tipeKamar: TipeKamar[];
  fasum: ItemFasum[];
  listrikFasum: { aktif: boolean; alat: AlatListrik[] };
  pbb: { aktif: boolean; pbbTahunan: number; luasRumah: number; luasKos: number };
  investasi: { modalAwal: number };
  upgrade: {
    aktif: boolean;
    biayaInvestasi: number;
    kenaikanSewaPerKamar: number;
    kamarTerdampak: number;
    tambahanBiayaPerBulan: number;
  };
  akuisisi: { biaya: BiayaAkuisisi[]; penghuniBaru: number };
  barangTambahan: { alat: AlatListrik[]; pembulatanKe: number };
}

export interface HasilTipe {
  nama: string;
  jumlahKamar: number;
  kamarTerisi: number;
  pendapatan: number;
  listrikPerKamar: number;
  variabelPerKamar: number;
  tetapPerKamar: number;
  cm: number;
  cmRatio: number | null;
  labaPerKamar: number | null;
}

/** Semua nominal per bulan kecuali yang bernama "Tahunan". null = tidak terdefinisi (tampil "—"). */
export interface HasilHitung {
  totalKamar: number;
  kamarTerisi: number;
  okupansi: number | null;
  pendapatan: number;
  biayaVariabel: number;
  biayaTetap: number;
  penyusutan: number;
  opex: number;
  oer: number | null;
  listrikFasum: number;
  listrikFasumKwhHari: number;
  pbbBulanan: number;
  labaSebelumPajak: number;
  pajak: number;
  labaBersih: number;
  perTipe: HasilTipe[];
  wacm: number | null;
  bep: number | null;
  bepOkupansi: number | null;
  bepPendapatan: number | null;
  marginOfSafety: number | null;
  roiTahunan: number | null;
  paybackUsaha: number | null;
  upgrade: { deltaLaba: number; payback: number | null; roiTahunan: number | null };
  cac: number | null;
  cacPayback: number | null;
  sensitivitas: { okupansi: number; laba: number }[];
  barangTambahan: { kwhBulan: number; biaya: number; tarifDibulatkan: number };
  peringatan: string[];
}
