import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, type SessionUser } from '@/lib/core/auth';
import { turso } from '@/lib/core/turso';
import { writeAudit } from '@/lib/core/audit';

/**
 * Kredensial WiFi per kamar — yang dibaca penghuni di aplikasi Teman Rara.
 *
 * Sebelum ini satu-satunya cara mengisinya adalah INSERT manual ke tabel
 * `tr_kamar_wifi` lewat SQL.
 *
 * Catatan kolom: di database namanya `username`, tapi isinya nama jaringan
 * (SSID) — begitu pula yang ditampilkan aplikasi penghuni. Namanya TIDAK
 * di-rename karena kolomnya sudah berisi data produksi; API ini memakai istilah
 * `ssid` di permukaan supaya layarnya tidak ikut membingungkan.
 */

async function gate() {
  const user = await getSessionUser();
  if (!user) return { error: NextResponse.json({ error: 'Belum login.' }, { status: 401 }) };
  if (user.role !== 'owner' && user.role !== 'staff_admin') {
    return { error: NextResponse.json({ error: 'Hanya Owner dan Staff Admin yang bisa mengelola WiFi.' }, { status: 403 }) };
  }
  return { user };
}

export async function GET() {
  const g = await gate();
  if (g.error) return g.error;

  // LEFT JOIN, bukan INNER: kamar yang BELUM punya kredensial justru yang paling
  // perlu terlihat — penghuninya membuka aplikasi dan menemukan kartu WiFi kosong.
  const res = await turso().execute(
    `SELECT k.id_kamar, k.no_kamar, k.tipe_kamar,
            w.username AS ssid, w.password, w.catatan, w.updated_at, w.updated_by,
            t.nama_lengkap AS penghuni
     FROM kamar k
     LEFT JOIN tr_kamar_wifi w ON w.id_kamar = k.id_kamar
     LEFT JOIN active_tenant t ON t.kamar_id = k.id_kamar
     ORDER BY k.no_kamar`
  );

  return NextResponse.json({
    ok: true,
    data: res.rows.map((r) => ({
      idKamar: String(r.id_kamar),
      noKamar: Number(r.no_kamar ?? 0),
      tipe: r.tipe_kamar ? String(r.tipe_kamar) : '',
      penghuni: r.penghuni ? String(r.penghuni) : null,
      ssid: r.ssid ? String(r.ssid) : '',
      password: r.password ? String(r.password) : '',
      catatan: r.catatan ? String(r.catatan) : '',
      diubah: r.updated_at ? String(r.updated_at).slice(0, 10) : null,
      diubahOleh: r.updated_by ? String(r.updated_by) : null
    }))
  });
}

export async function PUT(req: NextRequest) {
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

  const idKamar = String(body.idKamar ?? '').trim();
  const ssid = String(body.ssid ?? '').trim();
  const password = String(body.password ?? '').trim();
  const catatan = String(body.catatan ?? '').trim();

  if (!idKamar) return NextResponse.json({ error: 'Kamar wajib dipilih.' }, { status: 400 });
  if (!ssid) return NextResponse.json({ error: 'Nama jaringan (SSID) wajib diisi.' }, { status: 400 });
  if (ssid.length > 64) return NextResponse.json({ error: 'Nama jaringan maksimal 64 karakter.' }, { status: 400 });
  if (!password) return NextResponse.json({ error: 'Password wajib diisi.' }, { status: 400 });
  if (password.length > 128) return NextResponse.json({ error: 'Password maksimal 128 karakter.' }, { status: 400 });
  if (catatan.length > 500) return NextResponse.json({ error: 'Catatan maksimal 500 karakter.' }, { status: 400 });

  const db = turso();
  const kamar = await db.execute({ sql: 'SELECT id_kamar FROM kamar WHERE id_kamar = ?', args: [idKamar] });
  if (kamar.rows.length === 0) return NextResponse.json({ error: 'Kamar tidak ditemukan.' }, { status: 404 });

  const sebelum = await db.execute({
    sql: 'SELECT username, password, catatan FROM tr_kamar_wifi WHERE id_kamar = ?',
    args: [idKamar]
  });

  await db.execute({
    sql: `INSERT INTO tr_kamar_wifi (id_kamar, username, password, catatan, updated_by)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(id_kamar) DO UPDATE SET
            username = excluded.username,
            password = excluded.password,
            catatan = excluded.catatan,
            updated_by = excluded.updated_by,
            updated_at = CURRENT_TIMESTAMP`,
    args: [idKamar, ssid, password, catatan || null, user.username]
  });

  await writeAudit({
    requestId: `wifi-${idKamar}-${Date.now()}`,
    user,
    moduleId: 'kelola-wifi',
    action: sebelum.rows.length === 0 ? 'CREATE' : 'UPDATE',
    target: `Turso → tr_kamar_wifi (${idKamar})`,
    // Password TIDAK ikut ditulis ke audit log — kredensial tidak boleh
    // menetap di jejak audit yang dibaca banyak orang.
    oldData: sebelum.rows[0] ? { username: sebelum.rows[0].username } : null,
    newData: { username: ssid, catatan: catatan || null },
    durationSec: (Date.now() - t0) / 1000,
    status: 'sukses'
  });

  return NextResponse.json({ ok: true, idKamar });
}

export async function DELETE(req: NextRequest) {
  const g = await gate();
  if (g.error) return g.error;
  const user = g.user as SessionUser;

  const idKamar = String(req.nextUrl.searchParams.get('idKamar') ?? '').trim();
  if (!idKamar) return NextResponse.json({ error: 'Kamar wajib diisi.' }, { status: 400 });

  const res = await turso().execute({ sql: 'DELETE FROM tr_kamar_wifi WHERE id_kamar = ?', args: [idKamar] });
  if (res.rowsAffected === 0) return NextResponse.json({ error: 'Kamar ini belum punya kredensial.' }, { status: 404 });

  await writeAudit({
    requestId: `wifi-del-${idKamar}-${Date.now()}`,
    user,
    moduleId: 'kelola-wifi',
    action: 'UPDATE',
    target: `Turso → tr_kamar_wifi (${idKamar})`,
    newData: { dihapus: true },
    status: 'sukses'
  });

  return NextResponse.json({ ok: true, idKamar });
}
