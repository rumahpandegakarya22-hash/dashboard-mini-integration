// Auth berbasis Clerk (login username/password + Google/Apple + lupa password
// ditangani Clerk — server ini tidak pernah melihat password), mengikuti pola
// "Dashboard Figma" (instance Clerk SAMA):
//   - Role & status approval Mini App hidup di Clerk publicMetadata dengan
//     namespace sendiri (miniappRole/miniappStatus) — TIDAK menyentuh
//     role/status milik dashboard (publicMetadata.role/status) di instance yang sama.
//   - Status default (metadata belum ada) = 'pending' → akun baru wajib
//     di-approve Owner dulu, webhook user.created opsional.
//   - 2FA TOTP KUSTOM (Google Authenticator, bukan MFA Clerk): secret di
//     privateMetadata (totpSecret/totpEnabled — key SAMA dgn dashboard, jadi
//     satu kali scan QR berlaku utk kedua app). Sesi Clerk yang valid saja
//     belum cukup bila 2FA aktif — wajib cookie step-up (lihat bawah).

import { auth, currentUser, clerkClient } from '@clerk/nextjs/server';
import type { User } from '@clerk/nextjs/server';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { ROLE_LABEL, type Role } from './roles';

export interface SessionUser {
  id: string; // Clerk userId — dipakai panel admin & metadata ops
  username: string;
  name: string;
  role: Role;
}

export type UserStatus = 'pending' | 'active' | 'disabled';

/** Status auth lengkap utk gating halaman: login Clerk → approval → step-up 2FA. */
export interface AuthState {
  signedIn: boolean;
  status: UserStatus | null; // null = belum login
  /** true = akun aktif dgn 2FA aktif tapi sesi ini belum verifikasi TOTP (arahkan ke /2fa). */
  needsTotp: boolean;
  totpEnrolled: boolean;
  user: SessionUser | null; // terisi hanya jika status active + punya role valid
}

// ---- pembacaan metadata (namespace Mini App) ----

function metaRole(u: User): Role | null {
  const r = (u.publicMetadata as Record<string, unknown>)?.miniappRole;
  return typeof r === 'string' && r in ROLE_LABEL ? (r as Role) : null;
}

function metaStatus(u: User): UserStatus {
  const s = (u.publicMetadata as Record<string, unknown>)?.miniappStatus;
  return s === 'active' || s === 'disabled' ? s : 'pending';
}

function displayName(u: User): string {
  return [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username || primaryEmail(u) || u.id;
}

function primaryEmail(u: User): string {
  return u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId)?.emailAddress || u.emailAddresses[0]?.emailAddress || '';
}

function toSessionUser(u: User, role: Role): SessionUser {
  return { id: u.id, username: u.username || primaryEmail(u) || u.id, name: displayName(u), role };
}

// ---- cookie step-up 2FA: bukti "sesi Clerk INI sudah lolos verifikasi TOTP".
// Ditandatangani (jose/HS256) + terikat sessionId Clerk spesifik, supaya tidak
// bisa dipakai ulang di sesi lain (login ulang = wajib TOTP lagi). ----

export const STEPUP_COOKIE = 'miniapp_2fa';
const STEPUP_HOURS = 12;

function stepupSecret(): Uint8Array {
  const s = process.env.TOTP_STEPUP_SECRET || process.env.JWT_SECRET;
  if (!s) throw new Error('TOTP_STEPUP_SECRET belum di-set.');
  return new TextEncoder().encode(s);
}

