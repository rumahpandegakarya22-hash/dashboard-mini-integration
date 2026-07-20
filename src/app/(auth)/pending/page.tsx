import { SignOutButton } from '@clerk/nextjs';
import { Hourglass } from 'lucide-react';

/**
 * Wajib dinamis: CSP memakai nonce per-request, dan Next hanya bisa menyuntikkan
 * nonce ke <script> saat render server. Halaman statis dibuat saat build ketika
 * header request belum ada — script-nya jadi tanpa nonce, terblokir CSP, dan
 * halaman blank total. Lihat src/lib/core/csp.ts.
 */
export const dynamic = 'force-dynamic';


export default function PendingPage() {
  return (
    <div className="center-page">
      <div className="center-card card success-card">
        <span className="icon-tile lg warn" aria-hidden>
          <Hourglass size={26} />
        </span>
        <h2>Menunggu Persetujuan</h2>
        <p className="muted">
          Akun kamu sudah terdaftar tapi belum diaktifkan. Hubungi Owner untuk approve akun &amp; menentukan
          role kamu — akses Dashboard dan Mini App Operasional diberikan terpisah, jadi sebutkan yang kamu
          butuhkan. Setelah disetujui, login lagi dan kamu langsung bisa masuk.
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
