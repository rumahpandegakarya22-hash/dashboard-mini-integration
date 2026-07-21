/* =========================================================================
   Smoke test handler INSERT hasil Wave 2 (Sheets → Turso).

   Menjalankan buildRow tiap modul dengan nilai contoh, lalu INSERT SUNGGUHAN
   ke Turso di dalam TRANSAKSI yang selalu di-ROLLBACK. Tujuannya membuktikan
   nama kolom & CHECK constraint benar-benar cocok dengan skema — sesuatu yang
   tidak bisa dijamin typecheck — TANPA meninggalkan baris apa pun.

   Pakai: npx tsx scripts/smoke-insert-handlers.ts
   ========================================================================= */
import './_env';
import { turso } from '../src/lib/core/turso';
import { surveyInsertCfg } from '../src/lib/modules/handlers/survey';
import { leadsInsertCfg } from '../src/lib/modules/handlers/leads';
import { kontenInsertCfg } from '../src/lib/modules/handlers/konten';
import { promosiInsertCfg } from '../src/lib/modules/handlers/promosi';
import { inspeksiFasilitasInsertCfg } from '../src/lib/modules/handlers/inspeksi-fasilitas';
import { inspeksiKebersihanInsertCfg } from '../src/lib/modules/handlers/inspeksi-kebersihan';
import type { InsertConfig } from '../src/lib/modules/handlers/helpers';

const HARI_INI = new Date().toISOString().slice(0, 10);

const KASUS: { cfg: InsertConfig; values: Record<string, unknown> }[] = [
  {
    cfg: surveyInsertCfg,
    values: {
      tanggalSurvey: HARI_INI, namaCalon: 'SMOKE TEST', noHp: '081234567890',
      dariMana: 'Instagram', kamarDitinjau: '3, 5', jamSurvey: '14:00', durasiMnt: '30',
      feedback: 'uji', keberatan: '', hasilSurvey: 'Tidak Jadi', tindakLanjut: 'Follow Up',
      pic: 'A', tanggalFu: ''
    }
  },
  {
    cfg: leadsInsertCfg,
    values: {
      tanggal: HARI_INI, namaLeads: 'SMOKE TEST', noHp: '081234567890',
      sumberLeads: 'Instagram', platform: 'IG', jenisKamarDicari: 'Classic',
      budget: '1200000', checkinRencana: '', statusLeads: 'Baru',
      tindakLanjut: 'uji', picCs: 'Admin', waktuFollowUp: ''
    }
  },
  {
    cfg: kontenInsertCfg,
    values: {
      tanggalPost: HARI_INI, platform: 'IG Feed', jenisKonten: 'Promo',
      judulCaption: 'SMOKE TEST', visual: 'Foto uji', linkPost: '', jamTayang: '18:00',
      status: 'Draft', likes: '0', komentar: '0', shareSaves: '0', reach: '0', catatan: 'uji'
    }
  },
  {
    cfg: promosiInsertCfg,
    values: {
      tanggalMulai: HARI_INI, tanggalSelesai: '', namaPromosi: 'SMOKE TEST',
      platform: 'IG Ads', tipePromosi: 'Iklan Berbayar', budget: '500000',
      spendAktual: '0', target: '10', leadsAktual: '0', bookingDariPromo: '0',
      status: 'Planned'
    }
  },
  {
    cfg: inspeksiFasilitasInsertCfg,
    values: {
      tanggal: HARI_INI, areaFasilitas: 'Taman', kondisiDitemukan: 'SMOKE TEST',
      kategori: 'Kebersihan', tindakLanjutPerlu: 'Tidak', petugas: 'A', catatan: 'uji'
    }
  },
  {
    cfg: inspeksiKebersihanInsertCfg,
    values: {
      tanggal: HARI_INI, area: 'Taman', hasilKondisi: 'Bersih',
      temuan: 'SMOKE TEST', tindakLanjut: 'uji', petugas: 'Dwi'
    }
  }
];

/** Tabel Wave 3 yang tidak lewat InsertConfig (handler-nya menulis beberapa tabel
 *  sekaligus), jadi diuji dgn INSERT manual mewakili baris yang dihasilkan. */
const KASUS_MANUAL: { tabel: string; sql: string; args: (string | number | null)[] }[] = [
  {
    tabel: 'checkout_log',
    sql: `INSERT INTO checkout_log
            (id_penghuni, penghuni_label, no_kamar, tanggal_checkout, tgl_masuk,
             ada_tunggakan, nominal_tunggakan, pengembalian_deposit,
             kondisi_kamar, catatan_kerusakan, diinput_oleh)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [null, 'SMOKE TEST', '99', HARI_INI, HARI_INI, 'Tidak', 0, 0, 'Baik', 'uji', 'smoke']
  },
  {
    tabel: 'audit_log',
    sql: `INSERT INTO audit_log
            (ts, request_id, username, role, module_id, action, target,
             row_ref, old_data, new_data, duration_sec, status, error)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [new Date().toISOString(), 'smoke', 'smoke', 'owner', 'survey', 'CREATE', 'Turso → survey', 1, null, null, 0.1, 'sukses', null]
  }
];

async function main() {
  const db = turso();
  let ok = 0;
  let gagal = 0;

  for (const { cfg, values } of KASUS) {
    const tx = await db.transaction('write');
    try {
      const row = cfg.buildRow(values);
      const cols = Object.keys(row);
      const res = await tx.execute({
        sql: `INSERT INTO "${cfg.table}" (${cols.map((c) => `"${c}"`).join(', ')})
              VALUES (${cols.map(() => '?').join(', ')})`,
        args: cols.map((c) => row[c])
      });
      // Baca balik di dalam transaksi utk memastikan baris benar-benar terbentuk.
      const cek = await tx.execute({
        sql: `SELECT COUNT(*) AS c FROM "${cfg.table}" WHERE rowid = ?`,
        args: [res.lastInsertRowid ?? 0]
      });
      console.log(`  OK    ${cfg.table.padEnd(22)} ${cols.length} kolom, terbaca balik: ${cek.rows[0].c}`);
      ok++;
    } catch (e: any) {
      console.error(`  GAGAL ${cfg.table.padEnd(22)} ${String(e?.message).slice(0, 120)}`);
      gagal++;
    } finally {
      await tx.rollback(); // SELALU dibatalkan — tidak ada data uji yang tertinggal
    }
  }

  for (const k of KASUS_MANUAL) {
    const tx = await db.transaction('write');
    try {
      await tx.execute({ sql: k.sql, args: k.args });
      console.log(`  OK    ${k.tabel.padEnd(22)} (INSERT manual Wave 3)`);
      ok++;
    } catch (e: any) {
      console.error(`  GAGAL ${k.tabel.padEnd(22)} ${String(e?.message).slice(0, 120)}`);
      gagal++;
    } finally {
      await tx.rollback();
    }
  }

  console.log(`\nRINGKASAN: ${ok} sukses, ${gagal} gagal (semua transaksi di-rollback).`);

  // Buktikan tidak ada sisa: hitung baris bertanda SMOKE TEST.
  for (const t of ['survey', 'leads', 'content', 'promotion', 'inspeksi_fasilitas', 'inspeksi_kebersihan', 'checkout_log', 'audit_log', 'booking']) {
    const r = await db.execute(`SELECT COUNT(*) AS c FROM "${t}"`);
    console.log(`  sisa baris ${t.padEnd(22)}: ${r.rows[0].c}`);
  }
  if (gagal > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
