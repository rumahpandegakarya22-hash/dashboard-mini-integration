import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/core/auth';
import { canAccess } from '@/lib/core/roles';
import { turso } from '@/lib/core/turso';
import { writeAudit } from '@/lib/core/audit';
import { getPenghuniByIds, labelPenghuni, urlBerkas } from '@/lib/teman-rara';

/**
 * Verifikasi bukti bayar yang diunggah penghuni lewat aplikasi Teman Rara.
 *
 * Kolom `verified_at`/`verified_by` sudah lama ada di tabel tapi tidak pernah
 * punya mekanisme pengisinya — bukti menumpuk tanpa pernah ditandai. Migrasi
 * 004 menambah pasangannya untuk penolakan, sehingga bukti yang salah tidak
 * menggantung selamanya di antrean.
 *
 * PENTING: endpoint ini TIDAK mencatat pembayaran. Memverifikasi bukti hanya
 * berarti "berkasnya sah dan sudah dicek", bukan "uangnya masuk". Pencatatan
 * pembayaran tetap lewat form Pembayaran Sewa di atas panel ini, karena itu
 * yang menerbitkan invoice dan menulis jurnal.
 */

const LIMIT = 50;

async function gate() {
  const user = await getSessionUser();
  if (!user) return { error: NextResponse.json({ error: 'Belum login.' }, { status: 401 }) };
  if (!canAccess(user.role, 'pembayaran-sewa')) {
    return { error: NextResponse.json({ error: 'Divisi kamu tidak menangani pembayaran.' }, { status: 403 }) };
  }
  return { user };
}

export async function GET(req: NextRequest) {
  const g = await gate();
  if (g.error) return g.error;

  const semua = req.nextUrl.searchParams.get('filter') === 'semua';
  const res = await turso().execute(
    `SELECT p.id, p.id_penghuni, p.invoice_sewa_id, p.invoice_dp_id, p.file_url, p.file_type,
            p.file_size, p.catatan, p.created_at,
            p.verified_at, p.verified_by, p.rejected_at, p.rejected_by, p.rejected_reason,
            s.no_inv AS sewa_no_inv, s.grand_total AS sewa_total, s.periode_awal, s.periode_akhir,
            d.no_inv AS dp_no_inv, d.grand_total AS dp_total
     FROM tr_payment_proof p
     LEFT JOIN invoice_sewa s ON s.id = p.invoice_sewa_id
     LEFT JOIN invoice_dp   d ON d.id = p.invoice_dp_id
     ${semua ? '' : 'WHERE p.verified_at IS NULL AND p.rejected_at IS NULL'}
     ORDER BY p.created_at DESC
     LIMIT ${LIMIT}`
  );

  const penghuni = await getPenghuniByIds(res.rows.map((r) => String(r.id_penghuni)));

  const data = res.rows.map((r) => {
    const idp = String(r.id_penghuni);
    const sewa = r.sewa_no_inv != null;
    return {
      id: String(r.id),
      penghuni: labelPenghuni(penghuni.get(idp), idp),
      berkas: urlBerkas(String(r.file_url)),
      tipeBerkas: String(r.file_type ?? ''),
      ukuranKb: Math.round(Number(r.file_size ?? 0) / 1024),
      catatan: r.catatan ? String(r.catatan) : '',
      diunggah: String(r.created_at ?? '').slice(0, 10),
      invoice: sewa ? String(r.sewa_no_inv) : r.dp_no_inv != null ? String(r.dp_no_inv) : null,
      jenisInvoice: sewa ? 'Sewa' : r.dp_no_inv != null ? 'DP' : null,
      nominalInvoice: Number((sewa ? r.sewa_total : r.dp_total) ?? 0),
      periode: sewa && r.periode_awal ? `${String(r.periode_awal)} s/d ${String(r.periode_akhir ?? '')}` : null,
      status: r.verified_at ? 'Terverifikasi' : r.rejected_at ? 'Ditolak' : 'Menunggu',
      diprosesOleh: r.verified_by ? String(r.verified_by) : r.rejected_by ? String(r.rejected_by) : null,
      diprosesPada: r.verified_at
        ? String(r.verified_at).slice(0, 10)
        : r.rejected_at
          ? String(r.rejected_at).slice(0, 10)
          : null,
      alasanTolak: r.rejected_reason ? String(r.rejected_reason) : ''
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
  const aksi = String(body.aksi ?? '').trim();
  const alasan = String(body.alasan ?? '').trim();

  if (!id) return NextResponse.json({ error: 'ID bukti wajib diisi.' }, { status: 400 });
  if (aksi !== 'verifikasi' && aksi !== 'tolak' && aksi !== 'batal') {
    return NextResponse.json({ error: 'Aksi harus "verifikasi", "tolak", atau "batal".' }, { status: 400 });
  }
  if (aksi === 'tolak' && alasan.length < 5) {
    return NextResponse.json({ error: 'Alasan penolakan wajib diisi (minimal 5 karakter).' }, { status: 400 });
  }
  if (alasan.length > 500) {
    return NextResponse.json({ error: 'Alasan maksimal 500 karakter.' }, { status: 400 });
  }

  const db = turso();
  const sebelum = await db.execute({
    sql: 'SELECT verified_at, verified_by, rejected_at, rejected_reason FROM tr_payment_proof WHERE id = ?',
    args: [id]
  });
  if (sebelum.rows.length === 0) return NextResponse.json({ error: 'Bukti tidak ditemukan.' }, { status: 404 });

  const sekarang = new Date().toISOString();
  // Verifikasi dan penolakan saling meniadakan — satu bukti tidak boleh
  // menyandang dua keputusan sekaligus.
  const args =
    aksi === 'verifikasi'
      ? [sekarang, user.username, null, null, null]
      : aksi === 'tolak'
        ? [null, null, sekarang, user.username, alasan]
        : [null, null, null, null, null];

  await db.execute({
    sql: `UPDATE tr_payment_proof
          SET verified_at = ?, verified_by = ?, rejected_at = ?, rejected_by = ?, rejected_reason = ?
          WHERE id = ?`,
    args: [...args, id]
  });

  await writeAudit({
    requestId: `bukti-${id}-${Date.now()}`,
    user,
    moduleId: 'verifikasi-bukti-bayar',
    action: 'UPDATE',
    target: `Turso → tr_payment_proof (${id})`,
    oldData: sebelum.rows[0],
    newData: { aksi, alasan: alasan || null },
    durationSec: (Date.now() - t0) / 1000,
    status: 'sukses'
  });

  return NextResponse.json({ ok: true, id, aksi });
}
