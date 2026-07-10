import Link from 'next/link';
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
          Akun kamu sudah terdaftar lewat Google, tapi belum diaktifkan. Hubungi Owner untuk approve akun &amp;
          menentukan role kamu. Setelah disetujui, login lagi dengan tombol &quot;Daftar / Masuk dengan Google&quot; di
          halaman login.
        </p>
        <Link href="/login" className="btn" style={{ marginTop: 6 }}>
          Kembali ke Login
        </Link>
      </div>
    </div>
  );
}
