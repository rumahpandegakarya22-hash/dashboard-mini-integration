/* =========================================================================
   Selaraskan status SEMUA kamar dengan keadaan sebenarnya: penghuni aktif → Terisi,
   booking Pending/Konfirmasi → Booking, pemicu Maintenance terbuka → Maintenance, selain itu Kosong.

   Dipakai sekali setelah aturan status kamar baru dipasang (booking sebelumnya tidak pernah menulis
   status "Booking"). Kamar yang tertulis Maintenance TANPA pemicu terbuka (mis. diisi manual di database)
   TIDAK diubah, hanya dilaporkan — mungkin memang sedang dikerjakan.

   Pakai:  npx tsx scripts/selaraskan-status-kamar.ts            (dry-run, hanya menampilkan perubahan)
           npx tsx scripts/selaraskan-status-kamar.ts --commit   (menulis)
   ========================================================================= */
import './_env';
import { turso } from '../src/lib/core/turso';
import { selaraskanSemua } from '../src/lib/kamar-maintenance-db';

async function main() {
  const commit = process.argv.includes('--commit');
  const hasil = await selaraskanSemua(turso(), commit);
  for (const p of hasil.perubahan) console.log(`Kamar ${p.no}: ${p.dari} → ${p.ke}`);
  if (hasil.dilewati.length) console.log(`Dilewati (Maintenance tanpa pemicu, cek manual): kamar ${hasil.dilewati.join(', ')}`);
  console.log(`${hasil.perubahan.length} kamar ${commit ? 'diubah' : 'akan berubah (dry-run, tambahkan --commit untuk menulis)'}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
