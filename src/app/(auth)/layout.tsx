/**
 * Layout route group layar auth (login, sign-up, 2fa, pending).
 * URL tidak berubah — route group tidak ikut jadi segmen path.
 *
 * KEPUTUSAN FINAL (Fase 4 langkah 5, menggantikan status interim Fase 1):
 * layar auth memakai identitas visual **Ops** (warm-cream), bukan dark-glass
 * Dashboard. Alasannya bukan selera:
 *
 *  - §2.1 menetapkan layar auth DISATUKAN — satu layar untuk kedua sisi. Karena
 *    hanya satu yang bisa menang, salah satu identitas harus dipilih.
 *  - §9 Fase 4.5 menetapkan basisnya: "Basis Mini App + fitur Dashboard".
 *    Implementasi Mini App-lah yang dipertahankan, jadi visualnya ikut.
 *  - Merancang tema auth ketiga yang netral berarti MENGARANG nilai visual baru,
 *    yang justru dilarang R8. Memakai salah satu tema yang sudah ada lebih jujur.
 *
 * Konsekuensi yang harus disadari: pengguna Dashboard akan melihat layar login
 * yang berbeda dari sebelumnya (terang, bukan gelap). Ini perubahan tampilan
 * yang disengaja dan tercatat — layar login lama (.login-card, .login-role,
 * .login-btn di theme-dashboard.css) menjadi tidak terpakai.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div data-app="ops">{children}</div>;
}
