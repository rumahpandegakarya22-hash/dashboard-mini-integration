/* =========================================================================
   Gerbang §9 Fase 5.4 — matriks akses.

   Menguji keputusan navigasi untuk setiap kombinasi akses TANPA sesi Clerk,
   dengan memanggil fungsi murni di `lib/core/routing.ts` yang dipakai langsung
   oleh `app/page.tsx`, `(dashboard)/layout.tsx`, dan `(ops)/layout.tsx`.

   Yang diuji adalah kode yang benar-benar berjalan di produksi — bukan salinan
   logika, sehingga hasil lulus di sini bermakna.

   Pakai: npx tsx scripts/access-matrix-check.ts
   ========================================================================= */
import './_env';
import type { AuthState } from '../src/lib/core/auth';
import { resolveLanding, guardDashboard, guardOps } from '../src/lib/core/routing';

const base: AuthState = {
  signedIn: true,
  status: 'pending',
  needsTotp: false,
  totpEnrolled: false,
  user: null,
  opsRole: null,
  opsStatus: 'pending',
  dashboardUser: null,
  dashboardRole: null,
  dashboardStatus: 'pending'
};

const dashUser = { id: 'u1', username: 'budi', name: 'Budi', role: 'admin' as const };
const opsUser = { id: 'u1', username: 'budi', name: 'Budi', role: 'staff_admin' as const };

interface Case {
  nama: string;
  s: AuthState;
  akar: string;
  dash: string;
  ops: string;
}

const cases: Case[] = [
  {
    nama: 'belum login',
    s: { ...base, signedIn: false },
    akar: '/login', dash: '/login', ops: '/login'
  },
  {
    nama: 'pending (kedua sisi)',
    s: { ...base },
    akar: '/pending', dash: '/pending', ops: '/pending'
  },
  {
    nama: 'dashboard-only',
    s: { ...base, dashboardUser: dashUser, dashboardRole: 'admin', dashboardStatus: 'active' },
    akar: '/dashboard', dash: 'BOLEH', ops: '/pending'
  },
  {
    nama: 'ops-only',
    s: { ...base, user: opsUser, opsRole: 'staff_admin', opsStatus: 'active', status: 'active' },
    akar: '/ops', dash: '/pending', ops: 'BOLEH'
  },
  {
    nama: 'keduanya',
    s: {
      ...base,
      dashboardUser: dashUser, dashboardRole: 'admin', dashboardStatus: 'active',
      user: opsUser, opsRole: 'staff_admin', opsStatus: 'active', status: 'active'
    },
    akar: '/dashboard', dash: 'BOLEH', ops: 'BOLEH'
  },
  // --- kasus tepi di luar 4 kombinasi wajib ---
  {
    nama: '2FA belum step-up (punya keduanya)',
    s: {
      ...base, needsTotp: true, totpEnrolled: true,
      dashboardUser: dashUser, dashboardRole: 'admin', dashboardStatus: 'active',
      user: opsUser, opsRole: 'staff_admin', opsStatus: 'active', status: 'active'
    },
    akar: '/2fa', dash: '/2fa', ops: '/2fa'
  },
  {
    nama: 'dinonaktifkan (disabled kedua sisi)',
    s: { ...base, dashboardStatus: 'disabled', opsStatus: 'disabled', status: 'disabled' },
    akar: '/pending', dash: '/pending', ops: '/pending'
  }
];

const show = (v: true | string) => (v === true ? 'BOLEH' : v);

let gagal = 0;
console.log('\nMatriks akses — keputusan navigasi per kombinasi\n');
console.log('  kombinasi                        akar        (dashboard)  (ops)');
console.log('  ' + '-'.repeat(70));

for (const c of cases) {
  const akar = resolveLanding(c.s);
  const dash = show(guardDashboard(c.s));
  const ops = show(guardOps(c.s));
  const ok = akar === c.akar && dash === c.dash && ops === c.ops;
  if (!ok) gagal++;
  console.log(
    `  ${ok ? '✓' : '✗'} ${c.nama.padEnd(31)} ${akar.padEnd(11)} ${dash.padEnd(12)} ${ops}`
  );
  if (!ok) console.log(`      diharapkan: ${c.akar} / ${c.dash} / ${c.ops}`);
}

console.log(
  gagal === 0
    ? '\n✅ MATRIKS AKSES LULUS — semua kombinasi berperilaku benar.\n'
    : `\n❌ ${gagal} kombinasi salah.\n`
);
process.exit(gagal === 0 ? 0 : 1);
