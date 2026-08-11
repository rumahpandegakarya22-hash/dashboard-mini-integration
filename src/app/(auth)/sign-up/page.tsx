import { SignUp } from '@clerk/nextjs';
import AnimatedAuthCard from '@/components/ui/AnimatedAuthCard';

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
