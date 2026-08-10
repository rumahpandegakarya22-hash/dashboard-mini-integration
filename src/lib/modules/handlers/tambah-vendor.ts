import { required } from '../../core/validate';
import { turso } from '../../core/turso';
import type { SubmitHandler } from '../types';

export const submitTambahVendor: SubmitHandler = async (values) => {
  const namaVendor = required(values.nama_vendor, 'Nama Vendor');
  const kategori = required(values.kategori, 'Kategori');
  const nomorTelp = required(values.nomor_telp, 'Nomor Telepon');
  const hasil = String(values.hasil ?? '').trim();

  const db = turso();
  const res = await db.execute({
    sql: 'INSERT INTO vendor (nama_vendor, kategori, nomor_telp, hasil) VALUES (?, ?, ?, ?)',
    args: [namaVendor, kategori, nomorTelp, hasil || null]
  });

  return {
    target: `vendor_${res.lastInsertRowid}`,
    row: Number(res.lastInsertRowid ?? 0),
    data: { namaVendor, kategori, nomorTelp, hasil }
  };
};
