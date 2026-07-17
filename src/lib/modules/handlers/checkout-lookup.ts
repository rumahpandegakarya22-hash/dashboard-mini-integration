import { getTenantByLabel, getTanggalMasukByKamar } from '../../master';
import { turso } from '../../turso';
import { toISODateFlexible } from '../../validate';
import { resolveOccupancyId } from './helpers';
import type { AutoFillHandler } from '../types';

export interface CheckoutDefaults {
  tglMasuk: string; // '' kalau tidak ditemukan otomatis
  adaTunggakan: 'Ya' | 'Tidak' | ''; // '' = tidak bisa dihitung (tidak ada riwayat pembayaran)
  nominalTunggakan: number;
  note: string; // penjelasan/langkah manual, '' kalau semua lengkap
}

/**
 * Hitung default Checkout dari data yg SUDAH ADA — TIDAK pernah menebak.
 * Tunggakan: berbasis waktu — MAX(periode_akhir) di tabel `payment` (id_penghuni dari
 * occupancy_history via resolveOccupancyId, BUKAN Tenant.id sheet) dibanding tanggal checkout
 * yang dipilih admin di device (fleksibel zona waktu, bukan clock server). Aman ('Tidak')
 * kalau periode_akhir masih lebih besar. Status dropdown payment TIDAK dipakai lagi.
 * Kalau sumber data belum lengkap, `note` berisi langkah konkret dan field dikembalikan kosong
 * supaya admin sadar harus isi manual (bukan diam-diam salah).
 */
export async function computeCheckoutDefaults(penghuniLabel: string, tanggalCheckoutISO: string): Promise<CheckoutDefaults> {
  const tenant = await getTenantByLabel(penghuniLabel);
  if (!tenant) {
    return { tglMasuk: '', adaTunggakan: '', nominalTunggakan: 0, note: `Penghuni "${penghuniLabel}" tidak ditemukan di Database Penghuni.` };
  }

  const notes: string[] = [];

  // --- Tgl Masuk (opsional: kolom "Tanggal Masuk" di Database Penghuni → DATA) ---
  const tglMasukMap = await getTanggalMasukByKamar();
  const rawMasuk = tglMasukMap[tenant.kamar];
  const tglMasuk = rawMasuk ? toISODateFlexible(rawMasuk) : null;
  if (!tglMasuk) {
    notes.push(
      'Tgl Masuk tidak ditemukan otomatis — tambahkan kolom "Tanggal Masuk" (per No Kamar) di sheet Database Penghuni → DATA, atau isi manual di form ini.'
    );
  }

  // --- Tunggakan: berbasis waktu — MAX(periode_akhir) payment sewa vs tanggal checkout dari
  // device admin (bukan clock server UTC). Aman kalau lunas-sampai masih > tanggal checkout. ---
  let adaTunggakan: 'Ya' | 'Tidak' | '' = '';
  const nominalTunggakan = 0; // tidak bisa dihitung dari aturan waktu — admin isi manual saat 'Ya'
  try {
    const occupancyId = await resolveOccupancyId(tenant.kamar);
    if (!occupancyId) {
      notes.push(
        `Kamar ${tenant.kamar} tidak ditemukan sebagai penghuni aktif di occupancy_history — Tunggakan tidak bisa dihitung otomatis, cek manual.`
      );
    } else {
      const res = await turso().execute({
        sql: 'SELECT MAX(periode_akhir) mx FROM payment WHERE id_penghuni = ? AND periode_akhir IS NOT NULL',
        args: [occupancyId]
      });
      const lunasSampai = res.rows[0]?.mx ? String(res.rows[0].mx) : null;
      if (!lunasSampai) {
        notes.push(
          `Tidak ada riwayat pembayaran sewa (periode) di database untuk ${occupancyId} — Tunggakan tidak bisa dihitung otomatis, cek manual.`
        );
      } else if (lunasSampai > tanggalCheckoutISO) {
        adaTunggakan = 'Tidak'; // lunas s.d. tanggal setelah checkout
      } else {
        adaTunggakan = 'Ya';
        notes.push(`Sewa lunas s.d. ${lunasSampai} (sudah lewat) — isi Nominal Tunggakan manual.`);
      }
    }
  } catch (e: any) {
    console.error('[checkout-lookup] gagal baca tabel payment:', e?.message);
    notes.push('Gagal membaca riwayat pembayaran dari database — Tunggakan harus dicek manual.');
  }

  return { tglMasuk: tglMasuk || '', adaTunggakan, nominalTunggakan, note: notes.join(' ') };
}

export const autoFillCheckout: AutoFillHandler = async (values) => {
  const penghuni = String(values.penghuni ?? '').trim();
  const tanggalCheckout = String(values.tanggalCheckout ?? '').trim();
  if (!penghuni || !tanggalCheckout) return { fields: {} as Record<string, string> };
  const d = await computeCheckoutDefaults(penghuni, tanggalCheckout);
  return {
    fields: { tglMasuk: d.tglMasuk, adaTunggakan: d.adaTunggakan, nominalTunggakan: d.nominalTunggakan ? String(d.nominalTunggakan) : '' },
    note: d.note || undefined
  };
};
