import { readTable } from '../../sheets';
import { SHEETS } from '@/config/spreadsheets';
import { getTenantByLabel, getRoomFresh, getTanggalMasukByKamar } from '../../master';
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

function addMonthsLocal(iso: string, n: number): Date {
  const d = new Date(`${iso}T00:00:00`);
  const day = d.getDate();
  d.setMonth(d.getMonth() + n);
  if (d.getDate() < day) d.setDate(0); // jaga akhir bulan
  return d;
}

/**
 * Hitung default Checkout dari data yg SUDAH ADA (Database Penghuni + Input Sewa Dimuka) — TIDAK
 * pernah menebak. Kalau sumber data belum lengkap (kolom Tanggal Masuk belum ada, atau tidak ada
 * riwayat pembayaran), `note` berisi langkah konkret yg harus dilakukan, dan field terkait
 * dikembalikan kosong supaya admin sadar harus isi manual (bukan diam-diam salah).
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

  // --- Tunggakan: bandingkan "sudah dibayar sampai kapan" (dari Input Sewa Dimuka) vs Tanggal Checkout ---
  const rows = await readTable(SHEETS.LOG_INPUT_TRANSAKSI, "'Input Sewa Dimuka'!A:F");
  const payments = rows.filter((r) => (r['Unit / Penyewa'] || '').trim() === penghuniLabel);

  let adaTunggakan: 'Ya' | 'Tidak' | '' = '';
  let nominalTunggakan = 0;

  if (payments.length === 0) {
    notes.push(
      'Tidak ada riwayat pembayaran (Input Sewa Dimuka) untuk penghuni ini — Tunggakan tidak bisa dihitung otomatis. Cek manual, atau lengkapi dulu pencatatan pembayaran sebelumnya lewat modul Pembayaran Sewa.'
    );
  } else {
    let paidThrough: Date | null = null;
    let lastRate = 0;
    for (const r of payments) {
      const mulaiISO = toISODateFlexible((r['Tanggal Mulai'] || '').trim());
      const bulan = parseInt(r['Jumlah Bulan'] || '0', 10);
      const nomPerBulan = parseInt(String(r['Nominal per Bulan'] || '0').replace(/[^0-9]/g, ''), 10) || 0;
      if (!mulaiISO || !bulan) continue;
      const end = addMonthsLocal(mulaiISO, bulan);
      if (!paidThrough || end.getTime() > paidThrough.getTime()) {
        paidThrough = end;
        lastRate = nomPerBulan;
      }
    }
    if (!paidThrough) {
      notes.push('Riwayat pembayaran ditemukan tapi tanggalnya tidak terbaca — cek manual kolom "Tanggal Mulai" di Input Sewa Dimuka.');
    } else {
      const checkoutDate = new Date(`${tanggalCheckoutISO}T00:00:00`);
      if (checkoutDate.getTime() > paidThrough.getTime()) {
        adaTunggakan = 'Ya';
        const diffDays = Math.ceil((checkoutDate.getTime() - paidThrough.getTime()) / 86400000);
        const monthsOverdue = Math.max(1, Math.ceil(diffDays / 30));
        const rate = lastRate || (await getRoomFresh(tenant.kamar))?.hargaBulan || 0;
        nominalTunggakan = monthsOverdue * rate;
        if (!rate) notes.push('Ada indikasi tunggakan tapi tarif/bulan tidak diketahui — nominal di bawah kemungkinan 0, isi manual.');
      } else {
        adaTunggakan = 'Tidak';
      }
    }
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
