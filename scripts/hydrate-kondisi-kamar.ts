import './_env';
import { turso } from '@/lib/core/turso';

async function main() {
  const db = turso();

  // Ambil semua penghuni aktif
  const tenants = await db.execute(
    'SELECT id_penghuni, nama_lengkap, no_kamar FROM active_tenant'
  );

  if (tenants.rows.length === 0) {
    console.log('Tidak ada penghuni aktif.');
    return;
  }

  // Kolom item awal semua Baik
  const itemCols = Array.from({ length: 26 }, (_, i) => `item${String(i + 1).padStart(2, '0')}_awal`);
  const cols = ['id_penghuni', 'nama_penghuni', 'no_kamar', 'id_kamar', 'status_checkin', ...itemCols].join(', ');
  const placeholders = Array.from({ length: 5 + 26 }, (_, i) => `?${i + 1}`).join(', ');
  const sql = `INSERT OR IGNORE INTO kondisi_kamar (${cols}) VALUES (${placeholders})`;

  let inserted = 0;
  for (const row of tenants.rows) {
    const idPenghuni = row[0] as string;
    const nama = row[1] as string;
    const noKamar = row[2] as number;
    const idKamar = `kamar-${noKamar}`;
    const args = [idPenghuni, nama, noKamar, idKamar, 'Disetujui', ...Array(26).fill('Baik')];
    await db.execute({ sql, args });
    inserted++;
  }

  console.log(`Hydrate selesai: ${inserted} baris kondisi_kamar diinsert.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
