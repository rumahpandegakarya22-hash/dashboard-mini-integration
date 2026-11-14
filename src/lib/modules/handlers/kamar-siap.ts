import { turso } from '../../core/turso';
import { parseDateTimeLocal, required } from '../../core/validate';
import type { SubmitHandler } from '../types';

/**
 * Tandai kamar siap disewa setelah checkout (kesiapan kamar = kamar_siap_pada - tanggal_checkout).
 * Menulis ke baris checkout_log yang sudah ada; satu checkout hanya bisa ditandai sekali di sini
 * (koreksi lewat Edit).
 */
export const submitKamarSiap: SubmitHandler = async (values, ctx) => {
  const id = Number(required(values.checkout, 'Checkout'));
  if (!Number.isInteger(id) || id <= 0) throw new Error('Checkout tidak valid.');
  const siapPada = parseDateTimeLocal(String(values.kamarSiapPada ?? ''));

  const row = (
    await turso().execute({ sql: 'SELECT tanggal_checkout, kamar_siap_pada FROM checkout_log WHERE id = ?', args: [id] })
  ).rows[0];
  if (!row) throw new Error('Data checkout tidak ditemukan.');
  if (row.kamar_siap_pada) throw new Error('Kamar ini sudah ditandai siap. Ubah waktunya lewat Edit.');
  if (siapPada.slice(0, 10) < String(row.tanggal_checkout).slice(0, 10)) {
    throw new Error('Waktu kamar siap tidak boleh lebih awal dari tanggal checkout.');
  }

  await turso().execute({
    sql: 'UPDATE checkout_log SET kamar_siap_pada = ?, kamar_siap_oleh = ? WHERE id = ?',
    args: [siapPada, ctx.user.username, id]
  });
  return { target: `Turso -> checkout_log (${id})`, row: id, data: { id, kamarSiapPada: siapPada } };
};
