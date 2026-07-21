/* =========================================================================
   Wave 0 (langkah 2-4) — seed master dari Google Sheets ke Turso, SEKALI jalan.

   Mengisi:
     1. settings       ← tab 'SETTING' tiap spreadsheet (semua kolom dropdown)
     2. invoice_harga  ← INVOICE_SEWA / INVOICE_DP tab 'Data' blok F2:K5
     3. kamar.listrik  ← DATABASE_PENGHUNI tab 'DATA' kolom "Listrik"

   DRY-RUN default (konvensi recompute-turso.ts). Idempoten: memakai
   INSERT OR IGNORE / UPDATE, jadi aman dijalankan ulang.

   Pakai (dari root repo):
       npx tsx scripts/seed-master-from-sheets.ts
       npx tsx scripts/seed-master-from-sheets.ts --commit
       npx tsx scripts/seed-master-from-sheets.ts --only settings

   ENV (via .env.local): TURSO_*, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY.
   ========================================================================= */
import './_env';
import { turso } from '../src/lib/core/turso';
import { readTable, readRange } from '../src/lib/core/sheets';
import { SHEETS } from '../src/config/spreadsheets';

const args = process.argv.slice(2);
const commit = args.includes('--commit');
const onlyArg = args.indexOf('--only');
const only = onlyArg >= 0 ? (args[onlyArg + 1] || '').split(',').filter(Boolean) : [];
const want = (name: string) => only.length === 0 || only.includes(name);

