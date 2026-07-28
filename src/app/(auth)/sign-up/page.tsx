import { SignUp } from '@clerk/nextjs';
import AnimatedAuthCard from '@/components/ui/AnimatedAuthCard';

/**
 * Wajib dinamis: CSP memakai nonce per-request, dan Next hanya bisa menyuntikkan
 * nonce ke <script> saat render server. Halaman statis dibuat saat build ketika
 * header request belum ada — script-nya jadi tanpa nonce, terblokir CSP, dan
 * halaman blank total. Lihat src/lib/core/csp.ts.
 */
export const dynamic = 'force-dynamic';


/** Daftar akun via Clerk. Akun baru berstatus pending sampai di-approve Owner. */
export default function SignUpPage() {
  return (
    <div className="center-page">
      <AnimatedAuthCard>
        <SignUp routing="hash" signInUrl="/login" fallbackRedirectUrl="/" />
      </AnimatedAuthCard>
    </div>
  );
}
