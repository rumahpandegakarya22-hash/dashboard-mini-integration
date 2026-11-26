import { z } from 'zod';
import type { SkenarioInput } from './tipe';

const MAKS_BARIS = 50;
const angka = (min: number, max: number) => z.number().finite().min(min).max(max);
const rupiah = angka(0, 1e10);
const teks = z.string().max(80);
const daftar = <T extends z.ZodTypeAny>(t: T) => z.array(t).max(MAKS_BARIS);

const alat = z
  .object({
    nama: teks,
    watt: angka(0, 1e5),
    jumlah: angka(0, 1e4),
    jamPerHari: angka(0, 24),
    faktorPemakaian: angka(1, 100),
    aktif: z.boolean()
  })
  .strict();

const tipeKamar = z
  .object({
    nama: teks,
    jumlahKamar: z.number().int().min(0).max(1000),
    kamarTerisi: z.number().int().min(0).max(1000),
    hargaSewa: rupiah,
    alatListrik: daftar(alat),
    itemBiaya: daftar(
      z
        .object({
          nama: teks,
          nominal: rupiah,
          sifat: z.enum(['tetap', 'variabel']),
          penyusutan: z.boolean(),
          aktif: z.boolean()
        })
        .strict()
    )
  })
  .strict()
  .refine((t) => t.kamarTerisi <= t.jumlahKamar, { message: 'Kamar terisi melebihi jumlah kamar' });

export const skemaInput: z.ZodType<SkenarioInput> = z
  .object({
    umum: z
      .object({ hariPerBulan: angka(1, 31), tarifListrik: rupiah, pajakAktif: z.boolean(), pajakPersen: angka(0, 100) })
      .strict(),
    tipeKamar: daftar(tipeKamar),
    fasum: daftar(
      z.object({ nama: teks, jumlah: angka(0, 1e6), harga: rupiah, penyusutan: z.boolean(), aktif: z.boolean() }).strict()
    ),
    listrikFasum: z.object({ aktif: z.boolean(), alat: daftar(alat) }).strict(),
    pbb: z
      .object({ aktif: z.boolean(), pbbTahunan: rupiah, luasRumah: angka(0, 1e7), luasKos: angka(0, 1e7) })
      .strict(),
    investasi: z.object({ modalAwal: angka(0, 1e13) }).strict(),
    upgrade: z
      .object({
        aktif: z.boolean(),
        biayaInvestasi: angka(0, 1e13),
        kenaikanSewaPerKamar: rupiah,
        kamarTerdampak: z.number().int().min(0).max(1e5),
        tambahanBiayaPerBulan: rupiah
      })
      .strict(),
    akuisisi: z
      .object({
        biaya: daftar(z.object({ nama: teks, nominal: rupiah }).strict()),
        penghuniBaru: z.number().int().min(0).max(1e6)
      })
      .strict(),
    barangTambahan: z.object({ alat: daftar(alat), pembulatanKe: angka(0, 1e7) }).strict()
  })
  .strict();

const namaSkenario = z.string().trim().min(1).max(80);
const id = z.number().int().positive();

export const skemaSimpan = z.object({ id: id.optional(), nama: namaSkenario, data: skemaInput }).strict();
export const skemaHapus = z.object({ id, hapus: z.literal(true) }).strict();

/** Data dari DB: JSON rusak atau skema lama yang tidak valid dibuang (null), bukan menjatuhkan halaman. */
export function parseData(json: string): SkenarioInput | null {
  try {
    const r = skemaInput.safeParse(JSON.parse(json));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

export const hanyaOwner = (role: string): boolean => role === 'owner';
