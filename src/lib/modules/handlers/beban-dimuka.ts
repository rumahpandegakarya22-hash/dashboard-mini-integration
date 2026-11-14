import type { Transaction } from '@libsql/client';
import { turso } from '../../core/turso';
import { barisBebanDimuka } from '../../jurnal';

export type PengeluaranParams = {
  tanggal: string;
  akunDebit: string;
  akunKredit: string;
  nominal: number;
  keterangan: string;
  kategori: string;
  bebanDimuka: boolean;
  jumlahBulan: number;
};

export type OpsiJurnal = {
  /** Tulis lewat transaksi milik pemanggil (commit/rollback diurus pemanggil), mis. untuk koreksi. */
  tx?: Transaction;
  /** Penanda grup transaksi; baris dibuat dengan grup_id ini supaya bisa di-void/dikoreksi sekaligus. */
  grupId?: string;
  /** grup_id transaksi asal bila ini koreksi. */
  koreksiDari?: string;
};

const SQL_INSERT = `INSERT INTO jurnal_transaksi (tanggal, akun_debit_kode, akun_kredit_kode, nominal, keterangan, kategori, grup_id, koreksi_dari)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

/**
 * Tulis satu pengeluaran ke jurnal. Biasa: 1 baris (debit akun tujuan / kredit sumber dana).
 * Beban dimuka: bayar ke 1170 lalu amortisasi bulanan ke akun beban, semua dalam satu transaksi.
 */
export async function catatPengeluaran(p: PengeluaranParams, opsi: OpsiJurnal = {}): Promise<{ row: number; baris: number }> {
  const db = turso();
  const baca = opsi.tx ?? db;
  const kode = async (nama: string) => {
    const r = await baca.execute({ sql: 'SELECT kode, tipe_akun FROM coa WHERE nama_akun = ?', args: [nama] });
    return r.rows[0] ? { kode: Number(r.rows[0].kode), tipe: String(r.rows[0].tipe_akun ?? '') } : null;
  };
  const [debit, kredit] = [await kode(p.akunDebit), await kode(p.akunKredit)];
  if (!debit || !kredit) {
    const missing = [!debit ? p.akunDebit : null, !kredit ? p.akunKredit : null].filter(Boolean);
    throw new Error(`Akun "${missing.join('", "')}" tidak ditemukan di COA — pengeluaran TIDAK dicatat.`);
  }
  const grup = opsi.grupId ?? null;
  const koreksi = opsi.koreksiDari ?? null;

  if (!p.bebanDimuka) {
    const res = await (opsi.tx ?? db).execute({
      sql: SQL_INSERT,
      args: [p.tanggal, debit.kode, kredit.kode, p.nominal, p.keterangan, p.kategori, grup, koreksi]
    });
    return { row: Number(res.lastInsertRowid ?? -1), baris: 1 };
  }

  if (debit.tipe !== 'Beban' && debit.tipe !== 'Beban Non-Operasional') {
    throw new Error('Beban dimuka: pilih akun tujuan bertipe Beban (akun yang akan menerima amortisasi bulanan).');
  }
  if (!Number.isInteger(p.jumlahBulan) || p.jumlahBulan < 2 || p.jumlahBulan > 240) {
    throw new Error('Beban dimuka: jumlah bulan amortisasi harus bilangan bulat 2–240.');
  }
  const ada = await baca.execute('SELECT 1 FROM coa WHERE kode = 1170');
  if (ada.rows.length === 0) throw new Error('Akun 1170 "Beban Dibayar Dimuka" belum ada di COA. Terapkan db/schema/021_beban_dibayar_dimuka.sql dulu.');

  const baris = barisBebanDimuka({
    tanggal: p.tanggal,
    kodeBeban: debit.kode,
    kodeSumber: kredit.kode,
    nominal: p.nominal,
    jumlahBulan: p.jumlahBulan,
    keterangan: p.keterangan,
    kategori: p.kategori
  });

  const tulis = async (tx: Transaction): Promise<number> => {
    let pertama = -1;
    for (const b of baris) {
      const r = await tx.execute({ sql: SQL_INSERT, args: [b.tanggal, b.debit, b.kredit, b.nominal, b.keterangan, b.kategori, grup, koreksi] });
      if (pertama < 0) pertama = Number(r.lastInsertRowid ?? -1);
    }
    return pertama;
  };

  if (opsi.tx) return { row: await tulis(opsi.tx), baris: baris.length };

  const tx = await db.transaction('write');
  try {
    const pertama = await tulis(tx);
    await tx.commit();
    return { row: pertama, baris: baris.length };
  } catch (e) {
    await tx.rollback().catch(() => {});
    throw e;
  } finally {
    tx.close();
  }
}
