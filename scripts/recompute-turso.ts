/* =========================================================================
   Kost Tiga Dara — Recompute Turso (ON-WRITE)

   PORT VERBATIM dari `server/recompute-turso.js` repo Dashboard lama (Fase 2).

   Membaca seluruh tabel dari Turso, menghitung ulang kolom-kolom formula
   (src/lib/dashboard/compute.ts — SATU sumber formula, sama dengan yang dipakai
   runtime; ini menghapus duplikasi on-read vs on-write yang dulu dijaga manual),
   lalu MENULIS BALIK nilai kolom formula ke Turso agar konsisten untuk konsumen
   lain (mis. query manual, BI tool).

   Gunakan ini setelah menambah baris BARU ke Turso, atau berkala.

   Cara pakai (dari root repo):
       # aman: hanya menampilkan apa yang AKAN diubah (tidak menulis)
       npx tsx scripts/recompute-turso.ts

       # benar-benar menulis perubahan ke Turso
       npx tsx scripts/recompute-turso.ts --commit

       # batasi ke tabel tertentu
       npx tsx scripts/recompute-turso.ts --commit --only content,promotion

   ENV (via .env.local): TURSO_DATABASE_URL, TURSO_AUTH_TOKEN.
   ========================================================================= */
import './_env';
import { turso } from '../src/lib/core/turso';
import { readAllTables, isConfigured } from '../src/lib/dashboard/source';
import { computeAll, FORMULA_COLUMNS } from '../src/lib/dashboard/compute';

/* Primary key per tabel (untuk klausa WHERE saat UPDATE). */
const PK: Record<string, string> = {
  kamar: 'id_kamar',
  booking: 'no_booking',
  content: 'id',
  promotion: 'id',
  maintenance_cm: 'id_tiket',
  maintenance_pm: 'id_tiket',
  coa: 'kode',
  jurnal_transaksi: 'id'
};

const argv = process.argv.slice(2);
const COMMIT = argv.includes('--commit');
const onlyIdx = argv.indexOf('--only');
const ONLY =
  onlyIdx >= 0 && argv[onlyIdx + 1] ? argv[onlyIdx + 1].split(',').map((s) => s.trim()) : null;

const norm = (v: any): string => (v === null || v === undefined ? '' : String(v));

async function main() {
  if (!isConfigured()) {
    console.error('✗ TURSO_DATABASE_URL belum di-set (cek .env.local). Batal.');
    process.exit(1);
  }
  console.log(`Mode: ${COMMIT ? 'COMMIT (menulis ke Turso)' : 'DRY-RUN (tidak menulis)'}`);

  const raw = await readAllTables();
  const computed = computeAll(raw);

  let totalCells = 0;
  let totalRows = 0;
  for (const [table, cols] of Object.entries(FORMULA_COLUMNS)) {
    if (ONLY && !ONLY.includes(table)) continue;
    const pk = PK[table];
    if (!pk) {
      console.warn(`- ${table}: tidak ada PK terdaftar, dilewati`);
      continue;
    }

    const rows = computed[table] || [];
    let changedRows = 0;
    let changedCells = 0;
    const updates: { sql: string; args: any[] }[] = [];

    rows.forEach((cr, i) => {
      const orig = raw[table][i];
      const pkVal = cr[pk];
      if (pkVal === null || pkVal === undefined || pkVal === '') return;
      const dirty = cols.filter((col) => norm(cr[col]) !== norm(orig[col]));
      if (!dirty.length) return;
      changedRows++;
      changedCells += dirty.length;
      dirty.forEach((col) => {
        if (changedCells <= 5 || process.env.VERBOSE)
          console.log(
            `   ${table}[${pk}=${pkVal}] ${col}: ${JSON.stringify(orig[col])} → ${JSON.stringify(cr[col])}`
          );
      });
      const setCols = dirty.map((col) => `"${col}" = ?`).join(', ');
      const args = dirty.map((col) => (cr[col] === undefined ? null : cr[col]));
      args.push(pkVal);
      updates.push({ sql: `UPDATE "${table}" SET ${setCols} WHERE "${pk}" = ?`, args });
    });

    totalRows += changedRows;
    totalCells += changedCells;
    console.log(
      `- ${table}: ${changedRows} baris / ${changedCells} sel formula ${COMMIT ? 'diupdate' : 'akan diupdate'}`
    );

    if (COMMIT && updates.length) {
      for (const u of updates) await turso().execute({ sql: u.sql, args: u.args });
    }
  }

  console.log(
    `\nRINGKASAN: ${totalRows} baris, ${totalCells} sel formula ${
      COMMIT
        ? 'berhasil ditulis ke Turso.'
        : 'akan diubah (jalankan ulang dengan --commit untuk menerapkan).'
    }`
  );
}

main().catch((e) => {
  console.error('✗ Error:', e.message);
  process.exit(1);
});
