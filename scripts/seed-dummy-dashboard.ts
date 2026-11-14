/* =========================================================================
   Isi data DUMMY agar semua chart dashboard terisi (periode Jun-Nov 2026).

   Semua baris diberi tanda "DUMMY" di kolom teks (atau awalan id "DUMMY-")
   sehingga mudah dikenali dan bisa dihapus bersih:

       npx tsx scripts/seed-dummy-dashboard.ts                   # dry-run: hitung baris
       npx tsx scripts/seed-dummy-dashboard.ts --commit          # isi
       npx tsx scripts/seed-dummy-dashboard.ts --hapus           # dry-run hapus
       npx tsx scripts/seed-dummy-dashboard.ts --hapus --commit  # hapus semua baris DUMMY

   Sengaja TIDAK menyentuh tabel keuangan, tenant_docs, dan penghuni nyata, dan
   memakai id mantan penghuni (akun Teman Rara sudah dicabut) untuk tabel ber-FK.
   ========================================================================= */
import './_env';
import type { InStatement } from '@libsql/client';
import { turso } from '../src/lib/core/turso';

const commit = process.argv.includes('--commit');
const hapus = process.argv.includes('--hapus');

let seed = 20261114;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pilih = <T,>(a: T[]): T => a[Math.floor(rnd() * a.length)];
const antara = (a: number, b: number) => Math.round(a + rnd() * (b - a));
const p2 = (n: number) => String(n).padStart(2, '0');
const tgl = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const jam = (d: Date) => `${tgl(d)} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
const hariKe = (n: number) => new Date(2026, 5, 1 + n); // 1 Jun 2026 + n
const SELISIH = 165; // sampai 13 Nov 2026

const ins = (sql: string, args: (string | number | null)[]): InStatement => ({ sql, args });
const rows: InStatement[] = [];

/* ---- leads (masuk_pada + chat_pertama_pada) ---- */
const channel = [
  ['Instagram', 'Story IG'], ['Instagram', 'Reels'], ['TikTok', 'TikTok Ads'], ['Referral', 'Teman penghuni'],
  ['WhatsApp', 'Broadcast'], ['Website', 'Landing page']
];
const bobot = [0, 0, 0, 1, 1, 2, 2, 3, 4, 5, 0, 1];
const nLeads = 60;
for (let i = 0; i < nLeads; i++) {
  const d = hariKe(Math.floor((i / nLeads) * SELISIH) + antara(0, 3));
  d.setHours(antara(8, 21), antara(0, 59));
  const [sumber, plat] = channel[bobot[i % bobot.length]];
  const status = i % 7 === 0 ? 'Closing' : i % 3 === 0 ? 'Survey' : i % 11 === 0 ? 'Lost' : 'Follow-up';
  const chat = i % 9 === 4 ? null : new Date(d.getTime() + antara(3, 45) * 60000);
  rows.push(
    ins(
      `INSERT INTO leads (tanggal, nama_leads, no_hp_wa, sumber_leads, platform, kamar_dicari, budget, status_leads, tindak_lanjut, pic, keterangan, masuk_pada, chat_pertama_pada)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [tgl(d), `DUMMY Leads ${i + 1}`, `81000000${p2(i + 1)}`, sumber, plat, pilih(['Eco', 'Classic', 'Comfy']), pilih([1200000, 1500000, 1800000]), status, 'DUMMY', 'Admin', 'DUMMY', jam(d), chat ? jam(chat) : null]
    )
  );
}

/* ---- survey (sebagian cocok dengan nomor leads status Survey) ---- */
const nSurvey = 40;
for (let i = 0; i < nSurvey; i++) {
  const d = hariKe(Math.floor((i / nSurvey) * SELISIH) + antara(2, 6));
  rows.push(
    ins(
      `INSERT INTO survey (id_survey, tanggal_survey, nama_calon_penyewa, no_hp, sumber, kamar_ditinjau, hasil_survey, keberatan_kendala, feedback, pic)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [`DUMMY-S${p2(i + 1)}`, tgl(d), `DUMMY Calon ${i + 1}`, `81000000${p2(1 + ((i * 3) % nLeads))}`, pilih(['Instagram', 'TikTok', 'Referral', 'Website']), pilih(['Eco', 'Classic']), pilih(['Tertarik', 'Pikir-pikir', 'Cocok']), pilih(['Harga', 'Lokasi', 'Ukuran kamar', 'Fasilitas']), 'DUMMY', 'Admin']
    )
  );
}

/* ---- promosi ---- */
const promo = [
  ['Promo Awal Semester', 'Instagram Ads', 600000, 540000, 20, 18, 4],
  ['Voucher Mahasiswa Baru', 'TikTok Ads', 800000, 760000, 25, 21, 5],
  ['Referral Penghuni', 'Multi-Platform', 300000, 250000, 10, 9, 3],
  ['Diskon Lebaran Kampus', 'Instagram Ads', 500000, 470000, 18, 12, 2],
  ['Open House Kost', 'Website', 400000, 380000, 15, 14, 3],
  ['Promo Akhir Tahun', 'TikTok Ads', 700000, 330000, 22, 11, 2]
] as const;
promo.forEach((p, i) => {
  const mulai = hariKe(i * 26 + 3);
  const selesai = hariKe(i * 26 + 20);
  rows.push(
    ins(
      `INSERT INTO promotion (tgl_mulai, tgl_selesai, nama_promosi, platform, tipe, budget, spend_aktual, target_leads, leads_aktual, booking_dr_promo, status, cpl)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [tgl(mulai), tgl(selesai), `DUMMY ${p[0]}`, p[1], 'Iklan Berbayar', p[2], p[3], p[4], p[5], p[6], i === 5 ? 'Berjalan' : 'Selesai', Math.round(p[3] / p[5])]
    )
  );
});

