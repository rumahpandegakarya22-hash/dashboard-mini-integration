/* =========================================================================
   Kost Tiga Dara — Seed occupancy_history (Retention Rate)

   PORT VERBATIM dari `server/seed-occupancy-history.js` repo Dashboard lama.

   occupancy_history menentukan Retention Rate & AVG Durasi Sewa di overview
   Sales. Tabel ini bukan dihitung — isinya HARUS diketik manual dari riwayat
   penghuni yang sudah keluar (dan yang masih tinggal, untuk avg durasi).
   Edit array RECORDS di bawah, lalu jalankan.

   Kolom: id_penghuni (opsional) | nama | no_kamar | tanggal_mulai (YYYY-MM-DD)
          | tanggal_selesasi (YYYY-MM-DD, kosongkan "" bila masih tinggal)

   Cara pakai:
       npx tsx scripts/seed-occupancy-history.ts            # dry-run
       npx tsx scripts/seed-occupancy-history.ts --commit    # benar-benar INSERT
   ========================================================================= */
import './_env';
import { turso } from '../src/lib/core/turso';
import { isConfigured } from '../src/lib/dashboard/source';

interface OccupancyRecord {
  id_penghuni?: string;
  nama: string;
  no_kamar: number | string;
  tanggal_mulai: string;
  tanggal_selesasi?: string;
}

/* ---- ISI DI SINI: satu baris = satu penghuni (aktif atau sudah keluar) ---- */
const RECORDS: OccupancyRecord[] = [
  // { id_penghuni: "", nama: "Contoh Nama", no_kamar: 5, tanggal_mulai: "2024-01-10", tanggal_selesasi: "2024-09-10" },
];

const COMMIT = process.argv.includes('--commit');

async function main() {
  if (!isConfigured()) {
    console.error('✗ TURSO_DATABASE_URL belum di-set (cek .env.local). Batal.');
    process.exit(1);
  }
  if (!RECORDS.length) {
    console.log('RECORDS kosong — edit array di scripts/seed-occupancy-history.ts dulu.');
    return;
  }
  console.log(`Mode: ${COMMIT ? 'COMMIT (menulis ke Turso)' : 'DRY-RUN (tidak menulis)'}`);
  console.log(`${RECORDS.length} baris akan di-insert ke occupancy_history:`);

  for (const r of RECORDS) {
    console.log(
      `  ${r.nama} · kamar ${r.no_kamar} · ${r.tanggal_mulai} → ${r.tanggal_selesasi || '(masih tinggal)'}`
    );
    if (COMMIT) {
      await turso().execute({
        sql: `INSERT INTO "occupancy_history" ("id_penghuni","nama","no_kamar","tanggal_mulai","tanggal_selesasi") VALUES (?,?,?,?,?)`,
        args: [r.id_penghuni || null, r.nama, r.no_kamar, r.tanggal_mulai, r.tanggal_selesasi || null]
      });
    }
  }

  console.log(
    COMMIT ? '\n✓ Selesai ditulis ke Turso.' : '\nJalankan ulang dengan --commit untuk benar-benar menulis.'
  );
}

main().catch((e) => {
  console.error('✗ Error:', e.message);
  process.exit(1);
});
