import { parseDateISO, parseRupiah, required } from '../../core/validate';
import { turso } from '../../core/turso';
import { saveLampiran } from './helpers';
import type { SubmitHandler } from '../types';

export const submitAktivitasFinansial: SubmitHandler = async (values, ctx) => {
  const jenisAktivitas = required(values.jenisAktivitas, 'Jenis Aktivitas');

  if (jenisAktivitas === 'Pengeluaran') {
    const tanggal = parseDateISO(String(values.tanggal ?? ''));
    const akunDebit = required(values.akunTujuan, 'COA Tujuan');
    const akunKredit = required(values.akunSumber, 'COA Sumber');
    const nominal = parseRupiah(values.nominal as string | number);
    const keterangan = required(values.keterangan, 'Keterangan');
    const kategori = required(values.kategori, 'Kategori');
    const divisi = required(values.divisi, 'Divisi Pengeluar Biaya');

    const db = turso();
    const kode = async (nama: string) => {
      const r = await db.execute({ sql: 'SELECT kode FROM coa WHERE nama_akun = ?', args: [nama] });
      return r.rows[0]?.kode ?? null;
    };
    const [kodeDebit, kodeKredit] = [await kode(akunDebit), await kode(akunKredit)];
    if (kodeDebit === null || kodeKredit === null) {
      const missing = [kodeDebit === null ? akunDebit : null, kodeKredit === null ? akunKredit : null].filter(Boolean);
      throw new Error(`Akun "${missing.join('", "')}" tidak ditemukan di COA — pengeluaran TIDAK dicatat.`);
    }
    const res = await db.execute({
      sql: 'INSERT INTO jurnal_transaksi (tanggal, akun_debit_kode, akun_kredit_kode, nominal, keterangan, kategori) VALUES (?, ?, ?, ?, ?, ?)',
      args: [tanggal, kodeDebit, kodeKredit, nominal, keterangan, kategori]
    });

    const prefixNota = `NOTA-${tanggal.slice(2, 4)}${tanggal.slice(5, 7)}-${divisi}`;
    const urut = await db.execute({
      sql: `SELECT id_dokumen FROM dokumen WHERE id_dokumen LIKE ? ORDER BY id_dokumen DESC LIMIT 1`,
      args: [`${prefixNota}-%`]
    });
    const terakhir = parseInt(String(urut.rows[0]?.id_dokumen ?? '').slice(-3), 10) || 0;
    const nomorNota = `${prefixNota}-${String(Math.min(terakhir + 1, 999)).padStart(3, '0')}`;

    const lampiranWarning = await saveLampiran(
      { ...values, lampiran: values.lampiranPengeluaran },
      ctx,
      `Nota Pengeluaran — ${keterangan} (${tanggal})`,
      'Admin',
      { idDokumen: nomorNota, penamaan: { jenis: 'Nota', idDocs: nomorNota.replace(/^NOTA-/, '') } }
    );

    return {
      target: 'Turso → jurnal_transaksi',
      row: Number(res.lastInsertRowid ?? -1),
      data: { tanggal, jenisAktivitas, akunDebit, akunKredit, nominal, keterangan, kategori, divisi },
      warning: lampiranWarning || undefined
    };
  }

  // Pemasukan
  const tanggal = parseDateISO(String(values.tanggal ?? ''));
  const namaTransaksi = required(values.namaTransaksi, 'Nama Transaksi');
  const jumlah = parseFloat(String(values.jumlah ?? '0').replace(/[^0-9.-]/g, '')) || 0;
  if (jumlah <= 0) throw new Error('Jumlah nominal harus lebih dari 0.');
  const keterangan = String(values.keteranganPemasukan ?? '').trim();

  const db = turso();
  await db.execute(
    `CREATE TABLE IF NOT EXISTS income_non_rent (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tanggal TEXT NOT NULL,
      nama_transaksi TEXT NOT NULL,
      jumlah REAL NOT NULL DEFAULT 0,
      keterangan TEXT,
      created_by TEXT,
      created_at INTEGER DEFAULT (unixepoch())
    )`
  );
  const res = await db.execute({
    sql: `INSERT INTO income_non_rent (tanggal, nama_transaksi, jumlah, keterangan, created_by) VALUES (?, ?, ?, ?, ?)`,
    args: [tanggal, namaTransaksi, jumlah, keterangan || null, ctx.user.username]
  });
  const id = Number(res.lastInsertRowid ?? 0);

  return {
    target: `income_non_rent_${id}`,
    row: id,
    data: { tanggal, jenisAktivitas, namaTransaksi, jumlah, keterangan }
  };
};
