import { SignIn } from '@clerk/nextjs';
import AnimatedAuthCard from '@/components/ui/AnimatedAuthCard';


export const dynamic = 'force-dynamic';



export default function LoginPage() {
  return (
    <div className="center-page">
      <AnimatedAuthCard>
        <SignIn routing="hash" signUpUrl="/sign-up" fallbackRedirectUrl="/" />
      </AnimatedAuthCard>
    </div>
  );
}
