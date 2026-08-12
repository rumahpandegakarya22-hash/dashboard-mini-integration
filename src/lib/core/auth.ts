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

import { cache } from 'react';
import { auth, currentUser, clerkClient } from '@clerk/nextjs/server';
import type { User } from '@clerk/nextjs/server';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { ROLE_LABEL, type Role } from './roles';
import { DASHBOARD_ROLES, type DashboardRole } from '@/config/dashboard-access';

export interface SessionUser {
  id: string; // Clerk userId — dipakai panel admin & metadata ops
  username: string;
  name: string;
  role: Role;
}

/** Padanan SessionUser untuk sisi Dashboard (5 role, namespace metadata sendiri). */
export interface DashboardSessionUser {
  id: string;
  username: string;
  name: string;
  role: DashboardRole;
}

export type UserStatus = 'pending' | 'active' | 'disabled';

/**
 * Status auth gabungan utk gating halaman: login Clerk → approval → step-up 2FA.
 *
 * DUA namespace otorisasi hidup berdampingan di satu instance Clerk (§5.1):
 *   - Dashboard : publicMetadata.role      / publicMetadata.status
 *   - Ops       : publicMetadata.miniappRole / publicMetadata.miniappStatus
 * Ini disengaja: Owner bisa memberi akses Ops tanpa akses Dashboard, dan
 * sebaliknya. Menyatukan taksonomi role = keputusan bisnis, di luar scope migrasi.
 *
 * Aman karena Clerk `updateUserMetadata()` melakukan DEEP MERGE (terverifikasi
 * dari dokumentasi resmi) — menulis satu namespace tidak menghapus namespace lain.
 * Yang mengganti total adalah `replaceUserMetadata()`, yang TIDAK dipakai di sini.
 */
