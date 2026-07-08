import { Redis } from '@upstash/redis';

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!
});

/** Database Upstash dipakai bersama dashboard internal lain — semua key app ini WAJIB lewat ini. */
export function nsKey(key: string): string {
  return `miniapp:${key}`;
}

/** Lock ringan per-resource (mis. per kamar) untuk cegah race condition. TTL detik. */
export async function withLock<T>(key: string, ttlSec: number, fn: () => Promise<T>): Promise<T> {
  const lockKey = nsKey(`lock:${key}`);
  const ok = await redis.set(lockKey, '1', { nx: true, ex: ttlSec });
  if (!ok) throw new Error('Data sedang diproses user lain. Coba beberapa detik lagi.');
  try {
    return await fn();
  } finally {
    await redis.del(lockKey);
  }
}

/** Idempotency: tolak request_id yang sudah pernah diproses (24 jam). */
export async function claimRequestId(requestId: string): Promise<boolean> {
  const ok = await redis.set(nsKey(`req:${requestId}`), '1', { nx: true, ex: 86400 });
  return !!ok;
}
