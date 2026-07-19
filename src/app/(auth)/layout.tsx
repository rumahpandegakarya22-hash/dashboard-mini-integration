/**
 * Layout route group layar auth (login, sign-up, 2fa, pending).
 * URL tidak berubah — route group tidak ikut jadi segmen path.
 *
 * INTERIM Fase 1: layar auth hari ini adalah layar milik Mini App dan memakai
 * kelas/token ops (lihat blok "Login & sukses" di theme-ops.css), jadi wrapper
 * di-set `data-app="ops"` supaya tampilannya identik dengan sebelum migrasi.
 * Fase 4 langkah 5 menyatukan layar auth untuk kedua sisi; saat itu wrapper ini
 * diganti tema auth tersendiri. Dicatat di docs/MIGRASI.md.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div data-app="ops">{children}</div>;
}
