import { required } from '../../core/validate';
import { turso } from '../../core/turso';
import type { SubmitHandler } from '../types';

export const submitTambahWaitingList: SubmitHandler = async (values) => {
  const nama = required(values.nama, 'Nama');
  const nomorWhatsapp = required(values.nomor_whatsapp, 'Nomor WhatsApp');
  const tipe = String(values.tipe ?? '').trim();
  const rencanaTanggal = String(values.rencana_tanggal ?? '').trim();
  const budgetMax = parseFloat(String(values.budget_max ?? '').replace(/[^0-9.-]/g, '')) || null;
  const status = String(values.status ?? 'Menunggu');
  const keterangan = String(values.keterangan ?? '').trim();

  const digits = nomorWhatsapp.replace(/\D/g, '');
  const waNum = digits.startsWith('0') ? '62' + digits.slice(1) : digits;
  const linkWhatsapp = `https://wa.me/${waNum}`;

  const db = turso();
  const res = await db.execute({
    sql: 'INSERT INTO waiting_list (nama, nomor_whatsapp, link_whatsapp, tipe, rencana_tanggal, budget_max, status, keterangan) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    args: [nama, nomorWhatsapp, linkWhatsapp, tipe || null, rencanaTanggal || null, budgetMax, status, keterangan || null]
  });

  return {
    target: `waiting_list_${res.lastInsertRowid}`,
    row: Number(res.lastInsertRowid ?? 0),
    data: { nama, nomorWhatsapp, tipe, rencanaTanggal, budgetMax, status, keterangan }
  };
};
