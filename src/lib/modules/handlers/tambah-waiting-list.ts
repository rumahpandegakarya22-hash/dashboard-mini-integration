import { required } from '../../core/validate';
import { createInsertHandler, type InsertConfig } from './helpers';

/** Dipakai submit dan edit (satu aturan validasi). link_whatsapp diturunkan dari nomor. */
export const waitingListInsertCfg: InsertConfig = {
  table: 'waiting_list',
  target: 'Turso → waiting_list',
  buildRow: (values) => {
    const nomorWhatsapp = required(values.nomor_whatsapp, 'Nomor WhatsApp');
    const digits = nomorWhatsapp.replace(/\D/g, '');
    const waNum = digits.startsWith('0') ? '62' + digits.slice(1) : digits;
    return {
      nama: required(values.nama, 'Nama'),
      nomor_whatsapp: nomorWhatsapp,
      link_whatsapp: `https://wa.me/${waNum}`,
      tipe: String(values.tipe ?? '').trim() || null,
      rencana_tanggal: String(values.rencana_tanggal ?? '').trim() || null,
      budget_max: parseFloat(String(values.budget_max ?? '').replace(/[^0-9.-]/g, '')) || null,
      status: String(values.status ?? 'Menunggu'),
      keterangan: String(values.keterangan ?? '').trim() || null
    };
  }
};

export const submitTambahWaitingList = createInsertHandler(waitingListInsertCfg);
