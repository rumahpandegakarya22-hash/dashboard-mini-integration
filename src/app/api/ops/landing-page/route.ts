import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/core/auth';
import { turso } from '@/lib/core/turso';
import { redis, nsKey } from '@/lib/core/redis';
import { TTL } from '@/lib/core/cache';

const ALLOWED_ROLES = ['owner', 'pengawas', 'staff_admin', 'staff_marketing'];

const CHILD_TABLES = ['landing_rooms', 'landing_facilities', 'landing_faqs',
  'landing_gallery_photos', 'landing_highlights', 'landing_testimonials'];

/* Konten landing = data referensi jarang berubah → cache Redis 10 menit
   (TTL.referensi), di-invalidasi LANGSUNG tiap edit lewat redis.del di
   PUT/POST/DELETE (pola sama dgn master.ts). */
const LANDING_KEY = nsKey('landing:all');
type LandingData = {
  properties: unknown; rooms: unknown[]; facilities: unknown[]; faqs: unknown[];
  gallery: unknown[]; highlights: unknown[]; testimonials: unknown[];
};

async function loadLandingData(): Promise<LandingData> {
  const hit = await redis.get<LandingData>(LANDING_KEY);
  if (hit) return hit;
  const db = turso();
  const [props, rooms, facilities, faqs, gallery, highlights, testimonials] = await Promise.all([
    db.execute('SELECT * FROM landing_properties LIMIT 1'),
    db.execute('SELECT * FROM landing_rooms ORDER BY "order" ASC, id ASC'),
    db.execute('SELECT * FROM landing_facilities ORDER BY "order" ASC, id ASC'),
    db.execute('SELECT * FROM landing_faqs ORDER BY "order" ASC, id ASC'),
    db.execute('SELECT * FROM landing_gallery_photos ORDER BY "order" ASC, id ASC'),
    db.execute('SELECT * FROM landing_highlights ORDER BY "order" ASC, id ASC'),
    db.execute('SELECT * FROM landing_testimonials ORDER BY "order" ASC, id ASC')
  ]);
  const data: LandingData = {
    properties: props.rows[0] ?? null,
    rooms: rooms.rows,
    facilities: facilities.rows,
    faqs: faqs.rows,
    gallery: gallery.rows,
    highlights: highlights.rows,
    testimonials: testimonials.rows
  };
  await redis.set(LANDING_KEY, data, { ex: TTL.referensi });
  return data;
}

async function invalidateLanding() {
  await redis.del(LANDING_KEY);
}

async function guardAccess() {
  const user = await getSessionUser();
  if (!user || !ALLOWED_ROLES.includes(user.role)) return null;
  return user;
}

export async function GET() {
  const user = await guardAccess();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    return NextResponse.json(await loadLandingData());
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const user = await guardAccess();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { table, id, data } = await req.json();
  const db = turso();

  try {
    if (table === 'landing_properties') {
      const fields = Object.keys(data).filter(k => k !== 'id');
      const sets = fields.map(f => `"${f}" = ?`).join(', ');
      const args = [...fields.map(f => data[f] ?? null), Number(id)];
      await db.execute({ sql: `UPDATE landing_properties SET ${sets} WHERE id = ?`, args });
      await invalidateLanding();
      return NextResponse.json({ ok: true });
    }

    if (CHILD_TABLES.includes(table)) {
      const fields = Object.keys(data).filter(k => k !== 'id' && k !== 'property_id');
      const sets = fields.map(f => `"${f}" = ?`).join(', ');
      const args = [...fields.map(f => data[f] ?? null), Number(id)];
      await db.execute({ sql: `UPDATE "${table}" SET ${sets} WHERE id = ?`, args });
      await invalidateLanding();
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Tabel tidak diizinkan' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await guardAccess();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { table, data } = await req.json();
  if (!CHILD_TABLES.includes(table)) {
    return NextResponse.json({ error: 'Tabel tidak diizinkan' }, { status: 400 });
  }

  const db = turso();
  try {
    const fields = Object.keys(data);
    const cols = fields.map(f => `"${f}"`).join(', ');
    const placeholders = fields.map(() => '?').join(', ');
    const args = fields.map(f => data[f] ?? null);
    const res = await db.execute({ sql: `INSERT INTO "${table}" (${cols}) VALUES (${placeholders})`, args });
    await invalidateLanding();
    return NextResponse.json({ ok: true, id: Number(res.lastInsertRowid) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await guardAccess();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { table, id } = await req.json();
  if (!CHILD_TABLES.includes(table)) {
    return NextResponse.json({ error: 'Tabel tidak diizinkan' }, { status: 400 });
  }

  const db = turso();
  try {
    await db.execute({ sql: `DELETE FROM "${table}" WHERE id = ?`, args: [Number(id)] });
    await invalidateLanding();
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