const num = (v: any): number => {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(String(v).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

/* Spreadsheet yang punya tab SETTING. `grup` = kunci SHEETS, dipakai apa adanya
   oleh master 'setting:<GRUP>:SETTING:<Kolom>' supaya registry.ts tak perlu diubah. */
const SETTING_SOURCES: { grup: string; id: string }[] = [
  { grup: 'LOG_SALES', id: SHEETS.LOG_SALES },
  { grup: 'LOG_MARKETING', id: SHEETS.LOG_MARKETING },
  { grup: 'LOG_INSPEKSI_PERAWATAN', id: SHEETS.LOG_INSPEKSI_PERAWATAN },
  { grup: 'LOGBOOK_INSPEKSI_KEBERSIHAN', id: SHEETS.LOGBOOK_INSPEKSI_KEBERSIHAN },
  { grup: 'LOGBOOK_FEEDBACK', id: SHEETS.LOGBOOK_FEEDBACK }
];

async function seedSettings(): Promise<void> {
  console.log('\n=== 1. settings ===');
  let total = 0;
  for (const src of SETTING_SOURCES) {
    if (!src.id) {
      console.log(`  ${src.grup}: (id kosong, dilewati)`);
      continue;
    }
    let rows: Record<string, string>[];
    try {
      rows = await readTable(src.id, "'SETTING'!A:Z");
    } catch (e: any) {
      console.log(`  ${src.grup}: GAGAL baca tab SETTING — ${e?.message}`);
      continue;
    }
    if (rows.length === 0) {
      console.log(`  ${src.grup}: kosong`);
      continue;
    }
    const headers = Object.keys(rows[0]).filter((h) => h.trim() !== '');
    for (const kolom of headers) {
      const seen = new Set<string>();
      const nilai: string[] = [];
      for (const r of rows) {
        const v = String(r[kolom] ?? '').trim();
        if (!v || seen.has(v)) continue;
        seen.add(v);
        nilai.push(v);
      }
      if (nilai.length === 0) continue;
      console.log(`  ${src.grup} / ${kolom}: ${nilai.length} nilai`);
      total += nilai.length;
      if (!commit) continue;
      for (let i = 0; i < nilai.length; i++) {
        await turso().execute({
          sql: 'INSERT OR IGNORE INTO settings (grup, kolom, nilai, urutan) VALUES (?, ?, ?, ?)',
          args: [src.grup, kolom, nilai[i], i]
        });
      }
    }
  }
  console.log(`  → total ${total} nilai dropdown`);
}

/* Master tarif Invoice Generator. Dibaca POSISIONAL persis seperti master.ts:
   blok F2:K5 → baris pertama = header durasi (G:K), baris berikutnya = tipe + harga. */
async function seedInvoiceHarga(): Promise<void> {
  console.log('\n=== 2. invoice_harga ===');
  const sumber: { jenis: 'Sewa' | 'DP'; id: string }[] = [
    { jenis: 'Sewa', id: SHEETS.INVOICE_SEWA },
    { jenis: 'DP', id: SHEETS.INVOICE_DP }
  ];
  let total = 0;
  for (const s of sumber) {
    if (!s.id) {
      console.log(`  ${s.jenis}: (id kosong, dilewati)`);
      continue;
    }
    let block: string[][];
    try {
      block = await readRange(s.id, "'Data'!F2:K5");
    } catch (e: any) {
      console.log(`  ${s.jenis}: GAGAL baca blok harga — ${e?.message}`);
      continue;
    }
    const durasiRow = block[0] || [];
    const durasi = durasiRow
      .slice(1)
      .map((v) => Number(v))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (durasi.length === 0) {
      console.log(`  ${s.jenis}: tidak ada kolom durasi terbaca`);
      continue;
    }
    for (let i = 1; i < block.length; i++) {
      const tipe = String(block[i]?.[0] ?? '').trim();
      if (!tipe) continue;
      for (let j = 0; j < durasi.length; j++) {
        const harga = num(block[i][j + 1]);
        if (harga <= 0) continue;
        console.log(`  ${s.jenis} / ${tipe} / ${durasi[j]} bln = ${harga}`);
        total++;
        if (!commit) continue;
        await turso().execute({
          sql: `INSERT INTO invoice_harga (jenis, tipe_kamar, durasi_bulan, harga) VALUES (?, ?, ?, ?)
                ON CONFLICT (jenis, tipe_kamar, durasi_bulan) DO UPDATE SET harga = excluded.harga`,
          args: [s.jenis, tipe, durasi[j], harga]
        });
      }
    }
  }
  console.log(`  → total ${total} baris tarif`);
}

async function seedListrik(): Promise<void> {
  console.log('\n=== 3. kamar.listrik ===');
  if (!SHEETS.DATABASE_PENGHUNI) {
    console.log('  (DATABASE_PENGHUNI kosong, dilewati)');
    return;
  }
  const rows = await readTable(SHEETS.DATABASE_PENGHUNI, "'DATA'!A:Z");
  if (rows.length === 0) {
    console.log('  kosong');
    return;
  }
  const headers = Object.keys(rows[0]);
  const findH = (...cands: string[]) =>
    headers.find((h) => cands.some((c) => h.toLowerCase().trim() === c.toLowerCase()));
  const hKamar = findH('No Kamar', 'no. kamar', 'kamar');
  const hListrik = findH('Listrik');
  if (!hKamar || !hListrik) {
    console.log(`  kolom tidak ketemu (kamar=${hKamar}, listrik=${hListrik}) — dilewati`);
    return;
  }
  let total = 0;
  const seen = new Set<string>();
  for (const r of rows) {
    const kamar = String(r[hKamar] ?? '').trim();
    if (!kamar || seen.has(kamar)) continue;
    seen.add(kamar);
    const listrik = num(r[hListrik]);
    if (listrik <= 0) continue;
    console.log(`  kamar ${kamar} → listrik ${listrik}`);
    total++;
    if (!commit) continue;
    await turso().execute({
      sql: 'UPDATE kamar SET listrik = ? WHERE no_kamar = ?',
      args: [listrik, kamar]
    });
  }
  console.log(`  → total ${total} kamar`);
}

async function main() {
  console.log(`Mode: ${commit ? 'COMMIT (menulis ke Turso)' : 'DRY-RUN (tidak menulis)'}`);
  if (only.length) console.log(`Hanya: ${only.join(', ')}`);

  if (want('settings')) await seedSettings();
  if (want('invoice_harga')) await seedInvoiceHarga();
  if (want('listrik')) await seedListrik();

  console.log(
    commit
      ? '\nSelesai — data tertulis ke Turso.'
      : '\nDRY-RUN selesai. Jalankan ulang dengan --commit untuk menulis.'
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
