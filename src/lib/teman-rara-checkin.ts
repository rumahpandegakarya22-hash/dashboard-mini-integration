import { turso } from '@/lib/core/turso';
import { galatNopol, namaKendaraanBersih, normalisasiNopol } from '@/lib/kendaraan';

/* Trigger check-in hanya membuat baris dasar (nama, HP, kamar, tanggal). Data diri
   yang diisi penghuni di form Teman Rara (tr_pendaftaran) disalin di sini ke
   booking (kendaraan), occupancy_history (kendaraan) dan active_tenant (semua).
   Hanya kolom yang masih kosong yang diisi, jadi koreksi manual admin tidak tertimpa.
   Mengembalikan peringatan (string kosong bila semua beres). */
const KOSONG = (kol: string) => `(${kol} IS NULL OR TRIM(${kol}) = '')`;

const KOLOM_TENANT: [string, string][] = [
  ['nama_panggilan', 'nama_panggilan'],
  ['pekerjaan', 'pekerjaan'],
  ['instansi', 'institusi'],
  ['asal_daerah', 'asal_daerah'],
  ['nama_kontak_darurat_1', 'darurat1_nama'],
  ['nomor_darurat_1', 'darurat1_nomor'],
  ['hubungan_kontak_darurat_1', 'darurat1_relasi'],
  ['nama_kontak_darurat_2', 'darurat2_nama'],
  ['nomor_darurat_2', 'darurat2_nomor'],
  ['hubungan_kontak_darurat_2', 'darurat2_relasi'],
  ['link_identitas', 'url_identitas']
];

export async function salinDariTemanRara(noBooking: string): Promise<string> {
  const db = turso();
  const tr = (await db.execute({ sql: 'SELECT * FROM tr_pendaftaran WHERE no_booking = ?', args: [noBooking] })).rows[0];
  if (!tr) return '';
  const bk = (await db.execute({ sql: 'SELECT id_penghuni FROM booking WHERE no_booking = ?', args: [noBooking] })).rows[0];
  const idPenghuni = String(bk?.id_penghuni ?? '');
  if (!idPenghuni) return 'Data Teman Rara belum disalin: id penghuni belum terbentuk.';

  const stmts: { sql: string; args: (string | null)[] }[] = [];
  let peringatan = '';

  const nopol = normalisasiNopol(tr.nopol);
  const namaKendaraan = namaKendaraanBersih(tr.nama_kendaraan);
  if (nopol && galatNopol(nopol)) {
    peringatan = `Nopol dari Teman Rara (${nopol}) tidak dikenali formatnya — isi manual di Ubah Data Penghuni.`;
  } else if (nopol || namaKendaraan) {
    const pakai = nopol
      ? (await db.execute({ sql: 'SELECT nama_lengkap, no_kamar FROM active_tenant WHERE nopol = ? AND id_penghuni <> ? LIMIT 1', args: [nopol, idPenghuni] })).rows[0]
      : undefined;
    if (pakai) {
      peringatan = `Nopol ${nopol} sudah terdaftar atas ${String(pakai.nama_lengkap)} (Kamar ${String(pakai.no_kamar)}) — nopol tidak disalin.`;
    } else {
      const set = 'nopol = ?, nama_kendaraan = ?';
      stmts.push({ sql: `UPDATE booking SET ${set} WHERE no_booking = ? AND ${KOSONG('nopol')}`, args: [nopol || null, namaKendaraan || null, noBooking] });
      for (const t of ['occupancy_history', 'active_tenant']) {
        stmts.push({ sql: `UPDATE ${t} SET ${set} WHERE id_penghuni = ? AND ${KOSONG('nopol')}`, args: [nopol || null, namaKendaraan || null, idPenghuni] });
      }
    }
  }

  for (const [kolomTenant, kolomTr] of KOLOM_TENANT) {
    const nilai = String(tr[kolomTr] ?? '').trim();
    if (!nilai) continue;
    stmts.push({ sql: `UPDATE active_tenant SET ${kolomTenant} = ? WHERE id_penghuni = ? AND ${KOSONG(kolomTenant)}`, args: [nilai, idPenghuni] });
  }

  if (stmts.length) await db.batch(stmts, 'write');
  return peringatan;
}
