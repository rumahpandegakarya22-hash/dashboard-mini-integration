import { redirect } from 'next/navigation';
import { getAuthState } from '@/lib/core/auth';

/**
 * Router akar (§5.2). Mengarahkan sesuai akses yang dimiliki akun:
 *   punya akses Dashboard  → /dashboard
 *   hanya akses Ops        → /ops
 *   belum di-approve / tanpa role di keduanya → /pending
 *   2FA aktif tapi sesi belum step-up         → /2fa
 *
 * Dashboard didahulukan bila punya keduanya: pemakai dua sisi umumnya Owner/
 * Admin yang memulai harinya dari dashboard. Navigasi silang ke Ops disediakan
 * di shell (Fase 5).
 *
 * Halaman ini sengaja di luar route group mana pun agar tidak mewarisi gating
 * (ops) maupun tema (auth).
 */
export default async function RootPage() {
  const s = await getAuthState();

  if (!s.signedIn) redirect('/login');
  if (s.needsTotp) redirect('/2fa');
  if (s.dashboardUser) redirect('/dashboard');
  if (s.user) redirect('/ops');
  redirect('/pending');
}
