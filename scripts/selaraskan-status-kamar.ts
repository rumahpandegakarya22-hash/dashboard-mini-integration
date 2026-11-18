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
import { selaraskanStatus, statusSeharusnya } from '../src/lib/kamar-maintenance-db';

async function main() {
  const commit = process.argv.includes('--commit');
  const db = turso();
  const kamar = await db.execute('SELECT no_kamar, status FROM kamar ORDER BY no_kamar');
  let berubah = 0;
  const dilewati: string[] = [];

  for (const r of kamar.rows) {
    const no = String(r.no_kamar);
    const lama = String(r.status ?? '').trim();
    const baru = await statusSeharusnya(db, no);
    if (lama.toLowerCase() === 'maintenance' && baru !== 'Maintenance') {
      dilewati.push(no);
      continue;
    }
    if (lama === baru) continue;
    berubah++;
    console.log(`Kamar ${no}: ${lama || '(kosong)'} → ${baru}`);
    if (commit) await selaraskanStatus(db, no);
  }

  if (dilewati.length) console.log(`Dilewati (Maintenance tanpa pemicu, cek manual): kamar ${dilewati.join(', ')}`);
  console.log(`${berubah} kamar ${commit ? 'diubah' : 'akan berubah (dry-run, tambahkan --commit untuk menulis)'}.`);
  if (commit && berubah) console.log('Cache master kamar kedaluwarsa sendiri maksimal 5 menit.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
