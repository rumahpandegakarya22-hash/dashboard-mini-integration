import { SignIn } from '@clerk/nextjs';

/**
 * Wajib dinamis: CSP memakai nonce per-request, dan Next hanya bisa menyuntikkan
 * nonce ke <script> saat render server. Halaman statis dibuat saat build ketika
 * header request belum ada — script-nya jadi tanpa nonce, terblokir CSP, dan
 * halaman blank total. Lihat src/lib/core/csp.ts.
 */
export const dynamic = 'force-dynamic';


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
