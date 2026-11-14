import { required } from '../../core/validate';
import { createInsertHandler, type InsertConfig } from './helpers';

/** Dipakai submit dan edit (satu aturan validasi). */
export const vendorInsertCfg: InsertConfig = {
  table: 'vendor',
  target: 'Turso → vendor',
  buildRow: (values) => ({
    nama_vendor: required(values.nama_vendor, 'Nama Vendor'),
    kategori: required(values.kategori, 'Kategori'),
    nomor_telp: required(values.nomor_telp, 'Nomor Telepon'),
    hasil: String(values.hasil ?? '').trim() || null
  })
};

export const submitTambahVendor = createInsertHandler(vendorInsertCfg);
