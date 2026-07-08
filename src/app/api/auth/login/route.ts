import { NextRequest, NextResponse } from 'next/server';
import { verifyCredentials, createToken, COOKIE_NAME } from '@/lib/auth';
import { redis, nsKey } from '@/lib/redis';

export async function POST(req: NextRequest) {
  const { username, password } = await req.json().catch(() => ({}));
  if (!username || !password) {
    return NextResponse.json({ error: 'Username dan password wajib diisi.' }, { status: 400 });
  }

  // Rate limit sederhana: 10 percobaan / 15 menit per username
  const rlKey = nsKey(`rl:login:${String(username).toLowerCase()}`);
  const attempts = await redis.incr(rlKey);
  if (attempts === 1) await redis.expire(rlKey, 900);
  if (attempts > 10) {
    return NextResponse.json({ error: 'Terlalu banyak percobaan. Coba lagi 15 menit.' }, { status: 429 });
  }

  const user = await verifyCredentials(username, password);
  if (!user) {
    return NextResponse.json({ error: 'Username atau password salah.' }, { status: 401 });
  }

  await redis.del(rlKey);
  const token = await createToken(user);
  const res = NextResponse.json({ ok: true, user });
  res.cookies.set(COOKIE_NAME, token, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 72 * 3600, path: '/' });
  return res;
}
