import { SignUp } from '@clerk/nextjs';

/** Daftar akun via Clerk. Akun baru berstatus pending sampai di-approve Owner. */
export default function SignUpPage() {
  return (
    <div className="center-page">
      <SignUp routing="hash" signInUrl="/login" fallbackRedirectUrl="/" />
    </div>
  );
}
