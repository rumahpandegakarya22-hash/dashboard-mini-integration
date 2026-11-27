/* Pengingat jatuh tempo: pengelompokan tagihan dan teks draft WhatsApp. Murni, tanpa akses DB. */
import { digits } from '../dashboard/format';
import { formatTanggal } from '../draft-info/render';
import { tambahBulan } from '../jurnal';
import type { Role } from '../core/roles';
import { barisRekening, type Rekening } from './rekening';

export type Tahap = 'terlambat' | 'jatuh_tempo' | 'pengingat';
export const URUTAN_TAHAP: Tahap[] = ['terlambat', 'jatuh_tempo', 'pengingat'];
export const JUDUL_TAHAP: Record<Tahap, string> = { terlambat: 'Terlambat', jatuh_tempo: 'Jatuh Tempo', pengingat: 'Pengingat' };

export interface BarisTagihan {
  idPenghuni: string;
  nama: string;
  panggilan: string;
  noKamar: string;
  tipe: string;
  noHp: string;
  /** ISO YYYY-MM-DD: akhir periode sewa yang sudah dibayar. */
  jatuhTempo: string;
  /** Lama sewa invoice terakhir, dipakai untuk periode berikutnya. */
  bulan: number;
}

export interface Tagihan extends BarisTagihan {
  tahap: Tahap;
  /** Hari ini dikurangi jatuh tempo. */
  selisih: number;
}

export const bolehLihatPengingat = (role: Role): boolean => role === 'owner' || role === 'admin_finance' || role === 'sales';

export function tahapDari(selisih: number): Tahap | null {
  if (selisih >= 7) return 'terlambat';
  if (selisih >= 0) return 'jatuh_tempo';
  return selisih >= -3 ? 'pengingat' : null;
}

export function susunDaftar(baris: BarisTagihan[], hariIni: string): Record<Tahap, Tagihan[]> {
  const hasil: Record<Tahap, Tagihan[]> = { terlambat: [], jatuh_tempo: [], pengingat: [] };
  for (const b of baris) {
    // Date.parse atas tanggal tanpa jam = UTC, jadi selisihnya selalu kelipatan 24 jam.
    const selisih = Math.round((Date.parse(hariIni) - Date.parse(b.jatuhTempo)) / 86_400_000);
    const tahap = tahapDari(selisih);
    if (tahap) hasil[tahap].push({ ...b, tahap, selisih });
  }
  // Paling lama telat di atas; di Pengingat artinya yang paling dekat jatuh tempo.
  for (const t of URUTAN_TAHAP) hasil[t].sort((a, b) => b.selisih - a.selisih || Number(a.noKamar) - Number(b.noKamar));
  return hasil;
}

export function keterangan({ selisih }: Pick<Tagihan, 'selisih'>): string {
  if (selisih === 0) return 'Hari ini';
  return selisih > 0 ? `Lewat ${selisih} hari` : `${-selisih} hari lagi`;
}

const PEMBUKA: Record<Tahap, (kamar: string, hari: number) => string> = {
  pengingat: (k, n) => `Sekedar mengingatkan, tagihan sewa kamar ${k} akan jatuh tempo ${n} hari lagi:`,
  jatuh_tempo: (k) => `Sekedar mengingatkan, tagihan sewa kamar ${k} sudah jatuh tempo:`,
  terlambat: (k, n) => `Sekedar mengingatkan, tagihan sewa kamar ${k} sudah lewat ${n} hari dari jatuh tempo. Mohon segera diselesaikan ya:`
};

/** Template #22 "Pengingat Pembayaran Bulanan" dari dokumen Draft Informasi Admin, tanpa nominal. */
export function susunDraft(t: Tagihan, rekening: Rekening): string {
  const awal = formatTanggal(t.jatuhTempo, false);
  return [
    `Halo Kak ${t.panggilan || t.nama} 😊`,
    '',
    PEMBUKA[t.tahap](t.noKamar, Math.abs(t.selisih)),
    '',
    `👤 Nama : ${t.nama}`,
    `🚪 Kamar : ${t.noKamar}${t.tipe ? ` (${t.tipe})` : ''}`,
    `📅 Jatuh tempo : ${awal}`,
    `🗓️ Periode sewa berikutnya : ${awal} s.d. ${formatTanggal(tambahBulan(t.jatuhTempo, t.bulan), false)}`,
    '',
    'Pembayaran dapat melalui:',
    barisRekening(rekening),
    '',
    'Mohon konfirmasi setelah transfer ya 🙏',
    '',
    'Terima kasih!',
    'Salam,',
    'Admin Kost Tiga Dara'
  ].join('\n');
}

/** Nomor siap pakai wa.me; '' bila bukan nomor HP Indonesia yang masuk akal. */
export function nomorWa(noHp: string): string {
  const n = digits(noHp);
  return /^62\d{8,13}$/.test(n) ? n : '';
}
