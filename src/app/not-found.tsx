import Link from 'next/link';

/**
 * Halaman 404. Wajib dinamis dengan alasan yang sama seperti layar auth:
 * CSP memakai nonce per-request, dan halaman statis dibuat saat build ketika
 * header request belum ada — script-nya jadi tanpa nonce, terblokir, halaman
 * blank. Tanpa ini, pengguna ber-sesi yang salah URL mendapat 404 kosong.
 */
export const dynamic = 'force-dynamic';

export default function NotFound() {
  return (
    <div data-app="ops">
      <div className="center-page">
        <div className="center-card card">
          <h2>Halaman tidak ditemukan</h2>
          <p className="muted">
            Alamat yang kamu buka tidak ada, atau kamu tidak punya akses ke bagian itu.
          </p>
          <Link href="/" className="btn" style={{ marginTop: 10 }}>
            Kembali
          </Link>
        </div>
      </div>
    </div>
  );
}
