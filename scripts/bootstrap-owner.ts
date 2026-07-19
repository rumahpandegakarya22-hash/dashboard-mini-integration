/* =========================================================================
   Kost Tiga Dara — Bootstrap akun Owner

   PORT dari `server/bootstrap-owner.js` repo Dashboard lama (Fase 2).

   Jalankan SEKALI SAJA saat akun pertama ter-ban otomatis oleh webhook Clerk
   versi lama (yang dulu memanggil banUser — ternyata fitur Pro-only, jadi akun
   baru langsung terkunci dan tombol "Unban" di Clerk Dashboard juga minta
   upgrade). Webhook versi sekarang TIDAK memanggil banUser lagi.

   Script ini memakai CLERK_SECRET_KEY (Backend API) untuk:
     1. Coba unban akun (best-effort — abaikan kalau API menolak).
     2. Set publicMetadata { role: "owner", status: "active" } supaya akun ini
        langsung bisa login sebagai Owner.

   Cara pakai:
     npx tsx scripts/bootstrap-owner.ts <username>

   PENYIMPANGAN PORT (dicatat di docs/MIGRASI.md):
   - Klien Clerk diambil dari `@clerk/nextjs/server`, bukan `@clerk/express`
     (paket Express tidak ikut ke app terpadu).
   - Script ini hanya menyetel namespace DASHBOARD (`role`/`status`), sesuai
     perilaku lama. Di app terpadu ada namespace kedua (`miniappRole`/
     `miniappStatus`) yang TIDAK disentuh di sini — lihat catatan Fase 3.
   ========================================================================= */
import './_env';
import { createClerkClient } from '@clerk/nextjs/server';

async function main() {
  const username = process.argv[2];
  if (!username) {
    console.error('Pemakaian: npx tsx scripts/bootstrap-owner.ts <username>');
    process.exit(1);
  }
  if (!process.env.CLERK_SECRET_KEY) {
    console.error('CLERK_SECRET_KEY belum di-set di .env.local — isi dulu (lihat README).');
    process.exit(1);
  }
  const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

  const list = await clerkClient.users.getUserList({ username: [username] });
  const u = (list.data || [])[0];
  if (!u) {
    console.error(`Akun dengan username "${username}" tidak ditemukan di Clerk.`);
    process.exit(1);
  }

  try {
    await clerkClient.users.unbanUser(u.id);
    console.log('Unban berhasil.');
  } catch (e: any) {
    console.warn(
      'Unban gagal (kemungkinan fitur ban/unban Pro-only di paket Anda) — dilanjutkan tanpa unban:',
      e.message
    );
    console.warn(
      'Kalau akun masih tidak bisa login setelah ini, hapus akun via Clerk Dashboard → Users → ⋯ → Delete, lalu daftar ulang.'
    );
  }

  await clerkClient.users.updateUserMetadata(u.id, {
    publicMetadata: { role: 'owner', status: 'active' }
  });
  console.log(`Akun "${username}" sekarang berstatus active dengan role owner. Coba login lagi.`);
}

main().catch((e) => {
  console.error('Gagal:', e.message);
  process.exit(1);
});
