import { redirect } from 'next/navigation';
import { getAuthState } from '@/lib/core/auth';
import { resolveLanding } from '@/lib/core/routing';

/**
 * Router akar (§5.2). Keputusannya ada di `lib/core/routing.ts` sebagai fungsi
 * murni supaya matriks akses bisa diuji tanpa sesi Clerk.
 *
 * Halaman ini sengaja di luar route group mana pun agar tidak mewarisi gating
 * (ops)/(dashboard) maupun tema (auth).
 */
export default async function RootPage() {
  redirect(resolveLanding(await getAuthState()));
}
