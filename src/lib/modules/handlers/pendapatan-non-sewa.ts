import { parseDateISO, required } from '../../core/validate';
import { turso } from '../../core/turso';
import type { SubmitHandler } from '../types';

export const submitPendapatanNonSewa: SubmitHandler = async (values, ctx) => {
  const tanggal = parseDateISO(String(values.tanggal ?? ''));
  const namaTransaksi = required(values.namaTransaksi, 'Nama Transaksi');
  const jumlah = parseFloat(String(values.jumlah ?? '0').replace(/[^0-9.-]/g, '')) || 0;
  if (jumlah <= 0) throw new Error('Jumlah nominal harus lebih dari 0.');
  const keterangan = String(values.keterangan ?? '').trim();

  const db = turso();

  // Buat tabel kalau belum ada (idempoten)
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
    sql: `INSERT INTO income_non_rent (tanggal, nama_transaksi, jumlah, keterangan, created_by)
          VALUES (?, ?, ?, ?, ?)`,
    args: [tanggal, namaTransaksi, jumlah, keterangan || null, ctx.user.username]
  });

  const id = Number(res.lastInsertRowid ?? 0);

  return {
    target: `income_non_rent_${id}`,
    row: id,
    data: { id, tanggal, namaTransaksi, jumlah, keterangan }
  };
};
