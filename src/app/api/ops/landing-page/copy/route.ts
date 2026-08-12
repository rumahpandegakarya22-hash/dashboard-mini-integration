import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/core/auth';
import { turso } from '@/lib/core/turso';
import { redis, nsKey } from '@/lib/core/redis';

/* Teks statis landing (tabel landing_copy). GET = map {key:value}; PUT = upsert
   beberapa key sekaligus. Invalidasi cache landing Mini App tiap simpan. */

const ALLOWED_ROLES = ['owner', 'pengawas', 'staff_admin', 'staff_marketing'];

async function guard() {
  const user = await getSessionUser();
  if (!user || !ALLOWED_ROLES.includes(user.role)) return null;
  return user;
}

export async function GET() {
  if (!(await guard())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const res = await turso().execute('SELECT key, value FROM landing_copy');
    const map: Record<string, string> = {};
    for (const r of res.rows) map[String(r[0])] = String(r[1] ?? '');
    return NextResponse.json({ copy: map });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const user = await guard();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { updates } = await req.json() as { updates?: Record<string, string> };
  if (!updates || typeof updates !== 'object') {
    return NextResponse.json({ error: 'updates wajib berupa objek {key:value}.' }, { status: 400 });
  }
  const db = turso();
  try {
    for (const [key, value] of Object.entries(updates)) {
      await db.execute({
        sql: `INSERT INTO landing_copy (key, value, updated_by, updated_at)
              VALUES (?, ?, ?, CURRENT_TIMESTAMP)
              ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_by=excluded.updated_by, updated_at=CURRENT_TIMESTAMP`,
        args: [key, String(value ?? ''), user.name],
      });
    }
    await redis.del(nsKey('landing:all'));
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
