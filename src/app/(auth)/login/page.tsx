import { SignIn } from '@clerk/nextjs';

/**
 * Login via Clerk: username/email + password, Google, Apple, dan lupa password —
 * semuanya komponen <SignIn/> (metode aktif diatur di Clerk Dashboard).
 * routing="hash" agar tidak butuh catch-all route. Setelah login, (app)/layout
 * yang memutuskan tujuan: beranda, /pending (belum di-approve), atau /2fa.
 */
export default function LoginPage() {
  return (
    <div className="center-page">
      <SignIn routing="hash" signUpUrl="/sign-up" fallbackRedirectUrl="/" />
    </div>
  );
}
