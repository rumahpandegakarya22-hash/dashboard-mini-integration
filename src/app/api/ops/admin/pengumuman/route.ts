import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, type SessionUser } from '@/lib/core/auth';
import { turso } from '@/lib/core/turso';
import { writeAudit } from '@/lib/core/audit';

/**
 * Kelola papan informasi aplikasi penghuni (pengumuman & peraturan kost).
 *
 * Sebelum ini satu-satunya cara membuat pengumuman adalah POST ke API aplikasi
 * Teman Rara, dan itu menuntut cookie sesi Clerk milik instance Teman Rara —
 * yang tidak dimiliki siapa pun di sisi pengelola. Praktisnya pengumuman tidak
 * pernah bisa dibuat. Halaman ini menutup lubang itu.
 *
 * Penulisan data dilakukan di sini (satu database), tapi PENGIRIMAN push tetap
 * dititipkan ke aplikasi Teman Rara: kunci VAPID dan daftar langganan hanya ada
 * di sana. Kegagalan notifikasi sengaja tidak menggagalkan penyimpanan —
 * pengumumannya tetap tampil saat penghuni membuka aplikasi.
 */

const TIPE = ['announcement', 'rule'] as const;
type Tipe = (typeof TIPE)[number];

const MAKS_JUDUL = 200;
const MAKS_ISI = 10_000;

async function gate() {
  const user = await getSessionUser();
  if (!user) return { error: NextResponse.json({ error: 'Belum login.' }, { status: 401 }) };
  if (user.role !== 'owner' && user.role !== 'staff_admin') {
    return {
      error: NextResponse.json({ error: 'Hanya Owner dan Staff Admin yang bisa mengelola pengumuman.' }, { status: 403 })
    };
  }
  return { user };
}

/** Beri tahu aplikasi penghuni supaya mengirim push. Best-effort. */
async function kirimNotifikasi(id: string): Promise<string | null> {
  const base = process.env.TEMAN_RARA_BASE_URL;
  const secret = process.env.OPS_SHARED_SECRET;
  if (!base || !secret) return 'Notifikasi tidak dikirim: TEMAN_RARA_BASE_URL / OPS_SHARED_SECRET belum diset.';
  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/api/announcements/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ id })
    });
    if (!res.ok) return `Tersimpan, tapi notifikasi gagal dikirim (HTTP ${res.status}).`;
    return null;
  } catch (e) {
    console.error('[pengumuman] notify gagal:', e);
    return 'Tersimpan, tapi aplikasi penghuni tidak bisa dihubungi untuk notifikasi.';
  }
}

function bacaIsi(body: Record<string, unknown>) {
  const tipe = String(body.tipe ?? '').trim();
  const judul = String(body.judul ?? '').trim();
  const isi = String(body.isi ?? '').trim();

  if (!(TIPE as readonly string[]).includes(tipe)) return { error: 'Tipe harus "announcement" atau "rule".' };
  if (judul.length < 3) return { error: 'Judul minimal 3 karakter.' };
  if (judul.length > MAKS_JUDUL) return { error: `Judul maksimal ${MAKS_JUDUL} karakter.` };
  if (isi.length < 3) return { error: 'Isi minimal 3 karakter.' };
  if (isi.length > MAKS_ISI) return { error: `Isi maksimal ${MAKS_ISI} karakter.` };

  const urutanRaw = Number(body.urutan ?? 0);
  const urutan = Number.isFinite(urutanRaw) ? Math.max(0, Math.round(urutanRaw)) : 0;

  return { tipe: tipe as Tipe, judul, isi, urutan };
}

export async function GET(req: NextRequest) {
  const g = await gate();
  if (g.error) return g.error;

  const tipe = req.nextUrl.searchParams.get('tipe');
  const filterTipe = (TIPE as readonly string[]).includes(String(tipe)) ? String(tipe) : null;

  const res = await turso().execute({
    sql: `SELECT id, type, title, content, sort_order, published_at, updated_at, updated_by
          FROM tr_information_board
          WHERE deleted_at IS NULL ${filterTipe ? 'AND type = ?' : ''}
          ORDER BY type, sort_order, published_at DESC
          LIMIT 100`,
    args: filterTipe ? [filterTipe] : []
  });

  return NextResponse.json({
    ok: true,
    data: res.rows.map((r) => ({
      id: String(r.id),
      tipe: String(r.type) as Tipe,
      judul: String(r.title ?? ''),
      isi: String(r.content ?? ''),
      urutan: Number(r.sort_order ?? 0),
      terbit: String(r.published_at ?? '').slice(0, 10),
      diubah: String(r.updated_at ?? '').slice(0, 10),
      diubahOleh: r.updated_by ? String(r.updated_by) : null
    }))
  });
}

