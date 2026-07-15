import { ShieldCheck } from 'lucide-react';
import { getAuthState } from '@/lib/auth';
import TotpSettings from '@/components/TotpSettings';

/** Pengaturan akun: aktifkan/matikan 2FA (Google Authenticator). */
export default async function AccountPage() {
  const s = await getAuthState();
  if (!s.user) return null; // (app)/layout sudah redirect

  return (
    <>
      <header className="page-head">
        <span className="icon-tile lg" aria-hidden>
          <ShieldCheck size={24} />
        </span>
        <div>
          <h1 style={{ fontSize: '1.375rem' }}>Keamanan Akun</h1>
          <p className="page-head-sub">Autentikasi dua faktor (Google Authenticator)</p>
        </div>
      </header>
      <TotpSettings initialEnrolled={s.totpEnrolled} />
    </>
  );
}
