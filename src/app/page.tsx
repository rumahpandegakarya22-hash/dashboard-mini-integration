import { redirect } from 'next/navigation';

/**
 * Router akar.
 *
 * SEMENTARA (Fase 1): dashboard belum ada, jadi semua diarahkan ke /ops.
 * Fase 3 langkah 3 menggantikan ini dengan dispatch sesuai akses (§5.2):
 * punya akses dashboard → /dashboard; hanya ops → /ops; keduanya pending → /pending.
 *
 * Halaman ini sengaja tidak di dalam route group mana pun supaya tidak
 * mewarisi gating (ops) maupun tema (auth).
 */
export default function RootPage() {
  redirect('/ops');
}
