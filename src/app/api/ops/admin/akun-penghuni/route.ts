import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, type SessionUser } from '@/lib/core/auth';
import { turso } from '@/lib/core/turso';
import { writeAudit } from '@/lib/core/audit';

/**
 * Monitor akun aplikasi penghuni (Teman Rara).
 *
 * Sumber datanya tabel `tr_account`, BUKAN Clerk: kedua aplikasi memakai
 * instance Clerk yang berbeda, jadi Ops tidak bisa membaca daftar user Teman
 * Rara. `tr_account` justru lebih tepat untuk pertanyaan yang mau dijawab —
 * ia yang mengikat akun ke `id_penghuni`, dan ikatan itulah yang menentukan
 * apa yang bisa dilihat seseorang di aplikasi.
 *
 * Dua kondisi yang dicari:
 *   - AKUN GANDA  : lebih dari satu akun aktif untuk kamar yang sama.
 *   - AKUN YATIM  : akun aktif milik orang yang sudah tidak ada di
 *                   `active_tenant` (trigger check-out menghapus barisnya),
 *                   alias mantan penghuni yang akunnya belum dicabut.
 *
 * Mencabut akun mengisi `revoked_at`, dan sesi Teman Rara langsung berhenti
 * lolos pemeriksaan penghuni aktif. Akun Clerk-nya sendiri TIDAK bisa dihapus
 * dari sini — instance-nya beda — tapi tanpa ikatan ini akun itu tidak melihat
 * data kamar mana pun.
 */

async function gate() {
  const user = await getSessionUser();
  if (!user) return { error: NextResponse.json({ error: 'Belum login.' }, { status: 401 }) };
  if (user.role !== 'owner' && user.role !== 'staff_admin') {
    return { error: NextResponse.json({ error: 'Hanya Owner dan Staff Admin yang bisa mengelola akun penghuni.' }, { status: 403 }) };
  }
  return { user };
}

export async function GET() {
  const g = await gate();
  if (g.error) return g.error;

  const res = await turso().execute(
    `SELECT a.id_penghuni, a.clerk_user_id, a.claimed_at, a.revoked_at,
            o.nama, o.no_kamar, o.status AS status_hunian,
            t.kamar_id AS masih_tinggal
     FROM tr_account a
     LEFT JOIN occupancy_history o ON o.id_penghuni = a.id_penghuni
     LEFT JOIN active_tenant   t ON t.id_penghuni = a.id_penghuni
     ORDER BY a.revoked_at IS NOT NULL, CAST(o.no_kamar AS INTEGER), a.claimed_at DESC`
  );

  const baris = res.rows.map((r) => ({
    idPenghuni: String(r.id_penghuni),
    nama: r.nama ? String(r.nama) : '(nama tidak ditemukan)',
    noKamar: r.no_kamar ? String(r.no_kamar) : '',
    diklaim: String(r.claimed_at ?? '').slice(0, 10),
    dicabut: r.revoked_at ? String(r.revoked_at).slice(0, 10) : null,
    aktif: !r.revoked_at,
    masihTinggal: !!r.masih_tinggal
  }));

  // Akun ganda dihitung per KAMAR, bukan per id_penghuni: satu kamar hanya boleh
  // punya satu akun aktif, sementara id_penghuni sudah unik by primary key.
  const perKamar = new Map<string, number>();
  for (const b of baris) {
    if (b.aktif && b.noKamar) perKamar.set(b.noKamar, (perKamar.get(b.noKamar) ?? 0) + 1);
  }

  const data = baris.map((b) => ({
    ...b,
    ganda: b.aktif && b.noKamar ? (perKamar.get(b.noKamar) ?? 0) > 1 : false,
    yatim: b.aktif && !b.masihTinggal
  }));

  const kamarTerisi = await turso().execute('SELECT COUNT(*) AS c FROM active_tenant');

  return NextResponse.json({
    ok: true,
    ringkasan: {
      akunAktif: data.filter((d) => d.aktif).length,
      akunDicabut: data.filter((d) => !d.aktif).length,
      kamarTerisi: Number(kamarTerisi.rows[0]?.c ?? 0),
      ganda: data.filter((d) => d.ganda).length,
      yatim: data.filter((d) => d.yatim).length
    },
    data
  });
}

export async function PATCH(req: NextRequest) {
  const g = await gate();
  if (g.error) return g.error;
  const user = g.user as SessionUser;
  const t0 = Date.now();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body bukan JSON yang valid.' }, { status: 400 });
  }

  const idPenghuni = String(body.idPenghuni ?? '').trim();
  const aksi = String(body.aksi ?? '').trim();
  if (!idPenghuni) return NextResponse.json({ error: 'ID penghuni wajib diisi.' }, { status: 400 });
  if (aksi !== 'cabut' && aksi !== 'pulihkan') {
    return NextResponse.json({ error: 'Aksi harus "cabut" atau "pulihkan".' }, { status: 400 });
  }

  const db = turso();
  const sebelum = await db.execute({
    sql: 'SELECT revoked_at FROM tr_account WHERE id_penghuni = ?',
    args: [idPenghuni]
  });
  if (sebelum.rows.length === 0) return NextResponse.json({ error: 'Akun tidak ditemukan.' }, { status: 404 });

  if (aksi === 'pulihkan') {
    // Memulihkan akun mantan penghuni akan membuka kembali data kamar yang
    // sekarang mungkin ditempati orang lain.
    const masih = await db.execute({
      sql: 'SELECT kamar_id FROM active_tenant WHERE id_penghuni = ?',
      args: [idPenghuni]
    });
    if (masih.rows.length === 0) {
      return NextResponse.json(
        { error: 'Orang ini sudah tidak terdaftar sebagai penghuni aktif — akunnya tidak bisa dipulihkan.' },
        { status: 409 }
      );
    }
  }

  await db.execute({
    sql: 'UPDATE tr_account SET revoked_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id_penghuni = ?',
    args: [aksi === 'cabut' ? new Date().toISOString() : null, idPenghuni]
  });

  await writeAudit({
    requestId: `akun-tr-${idPenghuni}-${Date.now()}`,
    user,
    moduleId: 'akun-penghuni',
    action: 'UPDATE',
    target: `Turso → tr_account (${idPenghuni})`,
    oldData: sebelum.rows[0],
    newData: { aksi },
    durationSec: (Date.now() - t0) / 1000,
    status: 'sukses'
  });

  return NextResponse.json({ ok: true, idPenghuni, aksi });
}