export interface AuthState {
  signedIn: boolean;
  /** Status namespace OPS. Dipertahankan namanya demi kompatibilitas kode ops. */
  status: UserStatus | null; // null = belum login
  /** true = akun aktif (di salah satu sisi) dgn 2FA aktif tapi sesi ini belum verifikasi TOTP. */
  needsTotp: boolean;
  totpEnrolled: boolean;
  /** Terisi hanya jika miniappStatus active + punya miniappRole valid. */
  user: SessionUser | null;
  opsRole: Role | null;
  opsStatus: UserStatus;
  /** Terisi hanya jika status active + punya role dashboard valid. */
  dashboardUser: DashboardSessionUser | null;
  dashboardRole: DashboardRole | null;
  dashboardStatus: UserStatus;
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

// ---- pembacaan metadata (namespace Dashboard) ----
// Kunci `role`/`status` tanpa prefix — persis seperti server.js Dashboard lama.

function dashRole(u: User): DashboardRole | null {
  const r = (u.publicMetadata as Record<string, unknown>)?.role;
  return typeof r === 'string' && (DASHBOARD_ROLES as readonly string[]).includes(r)
    ? (r as DashboardRole)
    : null;
}

function dashStatus(u: User): UserStatus {
  const s = (u.publicMetadata as Record<string, unknown>)?.status;
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

/**
 * Nama cookie step-up dipakai BERSAMA kedua sisi (§5.2). Sengaja memakai nama
 * lama Dashboard (`ktd_2fa`), bukan `miniapp_2fa`: mayoritas pemakai 2FA hari
 * ini ada di Dashboard, jadi sesi 2FA mereka tidak putus saat cutover.
 * Konsekuensi yang diterima (R4): pengguna Ops verifikasi ulang sekali; cookie
 * `miniapp_2fa` lama dibiarkan kedaluwarsa sendiri.
 *
 * Isi & algoritma tanda tangan TIDAK berubah dari implementasi Mini App (jose /
 * HS256, terikat sessionId). Dashboard lama memakai `jsonwebtoken` dengan
 * payload berbeda, jadi cookie lamanya tidak akan lolos verifikasi di sini —
 * pengguna dashboard pun verifikasi ulang sekali saat cutover.
 */
export const STEPUP_COOKIE = 'ktd_2fa';
/** Cookie step-up Mini App yang usang — dihapus saat verifikasi berhasil. */
export const LEGACY_STEPUP_COOKIE = 'miniapp_2fa';
const STEPUP_HOURS = 12;

function stepupSecret(): Uint8Array {
  const s = process.env.TOTP_STEPUP_SECRET;
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
  const jar = await cookies();
  jar.set(STEPUP_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: STEPUP_HOURS * 3600,
    path: '/'
  });
  // Bersihkan cookie step-up Mini App yang usang supaya tidak menumpuk.
  if (jar.get(LEGACY_STEPUP_COOKIE)) jar.delete(LEGACY_STEPUP_COOKIE);
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

const SIGNED_OUT: AuthState = {
  signedIn: false,
  status: null,
  needsTotp: false,
  totpEnrolled: false,
  user: null,
  opsRole: null,
  opsStatus: 'pending',
  dashboardUser: null,
  dashboardRole: null,
  dashboardStatus: 'pending'
};

/**
 * Bypass login KHUSUS pengembangan lokal. Aktif hanya bila DUA syarat terpenuhi
 * sekaligus: build bukan production DAN `DEV_BYPASS_AUTH=1` disetel manual di
 * .env.local. Satu syarat saja tidak cukup — `NODE_ENV` di Vercel selalu
 * 'production', jadi variabel yang tidak sengaja terbawa ke sana tetap mati.
 *
 * Tanpa ini, memeriksa tampilan /ops di lokal butuh sesi Clerk yang valid.
 */
function bypassDev(): AuthState | null {
  if (process.env.NODE_ENV === 'production' || process.env.DEV_BYPASS_AUTH !== '1') return null;
  const palsu: SessionUser = { id: 'dev-bypass', username: 'dev', name: 'Dev Lokal', role: 'owner' };
  return {
    signedIn: true,
    status: 'active',
    needsTotp: false,
    totpEnrolled: false,
    user: palsu,
    opsRole: 'owner',
    opsStatus: 'active',
    dashboardUser: { ...palsu, role: 'owner' },
    dashboardRole: 'owner',
    dashboardStatus: 'active'
  };
}

/**
 * Di-memo per request (React cache): satu navigasi RSC menjalankan layout
 * (getAuthState) + page (getSessionUser→getAuthState). Tanpa memo, `currentUser()`
 * (round-trip ke Clerk) dipanggil 2×/navigasi. cache() menjadikannya 1×.
 */
export const getAuthState = cache(async (): Promise<AuthState> => {
  const lewat = bypassDev();
  if (lewat) return lewat;

  const { userId, sessionId } = await auth();
  if (!userId || !sessionId) return { ...SIGNED_OUT };

  const cu = await currentUser();
  if (!cu) return { ...SIGNED_OUT };

  const opsStatus = metaStatus(cu);
  const opsRole = metaRole(cu);
  const dashboardStatus = dashStatus(cu);
  const dashboardRole = dashRole(cu);

  const totpEnrolled = !!(cu.privateMetadata as Record<string, unknown>)?.totpEnabled;
  const opsActive = opsStatus === 'active' && !!opsRole;
  const dashboardActive = dashboardStatus === 'active' && !!dashboardRole;

  // 2FA menjaga KEDUA sisi: aktif di salah satu saja sudah cukup untuk diwajibkan.
  const needsTotp = (opsActive || dashboardActive) && totpEnrolled && !(await hasValidStepup(sessionId));

  return {
    signedIn: true,
    status: opsStatus,
    needsTotp,
    totpEnrolled,
    user: opsActive ? toSessionUser(cu, opsRole!) : null,
    opsRole,
    opsStatus,
    dashboardUser: dashboardActive
      ? {
          id: cu.id,
          username: cu.username || primaryEmail(cu) || cu.id,
          name: displayName(cu),
          role: dashboardRole!
        }
      : null,
    dashboardRole,
    dashboardStatus
  };
});

/**
 * User Dashboard terautentikasi PENUH (login + status active + role valid +
 * lolos step-up 2FA bila aktif). Padanan `requireAuth` Express lama.
 */
export async function getDashboardUser(): Promise<DashboardSessionUser | null> {
  const s = await getAuthState();
  return s.needsTotp ? null : s.dashboardUser;
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
  if (!cu) return null;
  // Aktif di SALAH SATU namespace sudah cukup: 2FA kini melayani kedua sisi,
  // jadi pengguna dashboard-only pun harus bisa setup/verify TOTP.
  if (metaStatus(cu) !== 'active' && dashStatus(cu) !== 'active') return null;
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

// ---- kelola akun sisi DASHBOARD (padanan /api/users Express lama) ----------
// Bentuk respons dipertahankan 1:1 dengan server.js agar kontrak API tidak
// berubah (§8.1). Perhatikan: yang lama memakai `username` sbg identifier, bukan
// Clerk userId — dipertahankan supaya klien lama tetap kompatibel.

export interface DashboardAdminUserRow {
  username: string;
  name: string;
  role: DashboardRole | null;
  status: UserStatus;
  tfaEnabled: boolean;
  email: string | null;
}

/** Padanan `GET /api/users` — bentuk & urutan field identik server.js. */
export async function listDashboardUsers(): Promise<DashboardAdminUserRow[]> {
  const client = await clerkClient();
  const list = await client.users.getUserList({ limit: 200, orderBy: '-created_at' });
  return (list.data || []).map((u) => ({
    username: u.username || u.id,
    name:
      ((u.unsafeMetadata as Record<string, unknown>)?.name as string) ||
      [u.firstName, u.lastName].filter(Boolean).join(' ') ||
      u.username ||
      '',
    role: dashRole(u),
    status: dashStatus(u),
    tfaEnabled: !!(u.privateMetadata as Record<string, unknown>)?.totpEnabled,
    email: u.emailAddresses?.[0]?.emailAddress || null
  }));
}

async function findByUsername(username: string): Promise<User | null> {
  const client = await clerkClient();
  // Kalau username adalah Clerk user ID (user_xxx), pakai getUser langsung — getUserList
  // dengan filter username tidak akan menemukan user yang login pakai OAuth (tanpa username).
  if (String(username).startsWith('user_')) {
    try {
      return await client.users.getUser(username);
    } catch {
      return null;
    }
  }
  const list = await client.users.getUserList({ username: [String(username || '')] });
  return (list.data || [])[0] || null;
}

/** Padanan `POST /api/users/approve`. Deep-merge Clerk → namespace ops tidak tersentuh. */
export async function approveDashboardUser(username: string, role: DashboardRole): Promise<'ok' | 'notfound'> {
  const u = await findByUsername(username);
  if (!u) return 'notfound';
  const client = await clerkClient();
  await client.users.updateUserMetadata(u.id, { publicMetadata: { role, status: 'active' } });
  // Best-effort: bersihkan ban lama (dari versi sebelumnya sebelum banUser diketahui
  // Pro-only). Akses tidak lagi bergantung pada ini, jadi kegagalan sengaja diabaikan.
  try {
    await client.users.unbanUser(u.id);
  } catch {
    /* abaikan — lihat komentar di atas */
  }
  return 'ok';
}

/** Padanan `POST /api/users/disable`. */
export async function disableDashboardUser(username: string): Promise<'ok' | 'notfound'> {
  const u = await findByUsername(username);
  if (!u) return 'notfound';
  const client = await clerkClient();
  await client.users.updateUserMetadata(u.id, { publicMetadata: { status: 'disabled' } });
  return 'ok';
}
