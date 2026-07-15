import { appendRow, assertHeaders } from '../../sheets';
import { SHEETS } from '@/config/spreadsheets';
import { parseDateISO, parseRupiah, required } from '../../validate';
import { turso } from '../../turso';
import { saveLampiran } from './helpers';
import type { SubmitHandler } from '../types';

// Kolom A:F sheet "Transaksi" (Log Input Transaksi). Kolom G+ berformula, tidak ditulis (PRD §6 Modul 5).
// Header berikut TEBAKAN dari PRD, belum diverifikasi — assertHeaders menolak submit dgn pesan jelas jika beda.
const HEADER_RANGE = "'Transaksi'!A1:F1";
const EXPECTED_HEADERS = ['Tanggal', 'Akun Debit', 'Akun Kredit', 'Nominal', 'Keterangan', 'Kategori'];

/**
 * Improvement v1.1 §6 (Pemakaian Stok & Pencatatan Keuangan): selain ke sheet, jurnal juga
 * dicatat ke tabel Turso `jurnal_transaksi` (ledger Dashboard) — kode akun dicari di `coa`
 * by nama. Best-effort: sheet adalah pencatatan utama, gagal tulis DB → warning, bukan batal.
 */
async function catatJurnalTurso(
  tanggal: string,
  akunDebit: string,
  akunKredit: string,
  nominal: number,
  keterangan: string,
  kategori: string
): Promise<string | undefined> {
  try {
    const db = turso();
    const kode = async (nama: string) => {
      const r = await db.execute({ sql: 'SELECT kode FROM coa WHERE nama_akun = ?', args: [nama] });
      return r.rows[0]?.kode ?? null;
    };
    const [kodeDebit, kodeKredit] = [await kode(akunDebit), await kode(akunKredit)];
    if (kodeDebit === null || kodeKredit === null) {
      const missing = [kodeDebit === null ? akunDebit : null, kodeKredit === null ? akunKredit : null].filter(Boolean);
      return `Tercatat di sheet, tapi TIDAK masuk database keuangan: akun "${missing.join('", "')}" tidak ditemukan di COA.`;
    }
    await db.execute({
      sql: 'INSERT INTO jurnal_transaksi (tanggal, akun_debit_kode, akun_kredit_kode, nominal, keterangan, kategori) VALUES (?, ?, ?, ?, ?, ?)',
      args: [tanggal, kodeDebit, kodeKredit, nominal, keterangan, kategori]
    });
    return undefined;
  } catch (e: any) {
    console.error('[pengeluaran] gagal tulis jurnal_transaksi:', e?.message);
    return 'Tercatat di sheet, tapi gagal masuk database keuangan (jurnal_transaksi) — cek koneksi database.';
  }
}

export const submitPengeluaran: SubmitHandler = async (values, ctx) => {
  const tanggal = parseDateISO(String(values.tanggal ?? ''));
  const akunDebit = required(values.akunDebit, 'Kategori Pengeluaran');
  const akunKredit = required(values.dibayarDari, 'Dibayar Dari');
  const nominal = parseRupiah(values.nominal as string | number);
  const keterangan = required(values.keterangan, 'Keterangan');
  const kategori = required(values.kategori, 'Kategori');

  await assertHeaders(SHEETS.LOG_INPUT_TRANSAKSI, HEADER_RANGE, EXPECTED_HEADERS);
  const row = await appendRow(SHEETS.LOG_INPUT_TRANSAKSI, "'Transaksi'!A:F", [
    tanggal,
    akunDebit,
    akunKredit,
    nominal,
    keterangan,
    kategori
  ]);

  const jurnalWarning = await catatJurnalTurso(tanggal, akunDebit, akunKredit, nominal, keterangan, kategori);
  const lampiranWarning = await saveLampiran(values, ctx, `Nota Pengeluaran — ${keterangan} (${tanggal})`, 'Admin');

  return {
    target: 'Log Input Transaksi → Transaksi',
    row,
    data: { tanggal, akunDebit, akunKredit, nominal, keterangan, kategori },
    warning: [jurnalWarning, lampiranWarning].filter(Boolean).join(' ') || undefined
  };
};
