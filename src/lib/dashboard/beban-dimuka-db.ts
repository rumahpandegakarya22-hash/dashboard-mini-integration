import { turso } from '@/lib/core/turso';
import { nowWib } from '@/lib/core/validate';
import { susunBebanDimuka, type BarisJurnalDimuka, type ItemBebanDimuka } from './beban-dimuka';

/**
 * Baca paket beban dimuka dari jurnal. Baris yang sudah di-void (asli maupun pembaliknya) tidak ikut,
 * sehingga paket yang dibatalkan hilang dari daftar dan paket koreksinya tampil sebagai item baru.
 */
export async function loadBebanDimuka(): Promise<ItemBebanDimuka[]> {
  try {
    const rs = await turso().execute(
      `SELECT j.tanggal, d.nama_akun AS debit, k.nama_akun AS kredit, j.nominal, j.keterangan, j.grup_id
       FROM jurnal_transaksi j
       LEFT JOIN coa d ON d.kode = j.akun_debit_kode
       LEFT JOIN coa k ON k.kode = j.akun_kredit_kode
       WHERE j.grup_id IN (SELECT grup_id FROM jurnal_transaksi WHERE keterangan LIKE 'Bayar dimuka%' AND grup_id IS NOT NULL)
         AND j.dibalik_oleh IS NULL AND j.void_dari IS NULL`
    );
    const rows: BarisJurnalDimuka[] = rs.rows.map((r) => ({
      tanggal: String(r.tanggal ?? '').slice(0, 10),
      akunDebit: String(r.debit ?? ''),
      akunKredit: String(r.kredit ?? ''),
      nominal: Number(r.nominal) || 0,
      keterangan: String(r.keterangan ?? ''),
      grupId: String(r.grup_id ?? '')
    }));
    return susunBebanDimuka(rows, nowWib().slice(0, 10));
  } catch (e) {
    console.error('[dashboard] gagal baca beban dimuka:', e);
    return [];
  }
}