/* ---- konten (jangkauan -> aksi) ---- */
const nKonten = 18;
for (let i = 0; i < nKonten; i++) {
  const d = hariKe(Math.floor((i / nKonten) * SELISIH) + antara(0, 5));
  const reach = antara(900, 9000);
  const likes = Math.round(reach * (0.04 + rnd() * 0.05));
  const kom = Math.round(likes * 0.08);
  const sh = Math.round(likes * 0.2);
  const post = i % 9 !== 4;
  rows.push(
    ins(
      `INSERT INTO content (tgl_post, platform, tipe_konten, judul_caption, jam, status, likes, komentar, share_saves, reach, engagement, er_persen, biaya_produksi, catatan)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [tgl(d), pilih(['Instagram Reels', 'Instagram Feed', 'TikTok']), pilih(['Video Tour', 'Foto Kamar', 'Testimoni']), `DUMMY Konten ${i + 1}`, '18:00', post ? 'Posted' : 'Terjadwal', post ? likes : 0, post ? kom : 0, post ? sh : 0, post ? reach : 0, post ? likes + kom + sh : 0, post ? Math.round(((likes + kom + sh) / reach) * 10000) / 100 : 0, antara(40, 150) * 1000, 'DUMMY']
    )
  );
}

/* ---- tiket korektif / preventif ---- */
const lokasi = ['AC Kamar 5', 'Keran KM Lt 2', 'Lampu Koridor', 'AC Kamar 12', 'Pintu Kamar 8', 'Keran KM Lt 2', 'Kulkas Dapur'];
for (let i = 0; i < 10; i++) {
  const d = hariKe(Math.floor((i / 10) * SELISIH) + 4);
  const durasi = i % 4 === 3 ? antara(4, 6) : antara(0, 2);
  const selesai = new Date(d.getTime() + durasi * 86400000);
  rows.push(
    ins(
      `INSERT INTO maintenance_cm (id_tiket, no_urut, tanggal_kerusakan, tanggal_lapor, tanggal_selesai, sumber_laporan, lokasi_item, kategori, penyebab, kode, deskripsi_kerusakan, prioritas, pelaksana, vendor, biaya, status, durasi_perbaikan_hari, sla)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [`DUMMY-CM-${p2(i + 1)}`, 900 + i, tgl(d), tgl(d), tgl(selesai), 'Laporan Penghuni', lokasi[i % lokasi.length], pilih(['Elektrikal dan Elektronik', 'Plumbing', 'Furniture dan Interior']), 'Wear and Tear', 'ELK', 'DUMMY', pilih(['Tinggi', 'Sedang']), 'Teknisi', 'DUMMY', antara(40, 300) * 1000, 'Selesai', durasi, durasi <= 3 ? 'OK' : 'BREACH']
    )
  );
}
for (let i = 0; i < 12; i++) {
  const d = hariKe(Math.floor((i / 12) * SELISIH) + 1);
  const telat = i % 5 === 4;
  rows.push(
    ins(
      `INSERT INTO maintenance_pm (id_tiket, no_urut, tanggal_lapor, tanggal_selesai, sumber_laporan, lokasi_item, kategori, penyebab, kode, deskripsi_kerusakan, prioritas, pelaksana, vendor, biaya, status, durasi_perbaikan_hari, sla)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [`DUMMY-PM-${p2(i + 1)}`, 900 + i, tgl(d), tgl(new Date(d.getTime() + (telat ? 3 : 0) * 86400000)), 'Jadwal rutin', 'Perawatan Berkala', 'Elektrikal dan Elektronik', 'Wear and Tear', 'ELK', 'DUMMY', 'Sedang', 'Teknisi', 'DUMMY', antara(20, 120) * 1000, 'Selesai', telat ? 3 : 0, '-']
    )
  );
}

/* ---- inspeksi harian (kebersihan), sebagian hari dilewati ---- */
for (let n = 0; n <= SELISIH; n++) {
  if (n % 9 === 5) continue;
  rows.push(
    ins(`INSERT INTO inspeksi_kebersihan (tanggal, area, hasil_kondisi, temuan, tindak_lanjut, petugas) VALUES (?,?,?,?,?,?)`, [tgl(hariKe(n)), pilih(['KM Barat Lt 2', 'Koridor Lt 1', 'Dapur Lt 1']), pilih(['Bersih', 'Bersih', 'Cukup']), 'DUMMY', '', 'Petugas'])
  );
}

/* ---- pengaduan & kepuasan: id_penghuni wajib ada di occupancy_history (FK). Dipakai mantan penghuni
   yang akunnya sudah dicabut, jadi tidak muncul di Teman Rara. ---- */
function bangunPenghuni(ex: string[]) {
for (let i = 0; i < 10; i++) {
  const d = hariKe(Math.floor((i / 10) * SELISIH) + 5);
  d.setHours(antara(8, 20), antara(0, 59));
  const respons = new Date(d.getTime() + antara(20, 150) * 60000);
  rows.push(
    ins(
      `INSERT INTO tenant_complain (id_complain, id_penghuni, category, title, description, status, reported_at, responded_at, resolved_at, response_note, responded_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [`DUMMY-C${p2(i + 1)}`, ex[i % ex.length], pilih(['Fasilitas', 'Pelayanan', 'kebersihan']), `DUMMY Pengaduan ${i + 1}`, 'DUMMY', 'Selesai', jam(d), jam(respons), tgl(respons), 'DUMMY', 'DUMMY']
    )
  );
}

/* ---- kepuasan penghuni ---- */
for (const periode of ['2026-09', '2026-10', '2026-11']) {
  for (let i = 0; i < ex.length; i++) {
    rows.push(ins(`INSERT INTO csat_response (id_penghuni, periode, skor, komentar, dicatat_oleh) VALUES (?,?,?,?,?)`, [ex[i % ex.length], periode, pilih([3, 4, 4, 5, 5]), 'DUMMY', 'DUMMY']));
  }
}

}