export async function POST(req: NextRequest) {
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

  const v = bacaIsi(body);
  if ('error' in v) return NextResponse.json({ error: v.error }, { status: 400 });

  const id = crypto.randomUUID();
  await turso().execute({
    sql: `INSERT INTO tr_information_board (id, type, title, content, sort_order, created_by, updated_by)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [id, v.tipe, v.judul, v.isi, v.urutan, user.username, user.username]
  });

  const peringatan = await kirimNotifikasi(id);

  await writeAudit({
    requestId: `pengumuman-${id}`,
    user,
    moduleId: 'kelola-pengumuman',
    action: 'CREATE',
    target: `Turso → tr_information_board (${id})`,
    newData: { type: v.tipe, title: v.judul, sort_order: v.urutan },
    durationSec: (Date.now() - t0) / 1000,
    status: 'sukses'
  });

  return NextResponse.json({ ok: true, id, peringatan });
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

  const id = String(body.id ?? '').trim();
  if (!id) return NextResponse.json({ error: 'ID wajib diisi.' }, { status: 400 });

  const v = bacaIsi(body);
  if ('error' in v) return NextResponse.json({ error: v.error }, { status: 400 });

  const db = turso();
  const sebelum = await db.execute({
    sql: 'SELECT type, title, content, sort_order FROM tr_information_board WHERE id = ? AND deleted_at IS NULL',
    args: [id]
  });
  if (sebelum.rows.length === 0) return NextResponse.json({ error: 'Entri tidak ditemukan.' }, { status: 404 });

  await db.execute({
    sql: `UPDATE tr_information_board
          SET type = ?, title = ?, content = ?, sort_order = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND deleted_at IS NULL`,
    args: [v.tipe, v.judul, v.isi, v.urutan, user.username, id]
  });

  // Notifikasi hanya dikirim kalau isinya benar-benar berubah — mengubah urutan
  // tampil bukan kabar yang layak membangunkan ponsel penghuni.
  const isiBerubah = String(sebelum.rows[0].title) !== v.judul || String(sebelum.rows[0].content) !== v.isi;
  const peringatan = body.kirimNotifikasi === true && isiBerubah ? await kirimNotifikasi(id) : null;

  await writeAudit({
    requestId: `pengumuman-${id}-${Date.now()}`,
    user,
    moduleId: 'kelola-pengumuman',
    action: 'UPDATE',
    target: `Turso → tr_information_board (${id})`,
    oldData: sebelum.rows[0],
    newData: { type: v.tipe, title: v.judul, sort_order: v.urutan },
    durationSec: (Date.now() - t0) / 1000,
    status: 'sukses'
  });

  return NextResponse.json({ ok: true, id, peringatan });
}

export async function DELETE(req: NextRequest) {
  const g = await gate();
  if (g.error) return g.error;
  const user = g.user as SessionUser;

  const id = String(req.nextUrl.searchParams.get('id') ?? '').trim();
  if (!id) return NextResponse.json({ error: 'ID wajib diisi.' }, { status: 400 });

  // Soft delete: papan informasi ikut jadi jejak apa yang pernah diumumkan ke
  // penghuni, jadi barisnya tidak pernah benar-benar dibuang.
  const res = await turso().execute({
    sql: `UPDATE tr_information_board
          SET deleted_at = CURRENT_TIMESTAMP, deleted_by = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND deleted_at IS NULL`,
    args: [user.username, id]
  });
  if (res.rowsAffected === 0) return NextResponse.json({ error: 'Entri tidak ditemukan.' }, { status: 404 });

  await writeAudit({
    requestId: `pengumuman-del-${id}-${Date.now()}`,
    user,
    moduleId: 'kelola-pengumuman',
    action: 'UPDATE',
    target: `Turso → tr_information_board (${id})`,
    newData: { deleted_at: 'now' },
    status: 'sukses'
  });

  return NextResponse.json({ ok: true, id });
}
