import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { redis, nsKey } from './redis';
import type { Role } from './roles';

const SECRET = () => new TextEncoder().encode(process.env.JWT_SECRET!);
const SESSION_HOURS = 72; // auto logout setelah 3 hari tidak digunakan (sliding)

export interface SessionUser {
  username: string;
  name: string;
  role: Role;
}

export type UserStatus = 'pending' | 'active' | 'disabled';

export interface StoredUser {
  passwordHash?: string; // kosong utk user yang daftar via Google (belum tentu punya password)
  name: string;
  role: Role | null; // null selama status masih 'pending'
  status: UserStatus;
  authProvider: 'password' | 'google';
  email?: string;
  googleId?: string;
  createdAt: string;
  /** @deprecated field lama sebelum ada `status` — dipakai hanya utk baca data seed lama. */
  active?: boolean;
}

/** Normalisasi record lama (seed sebelum ada `status`) ke bentuk baru, tanpa perlu migrasi data. */
function normalizeStoredUser(u: StoredUser): StoredUser {
  if (u.status) return u;
  return { ...u, status: u.active === false ? 'disabled' : 'active', authProvider: u.authProvider || 'password' };
}

export async function getStoredUser(username: string): Promise<StoredUser | null> {
  const u = await redis.get<StoredUser>(nsKey(`user:${username.toLowerCase()}`));
  return u ? normalizeStoredUser(u) : null;
}

async function saveStoredUser(username: string, u: StoredUser): Promise<void> {
  await redis.set(nsKey(`user:${username.toLowerCase()}`), u);
}

export async function verifyCredentials(username: string, password: string): Promise<SessionUser | null> {
  const u = await getStoredUser(username);
  if (!u || u.status !== 'active' || !u.passwordHash || !u.role) return null;
  const ok = await bcrypt.compare(password, u.passwordHash);
  if (!ok) return null;
  return { username: username.toLowerCase(), name: u.name, role: u.role };
}

export async function createToken(user: SessionUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(SECRET());
}

export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET());
    return { username: String(payload.username), name: String(payload.name), role: payload.role as Role };
  } catch {
    return null;
  }
}

/** Sliding session: terbitkan token baru jika sisa umur < 48 jam. */
export async function maybeRefresh(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET());
    const remainSec = (payload.exp || 0) - Math.floor(Date.now() / 1000);
    if (remainSec < 48 * 3600) {
      return createToken({
        username: String(payload.username),
        name: String(payload.name),
        role: payload.role as Role
      });
    }
    return null;
  } catch {
    return null;
  }
}

export const COOKIE_NAME = 'miniapp_session';

/** User dari session cookie saat ini. Dipakai di API route handlers (proxy.ts sudah menjamin token valid). */
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  return token ? verifyToken(token) : null;
}

// ---- Self-registration via Google + approval Owner ----

/**
 * Cari user Google berdasar email; kalau belum ada, buat baru berstatus 'pending'.
 * Username disamakan dengan email (lowercased) — akun Google tidak butuh index terpisah.
 */
export async function findOrCreateGoogleUser(params: {
  email: string;
  name: string;
  googleId: string;
}): Promise<{ username: string; user: StoredUser; isNew: boolean }> {
  const username = params.email.toLowerCase();
  const existing = await getStoredUser(username);
  if (existing) return { username, user: existing, isNew: false };

  const user: StoredUser = {
    name: params.name,
    role: null,
    status: 'pending',
    authProvider: 'google',
    email: params.email,
    googleId: params.googleId,
    createdAt: new Date().toISOString()
  };
  await saveStoredUser(username, user);
  return { username, user, isNew: true };
}

/** Daftar semua user (dipakai halaman admin Owner). Upstash KEYS aman utk skala kost (puluhan user). */
export async function listAllUsers(): Promise<{ username: string; user: StoredUser }[]> {
  const keys = await redis.keys(nsKey('user:*'));
  if (keys.length === 0) return [];
  const values = await Promise.all(keys.map((k) => redis.get<StoredUser>(k)));
  return keys
    .map((k, i) => ({ username: k.slice(nsKey('user:').length), user: values[i] }))
    .filter((x): x is { username: string; user: StoredUser } => !!x.user)
    .map((x) => ({ username: x.username, user: normalizeStoredUser(x.user) }));
}

/** Owner approve user pending: set status aktif + tetapkan role. */
export async function approveUser(username: string, role: Role): Promise<void> {
  const u = await getStoredUser(username);
  if (!u) throw new Error(`User "${username}" tidak ditemukan.`);
  await saveStoredUser(username, { ...u, status: 'active', role });
}

/** Owner ubah role user aktif. */
export async function setUserRole(username: string, role: Role): Promise<void> {
  const u = await getStoredUser(username);
  if (!u) throw new Error(`User "${username}" tidak ditemukan.`);
  await saveStoredUser(username, { ...u, role });
}

/** Owner nonaktifkan user. */
export async function deactivateUser(username: string): Promise<void> {
  const u = await getStoredUser(username);
  if (!u) throw new Error(`User "${username}" tidak ditemukan.`);
  await saveStoredUser(username, { ...u, status: 'disabled' });
}

/** Owner aktifkan kembali user yang dinonaktifkan. */
export async function reactivateUser(username: string): Promise<void> {
  const u = await getStoredUser(username);
  if (!u) throw new Error(`User "${username}" tidak ditemukan.`);
  if (!u.role) throw new Error(`User "${username}" belum punya role — approve dulu, bukan aktifkan.`);
  await saveStoredUser(username, { ...u, status: 'active' });
}
