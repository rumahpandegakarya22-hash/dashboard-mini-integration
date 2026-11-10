import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/core/auth';
import { turso } from '@/lib/core/turso';
import { writeAudit } from '@/lib/core/audit';
import { fmtTanggal } from '@/lib/format-tanggal';

const EDITOR = new Set(['owner', 'staff_admin']);
const LINK_DRIVE = /^https:\/\/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:[^#]*&)?id=)[A-Za-z0-9_-]{10,120}/;

async function gate() {
  const user = await getSessionUser();
  if (!user) return { error: NextResponse.json({ error: 'Belum login.' }, { status: 401 }) };
  if (!EDITOR.has(user.role)) {
    return { error: NextResponse.json({ error: 'Hanya owner dan admin yang boleh mengelola bukti transfer.' }, { status: 403 }) };
  }
  return { user };
}

async function bacaInvoice(noInv: string, jenis: 'Sewa' | 'DP') {
  const tabel = jenis === 'Sewa' ? 'invoice_sewa' : 'invoice_dp';
  const r = await turso().execute({
    sql: `SELECT no_inv, id_penghuni, nama, tanggal_pembayaran FROM ${tabel} WHERE no_inv = ? ORDER BY id DESC LIMIT 1`,
    args: [noInv]
  });
  return r.rows[0] ?? null;
}

/** Judul dokumen mengikuti pola yang sudah dipakai form pembayaran, supaya otomatis terhubung ke invoice. */
const judulBukti = (jenis: string, idPenghuni: string, nama: string, tanggal: string) =>
  `Bukti Pembayaran ${jenis} — ${idPenghuni} — ${nama} (${fmtTanggal(tanggal)})`;

/** Tautkan berkas bukti (hasil unggah ke Drive atau link Drive yang ditempel) ke satu invoice. */
export async function POST(req: NextRequest) {
  const g = await gate();
  if (g.error) return g.error;
  const user = g.user!;

  const b = (await req.json().catch(() => null)) as { noInv?: string; jenis?: string; url?: string } | null;
  const noInv = String(b?.noInv ?? '').trim();
  const jenis = b?.jenis === 'DP' ? 'DP' : b?.jenis === 'Sewa' ? 'Sewa' : null;
  const url = String(b?.url ?? '').trim();
  if (!noInv || !jenis) return NextResponse.json({ error: 'Invoice tidak valid.' }, { status: 400 });
  if (!LINK_DRIVE.test(url)) {
    return NextResponse.json({ error: 'Link harus berupa link berkas Google Drive (drive.google.com/file/d/...).' }, { status: 400 });
  }

  const inv = await bacaInvoice(noInv, jenis);
  if (!inv) return NextResponse.json({ error: `Invoice ${noInv} tidak ditemukan.` }, { status: 404 });

  const db = turso();
  const sudah = await db.execute({ sql: 'SELECT 1 FROM dokumen WHERE link_drive = ? AND judul LIKE ? LIMIT 1', args: [url, `Bukti Pembayaran ${jenis} — ${inv.id_penghuni}%`] });
  if (sudah.rows.length) return NextResponse.json({ error: 'Berkas ini sudah tertaut ke penghuni yang sama.' }, { status: 409 });

  const tanggal = String(inv.tanggal_pembayaran ?? '').slice(0, 10);
  const idDokumen = `BKT-${tanggal.replace(/-/g, '')}-${crypto.randomUUID().slice(0, 8)}`;
  const judul = judulBukti(jenis, String(inv.id_penghuni), String(inv.nama), tanggal);
  await db.execute({
    sql: 'INSERT INTO dokumen (id_dokumen, judul, role, link_drive) VALUES (?, ?, ?, ?)',
    args: [idDokumen, judul.slice(0, 160), 'Admin', url]
  });

  await writeAudit({
    requestId: `bukti-${idDokumen}`,
    user,
    moduleId: 'riwayat-pembayaran',
    action: 'CREATE',
    target: `Turso → dokumen (${idDokumen}) untuk invoice ${noInv}`,
    newData: { noInv, jenis, url },
    status: 'sukses'
  });
  return NextResponse.json({ ok: true, idDokumen });
}

/** Lepas tautan bukti yang salah (hanya baris di tabel dokumen; berkas di Drive tidak dihapus). */
export async function DELETE(req: NextRequest) {
  const g = await gate();
  if (g.error) return g.error;
  const user = g.user!;

  const b = (await req.json().catch(() => null)) as { idDokumen?: string } | null;
  const id = String(b?.idDokumen ?? '').trim();
  if (!id) return NextResponse.json({ error: 'Dokumen tidak valid.' }, { status: 400 });

  const db = turso();
  const r = await db.execute({ sql: "SELECT judul FROM dokumen WHERE id_dokumen = ? AND judul LIKE 'Bukti Pembayaran%'", args: [id] });
  if (!r.rows.length) return NextResponse.json({ error: 'Bukti tidak ditemukan.' }, { status: 404 });
  await db.execute({ sql: 'DELETE FROM dokumen WHERE id_dokumen = ?', args: [id] });

  await writeAudit({
    requestId: `bukti-hapus-${id}`,
    user,
    moduleId: 'riwayat-pembayaran',
    action: 'UPDATE',
    target: `Turso → dokumen (${id}) dilepas`,
    oldData: { judul: String(r.rows[0].judul) },
    status: 'sukses'
  });
  return NextResponse.json({ ok: true });
}
