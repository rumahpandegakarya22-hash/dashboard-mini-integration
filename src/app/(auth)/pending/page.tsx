import { SignOutButton } from '@clerk/nextjs';
import { Hourglass } from 'lucide-react';
import AnimatedAuthCard from '@/components/ui/AnimatedAuthCard';

export const dynamic = 'force-dynamic';


export default function PendingPage() {
  return (
    <div className="center-page">
      <AnimatedAuthCard className="center-card card success-card">
        <span className="icon-tile lg warn" aria-hidden>
          <Hourglass size={26} />
        </span>
        <h2>Menunggu Persetujuan</h2>
        <p className="muted">
          Akun kamu sudah terdaftar. Hubungi Owner untuk approval akun.
        </p>
        <SignOutButton redirectUrl="/login">
          <button type="button" className="btn" style={{ marginTop: 6 }}>
            Keluar
          </button>
        </SignOutButton>
      </AnimatedAuthCard>
    </div>
  );
}