/** Panggil HANYA dari Route Handler (cookies().set tidak boleh di Server Component). */
export async function issueStepupCookie(sessionId: string): Promise<void> {
  const token = await new SignJWT({ sid: sessionId, purpose: '2fa' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${STEPUP_HOURS}h`)
    .sign(stepupSecret());
  (await cookies()).set(STEPUP_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: STEPUP_HOURS * 3600,
    path: '/'
  });
}

async function hasValidStepup(sessionId: string): Promise<boolean> {
  const token = (await cookies()).get(STEPUP_COOKIE)?.value;
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, stepupSecret());
    return payload.purpose === '2fa' && payload.sid === sessionId;
  } catch {
    return false;
  }
}

// ---- gerbang utama ----

export async function getAuthState(): Promise<AuthState> {
  const { userId, sessionId } = await auth();
  if (!userId || !sessionId) return { signedIn: false, status: null, needsTotp: false, totpEnrolled: false, user: null };

  const cu = await currentUser();
  if (!cu) return { signedIn: false, status: null, needsTotp: false, totpEnrolled: false, user: null };

  const status = metaStatus(cu);
  const role = metaRole(cu);
  const totpEnrolled = !!(cu.privateMetadata as Record<string, unknown>)?.totpEnabled;
  const active = status === 'active' && !!role;
  const needsTotp = active && totpEnrolled && !(await hasValidStepup(sessionId));

  return {
    signedIn: true,
    status,
    needsTotp,
    totpEnrolled,
    user: active ? toSessionUser(cu, role!) : null
  };
}

/**
 * User terautentikasi PENUH (login Clerk + status active + role + lolos step-up
 * 2FA bila aktif). Dipakai semua API route bisnis — kontrak sama dgn versi lama.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const s = await getAuthState();
  return s.needsTotp ? null : s.user;
}

/**
 * Sesi Clerk valid + akun berstatus active, TANPA syarat step-up 2FA — khusus
 * endpoint TOTP itu sendiri (setup/enable/verify), karena di titik itu step-up
 * memang belum ada. Return juga objek User Clerk (utk baca privateMetadata).
 */
export async function getClerkSessionUser(): Promise<{ user: User; sessionId: string } | null> {
  const { userId, sessionId } = await auth();
  if (!userId || !sessionId) return null;
  const cu = await currentUser();
  if (!cu || metaStatus(cu) !== 'active') return null;
  return { user: cu, sessionId };
}

// ---- kelola user (panel admin Owner) — via Clerk Backend API ----

export interface AdminUserRow {
  id: string;
  username: string;
  name: string;
  role: Role | null;
  status: UserStatus;
  authProvider: string;
  email?: string;
  createdAt: string;
}

export async function listAllUsers(): Promise<AdminUserRow[]> {
  const client = await clerkClient();
  const { data } = await client.users.getUserList({ limit: 200, orderBy: '-created_at' });
  return data.map((u) => ({
    id: u.id,
    username: u.username || primaryEmail(u) || u.id,
    name: displayName(u),
    role: metaRole(u),
    status: metaStatus(u),
    authProvider: u.externalAccounts[0]?.provider?.replace(/^oauth_/, '') || (u.passwordEnabled ? 'password' : '-'),
    email: primaryEmail(u) || undefined,
    createdAt: new Date(u.createdAt).toISOString()
  }));
}

/** Merge per-key oleh Clerk — miniappRole/miniappStatus tidak menimpa metadata milik dashboard. */
async function patchMiniappMetadata(userId: string, patch: { miniappRole?: Role; miniappStatus?: UserStatus }): Promise<void> {
  const client = await clerkClient();
  await client.users.updateUserMetadata(userId, { publicMetadata: patch });
}

export async function approveUser(userId: string, role: Role): Promise<void> {
  await patchMiniappMetadata(userId, { miniappRole: role, miniappStatus: 'active' });
}

export async function setUserRole(userId: string, role: Role): Promise<void> {
  await patchMiniappMetadata(userId, { miniappRole: role });
}

export async function deactivateUser(userId: string): Promise<void> {
  await patchMiniappMetadata(userId, { miniappStatus: 'disabled' });
}

export async function reactivateUser(userId: string): Promise<void> {
  const client = await clerkClient();
  const u = await client.users.getUser(userId);
  if (!metaRole(u)) throw new Error('User belum punya role Mini App — approve dulu, bukan aktifkan.');
  await patchMiniappMetadata(userId, { miniappStatus: 'active' });
}
