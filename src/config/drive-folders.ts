/* =========================================================================
   Peta folder Google Drive per role Dashboard — untuk POST /api/dashboard/documents.

   PENTING (temuan Fase 3): di repo Dashboard lama, peta ini dibaca dari
   `data/drive-config.json`. Berkas itu **TIDAK ADA** di repo, sehingga
   `/api/documents` SELALU membalas 503 `{ setup: true }` — fitur "buat dokumen
   Drive" praktis mati di deployment yang berjalan sekarang.

   Port ini mempertahankan perilaku itu persis (503 bila belum dikonfigurasi),
   tetapi memindahkan sumber konfigurasi dari berkas ke ENV. Alasan: berkas di
   `data/` tidak cocok untuk serverless — filesystem Vercel read-only dan tidak
   ikut ter-deploy kecuali di-commit, sedangkan ID folder lebih tepat jadi
   konfigurasi environment.

   Untuk MENGAKTIFKAN fitur ini, isi ENV berikut dengan ID folder Drive yang
   sudah di-share ke service account (GOOGLE_SERVICE_ACCOUNT_EMAIL):
     DRIVE_FOLDER_ROLE_OWNER, DRIVE_FOLDER_ROLE_ADMIN, DRIVE_FOLDER_ROLE_MARKETING,
     DRIVE_FOLDER_ROLE_OPERASIONAL, DRIVE_FOLDER_ROLE_SALES
   Role yang ENV-nya kosong tetap membalas 503 — sama seperti perilaku lama.

   Catatan: JANGAN tertukar dengan DRIVE_FOLDER_PENGHUNI/PEMBAYARAN/NOTA/
   FEEDBACK/MAINTENANCE, yang dipakai upload bukti Mini App Ops.
   ========================================================================= */

import type { DashboardRole } from './dashboard-access';

export const DRIVE_FOLDER_BY_ROLE: Record<DashboardRole, string | undefined> = {
  owner: process.env.DRIVE_FOLDER_ROLE_OWNER,
  admin: process.env.DRIVE_FOLDER_ROLE_ADMIN,
  marketing: process.env.DRIVE_FOLDER_ROLE_MARKETING,
  operasional: process.env.DRIVE_FOLDER_ROLE_OPERASIONAL,
  sales: process.env.DRIVE_FOLDER_ROLE_SALES
};

export function driveFolderFor(role: DashboardRole): string | undefined {
  return DRIVE_FOLDER_BY_ROLE[role];
}
