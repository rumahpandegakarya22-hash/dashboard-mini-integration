/* =========================================================================
   Keputusan tujuan navigasi berdasarkan akses akun (§5.2).

   Diangkat jadi fungsi MURNI dari `app/page.tsx` dan layout route group supaya
   matriks akses (§9 Fase 5.4) bisa diuji tanpa sesi Clerk — gerbang fase itu
   menuntut 4 kombinasi terbukti benar, dan tanpa ini satu-satunya cara
   membuktikannya adalah login manual empat kali.
   ========================================================================= */

import type { AuthState } from './auth';

export type Landing = '/login' | '/2fa' | '/dashboard' | '/ops' | '/inventory' | '/pending';

/**
 * Tujuan akar `/`. Urutan gerbang sengaja: sesi → step-up 2FA → akses.
 *
 * Dashboard didahulukan bila akun punya keduanya: pemakai dua sisi umumnya
 * Owner/Admin yang memulai harinya dari dashboard. Navigasi silang ke Ops
 * tersedia di shell (§9 Fase 5.2).
 */
export function resolveLanding(s: AuthState): Landing {
  if (!s.signedIn) return '/login';
  if (s.needsTotp) return '/2fa';
  if (s.dashboardUser) return '/dashboard';
  if (s.user) return '/ops';
  return '/pending';
}

/** Boleh masuk route group (dashboard)? Selain true = tujuan pengalihan. */
export function guardDashboard(s: AuthState): true | Landing {
  if (!s.signedIn) return '/login';
  if (s.needsTotp) return '/2fa';
  if (!s.dashboardUser) return '/pending';
  return true;
}

/** Boleh masuk route group (ops)? Selain true = tujuan pengalihan. */
export function guardOps(s: AuthState): true | Landing {
  if (!s.signedIn) return '/login';
  if (s.needsTotp) return '/2fa';
  if (!s.user) return '/pending';
  return true;
}

/**
 * Boleh masuk route group (inventory)? Sama persis dengan Ops: pemakainya orang
 * yang sama. Sengaja TIDAK masuk `resolveLanding` — Inventory diakses lewat
 * tautan silang, bukan tujuan akar.
 */
export function guardInventory(s: AuthState): true | Landing {
  return guardOps(s);
}
