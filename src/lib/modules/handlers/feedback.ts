import { turso } from '../../turso';
import { parseDateISO, required } from '../../validate';
import { getTenantByLabel } from '../../master';
import type { SubmitHandler } from '../types';

/**
 * Feedback (Improvement v1.1 §7) — masuk database Turso, bukan Google Sheets lagi:
 * - Kategori Feedback mengandung "komplain/complain" → tabel `tenant_complain`
 * - selain itu (Saran/Kritik) → tabel `feedback`
 * Kolom `category` kedua tabel ber-CHECK constraint — nilainya dari field kategoriTerkait
 * (pilihan tetap di registry, disamakan persis dgn constraint DB).
 */
export const submitFeedback: SubmitHandler = async (values, ctx) => {
  const tanggal = parseDateISO(String(values.tanggal ?? ''));
  const sumber = required(values.sumber, 'Sumber'); // format baku "KTD-x — Nama"
  const kategoriFeedback = required(values.kategoriFeedback, 'Kategori Feedback');
  const kategoriTerkait = required(values.kategoriTerkait, 'Terkait');
  const isi = required(values.isi, 'Isi');
  const status = required(values.status, 'Status');

  const tenant = await getTenantByLabel(sumber);
  if (!tenant) throw new Error(`Penghuni "${sumber}" tidak ditemukan di Database Penghuni.`);

  const isKomplain = /komplain|complain/i.test(kategoriFeedback);

  if (isKomplain) {
    const idComplain = `CMP-${tanggal.replace(/-/g, '')}-${ctx.requestId.slice(0, 8)}`;
    await turso().execute({
      sql: `INSERT INTO tenant_complain (id_complain, id_penghuni, category, title, description, status, reported_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [idComplain, tenant.id, kategoriTerkait, isi.slice(0, 100), isi, status, tanggal]
    });
    return { target: `Turso → tenant_complain (${idComplain})`, data: { ...values, idComplain, submittedBy: ctx.user.username } };
  }

  const res = await turso().execute({
    sql: `INSERT INTO feedback (id_penghuni, nama, no_kamar, category, deskripsi, status)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [tenant.id, tenant.nama, tenant.kamar, kategoriTerkait, `[${tanggal}] [${kategoriFeedback}] ${isi}`, status]
  });
  return {
    target: 'Turso → feedback',
    row: Number(res.lastInsertRowid ?? -1),
    data: { ...values, submittedBy: ctx.user.username }
  };
};
