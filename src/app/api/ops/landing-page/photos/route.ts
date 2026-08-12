import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/core/auth';
import { turso } from '@/lib/core/turso';
import { redis, nsKey } from '@/lib/core/redis';

/* Kelola foto: per-kamar (landing_room_photos, scope=room) & galeri
   (landing_gallery_photos, scope=gallery). Aksi: list / add / delete /
   reorder (up|down) / cover. Invalidasi cache landing tiap perubahan. */

const ALLOWED_ROLES = ['owner', 'pengawas', 'staff_admin', 'staff_marketing'];

async function guard() {
  const user = await getSessionUser();
  if (!user || !ALLOWED_ROLES.includes(user.role)) return null;
  return user;
}
async function invalidate() { await redis.del(nsKey('landing:all')); }

type Scope = 'room' | 'gallery';
function tableFor(scope: Scope) { return scope === 'room' ? 'landing_room_photos' : 'landing_gallery_photos'; }

async function listPhotos(scope: Scope, roomId?: number) {
  const db = turso();
  if (scope === 'room') {
    const r = await db.execute({
      sql: `SELECT id, url, alt, "order", is_cover FROM landing_room_photos WHERE room_id=? ORDER BY "order" ASC, id ASC`,
      args: [roomId ?? 0],
    });
    return r.rows;
  }
  const r = await db.execute(`SELECT id, url, alt, "order", is_cover FROM landing_gallery_photos ORDER BY "order" ASC, id ASC`);
  return r.rows;
}

export async function GET(req: NextRequest) {
  if (!(await guard())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const scope = (req.nextUrl.searchParams.get('scope') ?? 'gallery') as Scope;
  const roomId = Number(req.nextUrl.searchParams.get('roomId') ?? 0) || undefined;
  try {
    return NextResponse.json({ photos: await listPhotos(scope, roomId) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await guard())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { scope, roomId, url, alt } = await req.json() as { scope: Scope; roomId?: number; url?: string; alt?: string };
  if (!url) return NextResponse.json({ error: 'URL foto wajib.' }, { status: 400 });
  const db = turso();
  try {
    if (scope === 'room') {
      if (!roomId) return NextResponse.json({ error: 'roomId wajib.' }, { status: 400 });
      const mx = await db.execute({ sql: 'SELECT COALESCE(MAX("order"),-1)+1 n, COUNT(*) c FROM landing_room_photos WHERE room_id=?', args: [roomId] });
      const order = Number(mx.rows[0][0]); const first = Number(mx.rows[0][1]) === 0;
      await db.execute({
        sql: `INSERT INTO landing_room_photos (room_id, url, alt, "order", is_cover) VALUES (?, ?, ?, ?, ?)`,
        args: [roomId, url, alt ?? '', order, first ? 1 : 0],
      });
    } else {
      const prop = await db.execute('SELECT id FROM landing_properties LIMIT 1');
      const propertyId = Number(prop.rows[0]?.[0] ?? 1);
      const mx = await db.execute('SELECT COALESCE(MAX("order"),-1)+1 n, COUNT(*) c FROM landing_gallery_photos');
      const order = Number(mx.rows[0][0]); const first = Number(mx.rows[0][1]) === 0;
      await db.execute({
        sql: `INSERT INTO landing_gallery_photos (property_id, url, alt, "order", is_cover) VALUES (?, ?, ?, ?, ?)`,
        args: [propertyId, url, alt ?? '', order, first ? 1 : 0],
      });
    }
    await invalidate();
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await guard())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { scope, id, roomId } = await req.json() as { scope: Scope; id: number; roomId?: number };
  const table = tableFor(scope);
  const db = turso();
  try {
    const wasCover = await db.execute({ sql: `SELECT is_cover FROM "${table}" WHERE id=?`, args: [id] });
    await db.execute({ sql: `DELETE FROM "${table}" WHERE id=?`, args: [id] });
    // jika yang dihapus cover, promosikan foto pertama tersisa jadi cover
    if (Number(wasCover.rows[0]?.[0] ?? 0) === 1) {
      const rest = await listPhotos(scope, roomId);
      if (rest.length > 0) {
        await db.execute({ sql: `UPDATE "${table}" SET is_cover=1 WHERE id=?`, args: [Number(rest[0][0])] });
      }
    }
    await invalidate();
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!(await guard())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { scope, id, action, roomId } = await req.json() as { scope: Scope; id: number; action: 'up' | 'down' | 'cover'; roomId?: number };
  const table = tableFor(scope);
  const db = turso();
  try {
    if (action === 'cover') {
      if (scope === 'room') {
        await db.execute({ sql: 'UPDATE landing_room_photos SET is_cover=0 WHERE room_id=?', args: [roomId ?? 0] });
      } else {
        await db.execute('UPDATE landing_gallery_photos SET is_cover=0');
      }
      await db.execute({ sql: `UPDATE "${table}" SET is_cover=1 WHERE id=?`, args: [id] });
    } else {
      // tukar "order" dengan tetangga (up/down) dalam scope yang sama
      const list = await listPhotos(scope, roomId);
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
