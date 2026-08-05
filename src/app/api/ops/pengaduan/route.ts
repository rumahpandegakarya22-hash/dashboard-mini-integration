import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/core/auth';
import { canAccess } from '@/lib/core/roles';
import { turso } from '@/lib/core/turso';
import { writeAudit } from '@/lib/core/audit';
import { isStatusPengaduan, normalisasiStatus, STATUS_TERBUKA } from '@/lib/core/complain';
import { getPenghuniByIds, labelPenghuni, urlBerkas } from '@/lib/teman-rara';

/**
 * Merespons pengaduan penghuni (dilaporkan dari aplikasi Teman Rara).
 *
 * Akses disamakan dengan modul 'feedback' — panelnya memang menempel di
 * halaman modul itu, jadi tidak ada aturan otorisasi kedua yang harus dijaga
 * agar tetap sinkron.
 *
 * SENGAJA TIDAK menyentuh `tr_complain_sync`: tabel itu penanda "status apa
 * yang terakhir sudah dinotifikasikan ke penghuni". Cron harian Teman Rara
 * membandingkannya dengan status terkini dan mengirim push kalau berbeda.
 * Kalau Ops ikut memperbaruinya, perubahan status ini jadi tidak pernah
 * terkirim ke penghuni.
 */

const LIMIT = 50;

async function gate() {
  const user = await getSessionUser();
  if (!user) return { error: NextResponse.json({ error: 'Belum login.' }, { status: 401 }) };
  if (!canAccess(user.role, 'feedback')) {
    return { error: NextResponse.json({ error: 'Divisi kamu tidak menangani pengaduan penghuni.' }, { status: 403 }) };
  }
  return { user };
}

export async function GET(req: NextRequest) {
  const g = await gate();
  if (g.error) return g.error;

  const semua = req.nextUrl.searchParams.get('filter') === 'semua';
  const res = await turso().execute({
    sql: `SELECT id_complain, id_penghuni, tipe, category, title, description, status,
                 reported_at, resolved_at, response_note, responded_by, responded_at
          FROM tenant_complain
          ${semua ? '' : `WHERE status IN (${STATUS_TERBUKA.map(() => '?').join(', ')})`}
          ORDER BY reported_at DESC, id_complain DESC
          LIMIT ${LIMIT}`,
    args: semua ? [] : STATUS_TERBUKA
  });

  const ids = res.rows.map((r) => String(r.id_penghuni));
  const penghuni = await getPenghuniByIds(ids);

  // Foto diambil sekali untuk seluruh halaman, bukan per baris (hindari N+1).
  const foto = new Map<string, string[]>();
  if (res.rows.length > 0) {
    const idComplains = res.rows.map((r) => String(r.id_complain));
    const f = await turso().execute({
      sql: `SELECT id_complain, file_url FROM tr_complain_photo
            WHERE id_complain IN (${idComplains.map(() => '?').join(', ')})`,
      args: idComplains
    });
    for (const r of f.rows) {
      const key = String(r.id_complain);
      const url = urlBerkas(String(r.file_url));
      if (!url) continue;
      foto.set(key, [...(foto.get(key) ?? []), url]);
    }
  }

  const data = res.rows.map((r) => {
    const id = String(r.id_complain);
    const idp = String(r.id_penghuni);
    return {
      id,
      penghuni: labelPenghuni(penghuni.get(idp), idp),
      tipe: String(r.tipe ?? 'Komplain'),
      kategori: String(r.category ?? ''),
      judul: String(r.title ?? ''),
      isi: String(r.description ?? ''),
      status: normalisasiStatus(String(r.status ?? '')),
      dilaporkan: String(r.reported_at ?? '').slice(0, 10),
      selesai: r.resolved_at ? String(r.resolved_at).slice(0, 10) : null,
      tanggapan: r.response_note ? String(r.response_note) : '',
      ditanggapiOleh: r.responded_by ? String(r.responded_by) : null,
      ditanggapiPada: r.responded_at ? String(r.responded_at).slice(0, 10) : null,
      foto: foto.get(id) ?? []
    };
  });

  return NextResponse.json({ ok: true, data });
}

export async function PATCH(req: NextRequest) {
  const g = await gate();
  if (g.error) return g.error;
  const user = g.user!;
  const t0 = Date.now();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body bukan JSON yang valid.' }, { status: 400 });
  }

  const id = String(body.id ?? '').trim();
  const status = String(body.status ?? '').trim();
  const tanggapan = String(body.tanggapan ?? '').trim();

  if (!id) return NextResponse.json({ error: 'ID pengaduan wajib diisi.' }, { status: 400 });
  if (!isStatusPengaduan(status)) {
    return NextResponse.json({ error: `Status "${status}" tidak dikenal.` }, { status: 400 });
  }
  if (tanggapan.length > 2000) {
    return NextResponse.json({ error: 'Tanggapan maksimal 2000 karakter.' }, { status: 400 });
  }
  if ((status === 'Selesai' || status === 'Dibatalkan') && !tanggapan) {
    return NextResponse.json(
      { error: 'Isi tanggapan dulu sebelum menutup pengaduan — penghuni perlu tahu alasannya.' },
      { status: 400 }
    );
  }

  const db = turso();
  const sebelum = await db.execute({
    sql: 'SELECT status, response_note, resolved_at FROM tenant_complain WHERE id_complain = ?',
    args: [id]
  });
  if (sebelum.rows.length === 0) {
    return NextResponse.json({ error: 'Pengaduan tidak ditemukan.' }, { status: 404 });
  }

  const sekarang = new Date().toISOString();
  const ditutup = status === 'Selesai' || status === 'Dibatalkan';
  // resolved_at dikosongkan lagi kalau pengaduan dibuka ulang, supaya tanggal
  // selesai tidak pernah menunjuk penutupan yang sudah dibatalkan.
  const resolvedAt = ditutup ? String(sebelum.rows[0].resolved_at ?? sekarang.slice(0, 10)) : null;

  const res = await db.execute({
    sql: `UPDATE tenant_complain
          SET status = ?, resolved_at = ?,
              response_note = ?, responded_by = ?, responded_at = ?
          WHERE id_complain = ?`,
    args: [
      status,
      resolvedAt,
      tanggapan || null,
      tanggapan ? user.username : null,
      tanggapan ? sekarang : null,
      id
    ]
  });
  if (res.rowsAffected === 0) return NextResponse.json({ error: 'Pengaduan tidak ditemukan.' }, { status: 404 });

  await writeAudit({
    requestId: `pengaduan-${id}-${Date.now()}`,
    user,
    moduleId: 'respons-pengaduan',
    action: 'UPDATE',
    target: `Turso → tenant_complain (${id})`,
    oldData: sebelum.rows[0],
    newData: { status, response_note: tanggapan, resolved_at: resolvedAt },
    durationSec: (Date.now() - t0) / 1000,
    status: 'sukses'
  });

  return NextResponse.json({ ok: true, id, status });
}
