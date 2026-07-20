import { redirect } from 'next/navigation';
import { getAuthState } from '@/lib/core/auth';
import { DEFAULT_PERIOD } from '@/config/dashboard-nav';
import DashboardShell from '@/components/dashboard/DashboardShell';
import TotpSettings from '@/components/TotpSettings';
import UnifiedUserAdmin from '@/components/dashboard/UnifiedUserAdmin';

/**
 * Akun & Keamanan — PORT dari modal `openSecurityModal()` public/app.js
 * (`renderTfa` + `renderOwnerUsers`).
 *
 * Perbedaan yang disengaja: di app.js ini MODAL yang dibuka dari ikon gembok;
 * di sini halaman ber-URL sendiri (`/dashboard/akun`) supaya bisa di-bookmark,
 * di-back, dan di-deep-link. Ikon gembok di sidebar menautkannya.
 *
 * `renderPassword()` TIDAK di-port: ganti password di app.js memanggil
 * `clerk.user.updatePassword()` langsung. Di app terpadu, pengelolaan password
 * (termasuk ganti & lupa password) ditangani komponen Clerk pada layar auth —
 * satu jalur, bukan dua. Dicatat di docs/MIGRASI.md.
 *
 * TotpSettings dipakai bersama dengan sisi Ops: secret TOTP memang satu untuk
 * kedua app (§5.2), jadi mengaktifkan 2FA di sini berlaku juga di /ops.
 */
export default async function DashboardAkunPage({
  searchParams
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const s = await getAuthState();
  if (!s.dashboardUser) redirect('/pending');

  const sp = await searchParams;
  const user = s.dashboardUser;
  const period = sp.period || DEFAULT_PERIOD;

  return (
    <DashboardShell
      role={user.role}
      userName={user.name || user.username}
      tfaEnabled={s.totpEnrolled}
      hasOpsAccess={!!s.user}
      view="akun"
      crumb="Akun & Keamanan"
      period={period}
      from={sp.from}
      to={sp.to}
    >
      <section className="view">
        <h2 className="section-title">AKUN &amp; KEAMANAN</h2>

        <div className="sec-card">
          <h3>
            Autentikasi Dua Faktor <small>(Google Authenticator)</small>
          </h3>
          <p className="muted" style={{ marginBottom: 10 }}>
            Satu kali scan QR berlaku untuk Dashboard maupun Mini App Operasional — keduanya memakai
            secret yang sama.
          </p>
          <TotpSettings initialEnrolled={s.totpEnrolled} />
        </div>

        {user.role === 'owner' && <UnifiedUserAdmin />}
      </section>
    </DashboardShell>
  );
}
