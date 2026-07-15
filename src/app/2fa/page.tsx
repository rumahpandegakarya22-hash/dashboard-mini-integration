import { redirect } from 'next/navigation';
import { getAuthState } from '@/lib/auth';
import TotpVerifyForm from '@/components/TotpVerifyForm';

/** Step-up 2FA setelah login Clerk: minta kode Google Authenticator. */
export default async function TwoFaPage() {
  const s = await getAuthState();
  if (!s.signedIn) redirect('/login');
  if (!s.needsTotp) redirect('/'); // tidak perlu / sudah lolos step-up

  return (
    <div className="center-page">
      <TotpVerifyForm />
    </div>
  );
}
