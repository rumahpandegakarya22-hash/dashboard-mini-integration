/* =========================================================================
   Data dummy untuk UAT fitur baru (Daftar Booking, Pre/Approval Check-in &
   Check-out). SEMUA baris ditandai jelas sebagai dummy:
     - id_penghuni : 'DUMMY-UAT-01' dst
     - no_booking  : 'DUMMY-UAT-B01' dst
     - nama        : diawali '[DUMMY UAT] '

   Pakai (dari root repo):
       npx tsx scripts/seed-uat-dummy.ts            # DRY-RUN (tampilkan rencana)
       npx tsx scripts/seed-uat-dummy.ts --commit   # tulis ke Turso
       npx tsx scripts/seed-uat-dummy.ts --clean --commit   # hapus semua dummy

   Idempoten: --commit menghapus dulu baris dummy lama lalu menulis ulang.
   ENV via .env.local: TURSO_DATABASE_URL, TURSO_AUTH_TOKEN.
   ========================================================================= */
import './_env';
import { turso } from '../src/lib/core/turso';

const args = process.argv.slice(2);
const commit = args.includes('--commit');
const cleanOnly = args.includes('--clean');

const TODAY = '2026-08-12';

type Dummy = {
  idp: string;
  booking: string;
  nama: string;
  hp: string;
  status_booking: string;
  fase: 'awal' | 'akhir';
  status_checkin: 'Draft' | 'Menunggu' | 'Disetujui' | 'Ditolak';
  status_checkout: 'Draft' | 'Menunggu' | 'Disetujui' | 'Ditolak';
  skenario: string;
};

const DUMMIES: Dummy[] = [
  {
    idp: 'DUMMY-UAT-01', booking: 'DUMMY-UAT-B01', nama: '[DUMMY UAT] Budi Santoso',
    hp: '081200000001', status_booking: 'Booking', fase: 'awal',
    status_checkin: 'Menunggu', status_checkout: 'Draft',
    skenario: 'Pre-Check In terisi, MENUNGGU approval check-in',
  },
  {
    idp: 'DUMMY-UAT-02', booking: 'DUMMY-UAT-B02', nama: '[DUMMY UAT] Citra Lestari',
    hp: '081200000002', status_booking: 'Booking', fase: 'awal',
    status_checkin: 'Disetujui', status_checkout: 'Draft',
    skenario: 'Check-in DISETUJUI, tombol Check-in di Daftar Booking aktif',
  },
  {
    idp: 'DUMMY-UAT-03', booking: 'DUMMY-UAT-B03', nama: '[DUMMY UAT] Dewi Anggraini',
    hp: '081200000003', status_booking: 'Check-in', fase: 'akhir',
    status_checkin: 'Disetujui', status_checkout: 'Menunggu',
    skenario: 'Pre-Check Out terisi, MENUNGGU approval check-out',
  },
];

async function clean() {
  const db = turso();
  await db.execute({ sql: `DELETE FROM kondisi_kamar WHERE id_penghuni LIKE 'DUMMY-UAT-%'`, args: [] });
  await db.execute({ sql: `DELETE FROM booking WHERE no_booking LIKE 'DUMMY-UAT-%'`, args: [] });
  await db.execute({ sql: `DELETE FROM occupancy_history WHERE id_penghuni LIKE 'DUMMY-UAT-%'`, args: [] });
}

async function main() {
  const db = turso();

  // Ambil nomor kamar asli supaya FK booking.kamar_no valid.
  const kamarRes = await db.execute('SELECT no_kamar FROM kamar ORDER BY no_kamar LIMIT 3');
  const kamarNos = kamarRes.rows.map((r) => Number(r[0]));
  while (kamarNos.length < 3) kamarNos.push(kamarNos[kamarNos.length - 1] ?? 1);

  console.log(`Mode   : ${cleanOnly ? 'CLEAN' : 'SEED'} — ${commit ? 'COMMIT (menulis)' : 'DRY-RUN'}`);
  console.log(`Kamar  : ${kamarNos.join(', ')}\n`);

  for (const d of DUMMIES) {
    console.log(`  ${d.idp} / ${d.booking} — ${d.nama}`);
    console.log(`     → ${d.skenario}`);
  }

  if (!commit) {
    console.log('\nDRY-RUN. Tambahkan --commit untuk menulis, atau --clean --commit untuk menghapus.');
    return;
  }

  // Selalu bersihkan dulu (idempoten).
  await clean();
  if (cleanOnly) {
    console.log('\nSemua baris DUMMY-UAT-* dihapus.');
    return;
  }

  for (let i = 0; i < DUMMIES.length; i++) {
    const d = DUMMIES[i];
    const kamar = kamarNos[i];

    await db.execute({
      sql: `INSERT INTO occupancy_history (id_penghuni, nama, no_kamar, tanggal_mulai, status)
            VALUES (?, ?, ?, ?, 'Aktif')`,
      args: [d.idp, d.nama, String(kamar), TODAY],
    });

    await db.execute({
      sql: `INSERT INTO booking (no_booking, id_penghuni, tanggal_booking, nama_penyewa, no_hp,
                                 kamar_no, tgl_masuk, durasi_bulan, harga_disepakati, status_booking, deposit)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1500000, ?, 500000)`,
      args: [d.booking, d.idp, TODAY, d.nama, d.hp, kamar, TODAY, d.status_booking],
    });

    // Isi beberapa item kondisi supaya preview tidak kosong.
    const faseCols = d.fase === 'awal'
      ? `item01_awal, item02_awal, item03_awal, catatan_awal, tanggal_cek_awal`
      : `item01_awal, item01_akhir, item02_akhir, item03_akhir, catatan_akhir, tanggal_cek_awal, tanggal_cek_akhir`;
    const faseVals = d.fase === 'awal'
      ? `'Baik', 'Baik', 'Perlu Perbaikan', '[DUMMY UAT] catatan awal', ?`
      : `'Baik', 'Baik', 'Rusak', 'Perlu Perbaikan', '[DUMMY UAT] catatan akhir', ?, ?`;
    const faseArgs = d.fase === 'awal' ? [TODAY] : [TODAY, TODAY];

    await db.execute({
      sql: `INSERT INTO kondisi_kamar
              (id_kamar, no_kamar, id_penghuni, nama_penghuni, pic,
               ${faseCols}, status_checkin, status_checkout)
            VALUES (?, ?, ?, ?, '[DUMMY UAT] Inspektor', ${faseVals}, ?, ?)`,
      args: [`K${kamar}`, kamar, d.idp, d.nama, ...faseArgs, d.status_checkin, d.status_checkout],
    });
  }

  console.log('\nSelesai. 3 penghuni + 3 booking + 3 kondisi_kamar dummy dibuat.');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
