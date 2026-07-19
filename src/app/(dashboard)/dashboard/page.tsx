import { getDashboardUser } from '@/lib/core/auth';

/**
 * PLACEHALAMAN Fase 3 — UI Dashboard sesungguhnya dibangun di Fase 4
 * (port app.js → React: shell, chart SVG, tabel, overview per role).
 *
 * Halaman ini sengaja ada supaya router akar §5.2 punya tujuan yang valid dan
 * matriks akses bisa diuji sekarang, bukan berujung 404.
 */
export default async function DashboardPage() {
  const user = await getDashboardUser();
  if (!user) return null; // (dashboard)/layout sudah redirect

  return (
    <main style={{ padding: 24, maxWidth: 640, margin: '0 auto' }}>
      <h1>Dashboard</h1>
      <p>
        Masuk sebagai <strong>{user.name || user.username}</strong> — role <strong>{user.role}</strong>.
      </p>
      <p>
        Antarmuka dashboard (overview per role, chart, tabel) dibangun pada Fase 4 migrasi. Lapisan data
        &amp; API-nya sudah aktif: <code>/api/dashboard/db</code>, <code>/api/dashboard/sheets</code>,
        <code>/api/dashboard/inventory</code>, <code>/api/dashboard/me</code>.
      </p>
    </main>
  );
}
