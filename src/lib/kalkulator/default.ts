import type { AlatListrik, ItemBiaya, ItemFasum, SkenarioInput, TipeKamar } from './tipe';

const alat = (nama: string, watt: number, jumlah: number, jamPerHari: number): AlatListrik => ({
  nama,
  watt,
  jumlah,
  jamPerHari,
  faktorPemakaian: 100,
  aktif: true
});
const tetap = (nama: string, nominal: number, penyusutan = false): ItemBiaya => ({
  nama,
  nominal,
  sifat: 'tetap',
  penyusutan,
  aktif: true
});
const variabel = (nama: string, nominal: number): ItemBiaya => ({
  nama,
  nominal,
  sifat: 'variabel',
  penyusutan: false,
  aktif: true
});
const fasum = (nama: string, jumlah: number, harga: number, penyusutan = false): ItemFasum => ({
  nama,
  jumlah,
  harga,
  penyusutan,
  aktif: true
});

/** Isi sheet "kalkulator Keuangan Kost Tiga Dara" setelah formulanya dikoreksi (lihat spec §3–§4). */
export const SKENARIO_DEFAULT: SkenarioInput = {
  umum: { hariPerBulan: 30, tarifListrik: 1444, pajakAktif: false, pajakPersen: 0 },
  tipeKamar: [
    {
      nama: 'Eco',
      jumlahKamar: 25,
      kamarTerisi: 25,
      hargaSewa: 850_000,
      alatListrik: [alat('Charger HP', 20, 1, 12), alat('Charger Laptop', 65, 1, 12), alat('Kipas Angin', 65, 1, 15)],
      itemBiaya: [tetap('Penyusutan Furniture', 125_000, true)]
    },
    {
      nama: 'Classic',
      jumlahKamar: 3,
      kamarTerisi: 3,
      hargaSewa: 1_200_000,
      alatListrik: [],
      itemBiaya: [
        tetap('Servis AC', 40_000),
        variabel('Kebersihan KM Dalam', 50_000),
        tetap('Penyusutan Furniture', 125_000, true),
        tetap('Penyusutan Elektronik', 50_000, true)
      ]
    },
    {
      nama: 'Comfy',
      jumlahKamar: 2,
      kamarTerisi: 2,
      hargaSewa: 1_600_000,
      alatListrik: [],
      itemBiaya: [
        tetap('Servis AC', 40_000),
        variabel('Kebersihan KM Dalam', 50_000),
        tetap('Penyusutan Furniture', 150_000, true),
        tetap('Penyusutan Elektronik', 100_000, true)
      ]
    }
  ],
  fasum: [
    fasum('Internet', 1, 500_000),
    fasum('Petugas Kebersihan', 2, 1_800_000),
    fasum('Iuran Lingkungan', 1, 75_000),
    fasum('Perawatan Fasum', 1, 200_000),
    fasum('Penyusutan Fasum', 1, 330_000, true),
    fasum('Kebersihan KM Bersama', 8, 50_000)
  ],
  listrikFasum: {
    aktif: true,
    alat: [
      alat('Lampu', 7, 21, 12),
      alat('Pompa Air', 500, 1, 2),
      alat('Pompa Pendorong', 350, 1, 2),
      alat('Kulkas Bawah', 100, 1, 12),
      alat('Kulkas Atas', 100, 1, 12),
      alat('Wifi', 7, 7, 24),
      // Watt dispenser kosong di sheet; 240 W diturunkan dari 0,96 kWh/hari untuk 2 unit × 2 jam.
      alat('Dispenser', 240, 2, 2)
    ]
  },
  pbb: { aktif: true, pbbTahunan: 4_448_130, luasRumah: 497, luasKos: 528 },
  investasi: { modalAwal: 0 },
  upgrade: {
    aktif: false,
    biayaInvestasi: 17_000_000,
    kenaikanSewaPerKamar: 30_000,
    kamarTerdampak: 30,
    tambahanBiayaPerBulan: 830_000
  },
  akuisisi: { biaya: [{ nama: 'Mamikos', nominal: 50_000 }], penghuniBaru: 8 },
  barangTambahan: {
    // Hair dryer di sheet tertulis 7,5 jam/hari — kemungkinan maksudnya menit; dipakai 0,25 jam.
    alat: [alat('Rice Cooker', 350, 1, 0.5), alat('Charger Laptop > 65 W', 250, 1, 2), alat('Hair Dryer', 400, 1, 0.25)],
    pembulatanKe: 5_000
  }
};

export const alatBaru = (): AlatListrik => alat('', 0, 1, 1);
export const itemBiayaBaru = (): ItemBiaya => tetap('', 0);
export const fasumBaru = (): ItemFasum => fasum('', 1, 0);
export const tipeKamarBaru = (): TipeKamar => ({
  nama: 'Tipe Baru',
  jumlahKamar: 0,
  kamarTerisi: 0,
  hargaSewa: 0,
  alatListrik: [],
  itemBiaya: []
});
