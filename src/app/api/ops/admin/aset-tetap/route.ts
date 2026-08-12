import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/core/auth';
import { turso } from '@/lib/core/turso';
import { ringkasanAset, postingPenyusutan, KATEGORI, type KategoriAset } from '@/lib/laporan/penyusutan';

const ALLOWED = new Set(['owner', 'staff_admin']);

async function guard() {
  const user = await getSessionUser();
  if (!user) return { error: NextResponse.json({ error: 'Belum login.' }, { status: 401 }) };
  if (!ALLOWED.has(user.role)) return { error: NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 }) };
  return { user };
}

export async function GET() {
  const g = await guard();
  if (g.error) return g.error;
  const aset = await ringkasanAset();
  return NextResponse.json({ aset, kategori: KATEGORI });
}

export async function POST(req: NextRequest) {
  const g = await guard();
  if (g.error) return g.error;

  const body = await req.json() as Record<string, unknown>;
  const action = String(body.action ?? 'add');

  if (action === 'posting') {
    const sampai = String(body.sampaiPeriode ?? '');
    if (!/^\d{4}-\d{2}$/.test(sampai)) {
      return NextResponse.json({ error: 'Periode tidak valid (YYYY-MM).' }, { status: 400 });
    }
    const res = await postingPenyusutan(sampai);
    return NextResponse.json({ ok: true, ...res });
  }

  // action = add
  const nama = String(body.nama ?? '').trim();
  const kategori = String(body.kategori ?? '') as KategoriAset;
  const harga = Math.round(Number(body.harga_perolehan ?? 0));
  const residu = Math.round(Number(body.nilai_residu ?? 0));
  const tanggal = String(body.tanggal_perolehan ?? '');
  const umur = Math.round(Number(body.umur_bulan ?? 0)) || KATEGORI[kategori]?.umurBulanDefault;

  if (!nama) return NextResponse.json({ error: 'Nama aset wajib diisi.' }, { status: 400 });
  if (!KATEGORI[kategori]) return NextResponse.json({ error: 'Kategori tidak valid.' }, { status: 400 });
  if (!(harga > 0)) return NextResponse.json({ error: 'Harga perolehan harus > 0.' }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) return NextResponse.json({ error: 'Tanggal perolehan tidak valid.' }, { status: 400 });
  if (residu < 0 || residu >= harga) return NextResponse.json({ error: 'Nilai residu harus 0 s/d < harga perolehan.' }, { status: 400 });
  if (!(umur > 0)) return NextResponse.json({ error: 'Umur manfaat tidak valid.' }, { status: 400 });

  await turso().execute({
    sql: `INSERT INTO aset_tetap (nama, kategori, harga_perolehan, nilai_residu, tanggal_perolehan, umur_bulan, catatan)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [nama, kategori, harga, residu, tanggal, umur, String(body.catatan ?? '') || null],
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const g = await guard();
  if (g.error) return g.error;
  const { id } = await req.json() as { id?: number };
  if (!id) return NextResponse.json({ error: 'id wajib.' }, { status: 400 });
  // Hapus aset + log posting (CASCADE). Jurnal penyusutan yang sudah tercatat TIDAK dihapus
  // supaya laporan periode lampau tetap konsisten.
  await turso().execute({ sql: 'DELETE FROM aset_tetap WHERE id=?', args: [Number(id)] });
  return NextResponse.json({ ok: true });
}