/* ---- kesiapan kamar ---- */
[['2026-07-10', 20], ['2026-08-22', 30], ['2026-10-02', 14]].forEach(([c, jamSiap], i) => {
  const co = new Date(`${c}T10:00:00`);
  rows.push(
    ins(
      `INSERT INTO checkout_log (id_penghuni, penghuni_label, no_kamar, tanggal_checkout, ada_tunggakan, nominal_tunggakan, pengembalian_deposit, kondisi_kamar, diinput_oleh, kamar_siap_pada, kamar_siap_oleh)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [null, `DUMMY — checkout ${i + 1}`, 'DUMMY', String(c), 'Tidak', 0, 0, 'Baik', 'DUMMY', jam(new Date(co.getTime() + Number(jamSiap) * 3600000)), 'DUMMY']
    )
  );
});

/* ---- hapus ---- */
const hapusSql = [
  `DELETE FROM leads WHERE keterangan LIKE 'DUMMY%'`,
  `DELETE FROM survey WHERE id_survey LIKE 'DUMMY-%'`,
  `DELETE FROM promotion WHERE nama_promosi LIKE 'DUMMY%'`,
  `DELETE FROM content WHERE judul_caption LIKE 'DUMMY%'`,
  `DELETE FROM maintenance_cm WHERE id_tiket LIKE 'DUMMY-%'`,
  `DELETE FROM maintenance_pm WHERE id_tiket LIKE 'DUMMY-%'`,
  `DELETE FROM inspeksi_kebersihan WHERE temuan LIKE 'DUMMY%'`,
  `DELETE FROM tenant_complain WHERE id_complain LIKE 'DUMMY-%'`,
  `DELETE FROM csat_response WHERE dicatat_oleh = 'DUMMY'`,
  `DELETE FROM checkout_log WHERE penghuni_label LIKE 'DUMMY%'`
];

(async () => {
  const exRes = await turso().execute(`SELECT DISTINCT id_penghuni FROM occupancy_history WHERE id_penghuni IS NOT NULL AND id_penghuni NOT IN (SELECT id_penghuni FROM active_tenant WHERE id_penghuni IS NOT NULL) LIMIT 8`);
  const ex = exRes.rows.map((r) => String(r.id_penghuni));
  if (!ex.length) throw new Error('Tidak ada mantan penghuni di occupancy_history untuk dipakai FK.');
  bangunPenghuni(ex);
  const stmts: InStatement[] = hapus ? hapusSql.map((s) => ({ sql: s, args: [] })) : [...hapusSql.map((s) => ({ sql: s, args: [] })), ...rows];
  console.log(`${hapus ? 'HAPUS' : 'ISI'}: ${stmts.length} statement (${hapus ? hapusSql.length : rows.length} baris dummy)${commit ? '' : ' — DRY-RUN, tambahkan --commit untuk menulis'}`);
  if (!commit) return;
  await turso().batch(stmts, 'write');
  console.log('Selesai.');
})();
