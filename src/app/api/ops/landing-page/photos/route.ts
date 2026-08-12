import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/core/auth';
import { turso } from '@/lib/core/turso';
import { redis, nsKey } from '@/lib/core/redis';

/* Kelola foto landing dengan 3 scope:
   - room   : per TIPE kamar landing (landing_room_photos, kolom room_id)
   - kamar  : per NOMOR kamar fisik   (landing_kamar_photos, kolom no_kamar)
   - gallery: galeri utama            (landing_gallery_photos, tanpa scope)
   Aksi: list / add / delete / reorder (up|down) / cover. Invalidasi cache landing. */

const ALLOWED_ROLES = ['owner', 'pengawas', 'staff_admin', 'staff_marketing'];

async function guard() {
  const user = await getSessionUser();
  if (!user || !ALLOWED_ROLES.includes(user.role)) return null;
  return user;
}
async function invalidate() { await redis.del(nsKey('landing:all')); }

type Scope = 'room' | 'kamar' | 'gallery';
interface Cfg { table: string; col?: string } // col = kolom scope (undefined utk gallery)
function cfg(scope: Scope): Cfg {
  if (scope === 'room') return { table: 'landing_room_photos', col: 'room_id' };
  if (scope === 'kamar') return { table: 'landing_kamar_photos', col: 'no_kamar' };
  return { table: 'landing_gallery_photos' };
}
/** id scope: roomId untuk room, noKamar untuk kamar. */
function scopeIdOf(scope: Scope, body: { roomId?: number; noKamar?: number }) {
  return scope === 'kamar' ? body.noKamar : body.roomId;
}

async function listPhotos(scope: Scope, scopeId?: number) {
  const { table, col } = cfg(scope);
  const db = turso();
  if (col) {
    const r = await db.execute({ sql: `SELECT id, url, alt, "order", is_cover FROM "${table}" WHERE ${col}=? ORDER BY "order" ASC, id ASC`, args: [scopeId ?? 0] });
    return r.rows;
  }
  const r = await db.execute(`SELECT id, url, alt, "order", is_cover FROM "${table}" ORDER BY "order" ASC, id ASC`);
  return r.rows;
}

export async function GET(req: NextRequest) {
  if (!(await guard())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const scope = (req.nextUrl.searchParams.get('scope') ?? 'gallery') as Scope;
  const scopeId = Number(req.nextUrl.searchParams.get(scope === 'kamar' ? 'noKamar' : 'roomId') ?? 0) || undefined;
  try {
    return NextResponse.json({ photos: await listPhotos(scope, scopeId) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await guard())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json() as { scope: Scope; roomId?: number; noKamar?: number; url?: string; alt?: string };
  const { scope, url, alt } = body;
  if (!url) return NextResponse.json({ error: 'URL foto wajib.' }, { status: 400 });
  const { table, col } = cfg(scope);
  const scopeId = scopeIdOf(scope, body);
  const db = turso();
  try {
    if (col) {
      if (scopeId == null) return NextResponse.json({ error: 'ID scope wajib.' }, { status: 400 });
      const mx = await db.execute({ sql: `SELECT COALESCE(MAX("order"),-1)+1 n, COUNT(*) c FROM "${table}" WHERE ${col}=?`, args: [scopeId] });
      const order = Number(mx.rows[0][0]); const first = Number(mx.rows[0][1]) === 0;
      await db.execute({ sql: `INSERT INTO "${table}" (${col}, url, alt, "order", is_cover) VALUES (?, ?, ?, ?, ?)`, args: [scopeId, url, alt ?? '', order, first ? 1 : 0] });
    } else {
      const prop = await db.execute('SELECT id FROM landing_properties LIMIT 1');
      const propertyId = Number(prop.rows[0]?.[0] ?? 1);
      const mx = await db.execute('SELECT COALESCE(MAX("order"),-1)+1 n, COUNT(*) c FROM landing_gallery_photos');
      const order = Number(mx.rows[0][0]); const first = Number(mx.rows[0][1]) === 0;
      await db.execute({ sql: `INSERT INTO landing_gallery_photos (property_id, url, alt, "order", is_cover) VALUES (?, ?, ?, ?, ?)`, args: [propertyId, url, alt ?? '', order, first ? 1 : 0] });
    }
    await invalidate();
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await guard())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json() as { scope: Scope; id: number; roomId?: number; noKamar?: number };
  const { scope, id } = body;
  const { table } = cfg(scope);
  const scopeId = scopeIdOf(scope, body);
  const db = turso();
  try {
    const wasCover = await db.execute({ sql: `SELECT is_cover FROM "${table}" WHERE id=?`, args: [id] });
    await db.execute({ sql: `DELETE FROM "${table}" WHERE id=?`, args: [id] });
    if (Number(wasCover.rows[0]?.[0] ?? 0) === 1) {
      const rest = await listPhotos(scope, scopeId);
      if (rest.length > 0) await db.execute({ sql: `UPDATE "${table}" SET is_cover=1 WHERE id=?`, args: [Number(rest[0][0])] });
    }
    await invalidate();
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!(await guard())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json() as { scope: Scope; id: number; action: 'up' | 'down' | 'cover'; roomId?: number; noKamar?: number };
  const { scope, id, action } = body;
  const { table, col } = cfg(scope);
  const scopeId = scopeIdOf(scope, body);
  const db = turso();
  try {
    if (action === 'cover') {
      if (col) await db.execute({ sql: `UPDATE "${table}" SET is_cover=0 WHERE ${col}=?`, args: [scopeId ?? 0] });
      else await db.execute(`UPDATE "${table}" SET is_cover=0`);
      await db.execute({ sql: `UPDATE "${table}" SET is_cover=1 WHERE id=?`, args: [id] });
    } else {
      const list = await listPhotos(scope, scopeId);
      const idx = list.findIndex((r) => Number(r[0]) === id);
      const swapIdx = action === 'up' ? idx - 1 : idx + 1;
      if (idx >= 0 && swapIdx >= 0 && swapIdx < list.length) {
        const a = list[idx], b = list[swapIdx];
        await db.execute({ sql: `UPDATE "${table}" SET "order"=? WHERE id=?`, args: [Number(b[3]), Number(a[0])] });
        await db.execute({ sql: `UPDATE "${table}" SET "order"=? WHERE id=?`, args: [Number(a[3]), Number(b[0])] });
      }
    }
    await invalidate();
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
