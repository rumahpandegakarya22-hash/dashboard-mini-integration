import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/core/auth';
import { turso } from '@/lib/core/turso';
import { writeAudit } from '@/lib/core/audit';
import { invalidateSettingCache } from '@/lib/master';

/**
 * Daftar "Jenis Pelanggaran" (dropdown modul Pelanggaran Peraturan) di tabel `settings`.
 * Hanya Owner dan Admin. Nilai tidak di-rename: pelanggaran lama menyimpan teks jenisnya, jadi nama lama
 * tetap terbaca di laporan; menghapus hanya menonaktifkan pilihan untuk input berikutnya.
 */
const GRUP = 'JENIS_PELANGGARAN';
const KOLOM = 'Jenis';

async function gate() {
  const user = await getSessionUser();
  if (!user) return { error: NextResponse.json({ error: 'Belum login.' }, { status: 401 }) };
  if (user.role !== 'owner' && user.role !== 'admin_finance') {
    return { error: NextResponse.json({ error: 'Hanya Owner dan Admin yang bisa mengatur jenis pelanggaran.' }, { status: 403 }) };
  }
  return { user };
}

async function daftarAktif(): Promise<string[]> {
  const res = await turso().execute({
    sql: 'SELECT nilai FROM settings WHERE grup = ? AND kolom = ? AND aktif = 1 ORDER BY urutan, id',
    args: [GRUP, KOLOM]
  });
  return res.rows.map((r) => String(r.nilai));
}

async function bacaNilai(req: NextRequest): Promise<{ nilai: string } | { error: NextResponse }> {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return { error: NextResponse.json({ error: 'Body bukan JSON.' }, { status: 400 }) };
  }
  const nilai = String(body.nilai ?? '').trim().replace(/\s+/g, ' ');
  if (nilai.length < 2 || nilai.length > 60) {
    return { error: NextResponse.json({ error: 'Nama jenis 2 sampai 60 karakter.' }, { status: 400 }) };
  }
  return { nilai };
}

export async function GET() {
  const g = await gate();
  if (g.error) return g.error;
  return NextResponse.json({ ok: true, data: await daftarAktif() });
}

export async function POST(req: NextRequest) {
  const g = await gate();
  if (g.error) return g.error;
  const b = await bacaNilai(req);
  if ('error' in b) return b.error;

  const ada = (await daftarAktif()).some((v) => v.toLowerCase() === b.nilai.toLowerCase());
  if (ada) return NextResponse.json({ error: `Jenis "${b.nilai}" sudah ada.` }, { status: 409 });

  // Nilai yang pernah dihapus diaktifkan lagi (UNIQUE grup+kolom+nilai), bukan dibuat dobel.
  await turso().execute({
    sql: `INSERT INTO settings (grup, kolom, nilai, urutan)
          VALUES (?, ?, ?, COALESCE((SELECT MAX(urutan) FROM settings WHERE grup = ? AND kolom = ?), 0) + 1)
          ON CONFLICT (grup, kolom, nilai) DO UPDATE SET aktif = 1`,
    args: [GRUP, KOLOM, b.nilai, GRUP, KOLOM]
  });
  await invalidateSettingCache(GRUP, KOLOM);
  await writeAudit({
    requestId: `jenis-pelanggaran-${Date.now()}`, user: g.user!, moduleId: 'jenis-pelanggaran', action: 'CREATE',
    target: 'Turso → settings (JENIS_PELANGGARAN)', newData: { nilai: b.nilai }, status: 'sukses'
  });
  return NextResponse.json({ ok: true, data: await daftarAktif() });
}

export async function DELETE(req: NextRequest) {
  const g = await gate();
  if (g.error) return g.error;
  const b = await bacaNilai(req);
  if ('error' in b) return b.error;

  const aktif = await daftarAktif();
  if (!aktif.includes(b.nilai)) return NextResponse.json({ error: `Jenis "${b.nilai}" tidak ditemukan.` }, { status: 404 });
  // Dropdown input pelanggaran tidak boleh kosong.
  if (aktif.length <= 1) return NextResponse.json({ error: 'Minimal satu jenis harus tersisa.' }, { status: 409 });

  await turso().execute({
    sql: 'UPDATE settings SET aktif = 0 WHERE grup = ? AND kolom = ? AND nilai = ?',
    args: [GRUP, KOLOM, b.nilai]
  });
  await invalidateSettingCache(GRUP, KOLOM);
  await writeAudit({
    requestId: `jenis-pelanggaran-${Date.now()}`, user: g.user!, moduleId: 'jenis-pelanggaran', action: 'UPDATE',
    target: 'Turso → settings (JENIS_PELANGGARAN)', oldData: { nilai: b.nilai, aktif: 1 }, newData: { aktif: 0 }, status: 'sukses'
  });
  return NextResponse.json({ ok: true, data: await daftarAktif() });
}
