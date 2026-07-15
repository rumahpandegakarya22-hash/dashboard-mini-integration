import { getTenantByLabel, getTanggalMasukByKamar } from '../../master';
import { turso } from '../../turso';
import type { AutoFillHandler } from '../types';

export interface CheckoutDefaults {
  tglMasuk: string; // '' kalau tidak ditemukan otomatis
  adaTunggakan: 'Ya' | 'Tidak' | ''; // '' = tidak bisa dihitung (tidak ada riwayat pembayaran)
  nominalTunggakan: number;
  note: string; // penjelasan/langkah manual, '' kalau semua lengkap
}

/** Terima 'yyyy-mm-dd', 'd/m/yyyy', atau format tanggal umum lain dari Sheets → ISO, null kalau gagal. */
function toISODateFlexible(raw: string): string | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return null;
}

/** Status payment yang dihitung sebagai tunggakan (belum lunas). */
const STATUS_TUNGGAKAN = ['Pending', 'Partial', 'Overdue'];

/**
 * Hitung default Checkout dari data yg SUDAH ADA — TIDAK pernah menebak.
 * Tunggakan (Improvement v1.1 §2): dari tabel Turso `payment` (database kost-tiga-dara,
 * bersama Dashboard) berdasarkan ID unik penghuni (`Tenant.id` = "KTD-x" = payment.id_penghuni).
 * Invoice berstatus belum lunas (Pending/Partial/Overdue) dijumlahkan jadi Nominal Tunggakan.
 * Kalau sumber data belum lengkap, `note` berisi langkah konkret dan field dikembalikan kosong
 * supaya admin sadar harus isi manual (bukan diam-diam salah).
 */
export async function computeCheckoutDefaults(penghuniLabel: string, _tanggalCheckoutISO: string): Promise<CheckoutDefaults> {
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

  // --- Tunggakan: total invoice belum lunas di tabel payment untuk ID penghuni ini ---
  let adaTunggakan: 'Ya' | 'Tidak' | '' = '';
  let nominalTunggakan = 0;
  try {
    const res = await turso().execute({
      sql: 'SELECT status, amount FROM payment WHERE id_penghuni = ?',
      args: [tenant.id]
    });
    if (res.rows.length === 0) {
      notes.push(
        `Tidak ada riwayat pembayaran di database untuk ${tenant.id} — Tunggakan tidak bisa dihitung otomatis, cek manual.`
      );
    } else {
      const outstanding = res.rows
        .filter((r) => STATUS_TUNGGAKAN.includes(String(r.status)))
        .reduce((sum, r) => sum + Number(r.amount ?? 0), 0);
      adaTunggakan = outstanding > 0 ? 'Ya' : 'Tidak';
      nominalTunggakan = Math.round(outstanding);
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
