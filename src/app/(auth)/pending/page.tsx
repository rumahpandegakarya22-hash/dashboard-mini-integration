import { SignOutButton } from '@clerk/nextjs';
import { Hourglass } from 'lucide-react';

export default function PendingPage() {
  return (
    <div className="center-page">
      <div className="center-card card success-card">
        <span className="icon-tile lg warn" aria-hidden>
          <Hourglass size={26} />
        </span>
        <h2>Menunggu Persetujuan</h2>
        <p className="muted">
          Akun kamu sudah terdaftar tapi belum diaktifkan untuk Mini App. Hubungi Owner untuk approve akun &amp;
          menentukan role kamu. Setelah disetujui, login lagi dan kamu langsung bisa masuk.
        </p>
        <SignOutButton redirectUrl="/login">
          <button type="button" className="btn" style={{ marginTop: 6 }}>
            Keluar
          </button>
        </SignOutButton>
      </div>
    </div>
  );
}
