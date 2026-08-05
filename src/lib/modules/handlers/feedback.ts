import { turso } from '../../core/turso';
import { parseDateISO, required } from '../../core/validate';
import { getTenantByLabel } from '../../master';
import type { SubmitHandler } from '../types';

/**
 * Feedback — SEMUA jenis (Saran, Kritik, Komplain) masuk `tenant_complain`,
 * dibedakan kolom `tipe` (migrasi 003).
 *
 * Dulu Saran & Kritik dialihkan ke tabel `feedback` terpisah, sehingga panel
 * review pengaduan — yang membaca tenant_complain — tidak pernah menampilkannya
 * (temuan UAT #5). Kolom `category` tetap berisi hal yang dikeluhkan
 * (Kebersihan, Fasilitas, dst), bukan tipe feedbacknya.
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

  const idComplain = `CMP-${tanggal.replace(/-/g, '')}-${ctx.requestId.slice(0, 8)}`;
  await turso().execute({
    sql: `INSERT INTO tenant_complain (id_complain, id_penghuni, tipe, category, title, description, status, reported_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [idComplain, tenant.id, kategoriFeedback, kategoriTerkait, isi.slice(0, 100), isi, status, tanggal]
  });
  return {
    target: `Turso → tenant_complain (${idComplain})`,
    data: { ...values, idComplain, submittedBy: ctx.user.username }
  };
};
