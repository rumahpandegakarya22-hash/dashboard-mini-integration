import { NextRequest, NextResponse } from 'next/server';
import { requireDashboardAuth, requireOwner } from '@/lib/dashboard/api-guard';
import type { DashboardSessionUser } from '@/lib/core/auth';
import { turso } from '@/lib/core/turso';
import { nowWib } from '@/lib/core/validate';
import { writeAudit } from '@/lib/core/audit';
import { parseData, skemaHapus, skemaSimpan } from '@/lib/kalkulator/skema';
import { pastikanSkemaKalkulator } from '@/lib/kalkulator/skema-db';

/**
 * Skenario Kalkulator Bisnis — khusus Owner.
 * GET daftar · POST {nama, data} buat · PUT {id, nama, data} simpan · PUT {id, hapus: true} soft delete.
 */

const MAKS_BODY = 65_536;
const MAKS_SKENARIO = 100;
const TARGET = 'Turso → kalkulator_skenario';

const galat = (error: string, status: number) => NextResponse.json({ error }, { status });

async function gerbang(): Promise<{ user: DashboardSessionUser } | { res: NextResponse }> {
  const g = await requireDashboardAuth('kalkulator');
  if (!g.ok) return { res: g.res };
  const tolak = requireOwner(g.user);
  if (tolak) return { res: tolak };
  await pastikanSkemaKalkulator(turso());
  return { user: g.user };
}

/** Body JSON dengan batas ukuran; null bila terlalu besar atau bukan JSON. */
async function bacaBody(req: NextRequest): Promise<{ ok: true; body: unknown } | { ok: false; res: NextResponse }> {
  if (Number(req.headers.get('content-length') || 0) > MAKS_BODY) return { ok: false, res: galat('Data terlalu besar.', 413) };
  const teks = await req.text().catch(() => '');
  if (teks.length > MAKS_BODY) return { ok: false, res: galat('Data terlalu besar.', 413) };
  try {
    return { ok: true, body: JSON.parse(teks) };
  } catch {
    return { ok: false, res: galat('Data tidak valid.', 400) };
  }
}

const audit = (user: DashboardSessionUser, action: 'CREATE' | 'UPDATE', row: number, newData: unknown, oldData?: unknown) =>
  writeAudit({
    requestId: crypto.randomUUID(),
    user: { username: user.username, role: user.role },
    moduleId: 'kalkulator',
    action,
    target: TARGET,
    row,
    oldData,
    newData,
    status: 'sukses'
  });

function gagalServer(e: unknown) {
  console.error('[api/dashboard/kalkulator]', e);
  return galat('Terjadi kesalahan pada server.', 500);
}

export async function GET() {
  try {
    const g = await gerbang();
    if ('res' in g) return g.res;
    const rs = await turso().execute(
      'SELECT id, nama, data, diubah_pada FROM kalkulator_skenario WHERE dihapus_pada IS NULL ORDER BY diubah_pada DESC, id DESC'
    );
    const skenario = rs.rows.flatMap((r) => {
      const data = parseData(String(r.data));
      return data ? [{ id: Number(r.id), nama: String(r.nama), data, diubah_pada: String(r.diubah_pada) }] : [];
    });
    return NextResponse.json({ skenario });
  } catch (e) {
    return gagalServer(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const g = await gerbang();
    if ('res' in g) return g.res;
    const b = await bacaBody(req);
    if (!b.ok) return b.res;
    const v = skemaSimpan.safeParse(b.body);
    if (!v.success || v.data.id !== undefined) return galat('Data tidak valid.', 400);

    const db = turso();
    const n = await db.execute('SELECT COUNT(*) AS n FROM kalkulator_skenario WHERE dihapus_pada IS NULL');
    if (Number(n.rows[0]?.n ?? 0) >= MAKS_SKENARIO) {
      return galat(`Maksimal ${MAKS_SKENARIO} skenario. Hapus yang tidak dipakai dulu.`, 409);
    }
    const waktu = nowWib();
    const rs = await db.execute({
      sql: `INSERT INTO kalkulator_skenario (nama, data, dibuat_oleh, diubah_oleh, dibuat_pada, diubah_pada)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [v.data.nama, JSON.stringify(v.data.data), g.user.username, g.user.username, waktu, waktu]
    });
    const id = Number(rs.lastInsertRowid);
    await audit(g.user, 'CREATE', id, { nama: v.data.nama });
    return NextResponse.json({ id });
  } catch (e) {
    return gagalServer(e);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const g = await gerbang();
    if ('res' in g) return g.res;
    const b = await bacaBody(req);
    if (!b.ok) return b.res;

    const db = turso();
    const hapus = skemaHapus.safeParse(b.body);
    if (hapus.success) {
      const rs = await db.execute({
        sql: 'UPDATE kalkulator_skenario SET dihapus_pada = ?, diubah_oleh = ? WHERE id = ? AND dihapus_pada IS NULL',
        args: [nowWib(), g.user.username, hapus.data.id]
      });
      if (!rs.rowsAffected) return galat('Skenario tidak ditemukan.', 404);
      await audit(g.user, 'UPDATE', hapus.data.id, { dihapus: true });
      return NextResponse.json({ ok: true });
    }

    const v = skemaSimpan.safeParse(b.body);
    if (!v.success || v.data.id === undefined) return galat('Data tidak valid.', 400);
    const rs = await db.execute({
      sql: `UPDATE kalkulator_skenario SET nama = ?, data = ?, diubah_oleh = ?, diubah_pada = ?
            WHERE id = ? AND dihapus_pada IS NULL`,
      args: [v.data.nama, JSON.stringify(v.data.data), g.user.username, nowWib(), v.data.id]
    });
    if (!rs.rowsAffected) return galat('Skenario tidak ditemukan.', 404);
    await audit(g.user, 'UPDATE', v.data.id, { nama: v.data.nama });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return gagalServer(e);
  }
}
