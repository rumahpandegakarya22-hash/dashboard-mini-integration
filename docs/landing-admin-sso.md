# Setting Landing Page: tautan dari dashboard

Admin landing page ada di proyek terpisah (`tigadaralandingpage`, database dan password adminnya sendiri). Dashboard tidak lagi punya editor landing; ia hanya membuka admin itu di tab baru dan masuk otomatis.

## Cara kerja

1. Pengguna klik **Setting Landing Page** (kartu "Website" di beranda Ops, sidebar Ops "Aplikasi Lain", atau sidebar Dashboard "Aplikasi Lain"). Tautan `target="_blank"` mengarah ke `/api/ops/landing-admin/masuk`.
2. Route itu memeriksa login (termasuk 2FA bila aktif) dan peran, mencatat satu baris `audit_log` (`landing-admin`), lalu menerbitkan **tiket** JWT HS256 yang berlaku 60 detik dan mengarahkan browser ke `{LANDING_ADMIN_URL}/admin/sso?token=...`.
3. Landing (`app/admin/sso/route.ts`) memverifikasi tiket (issuer `kost-dashboard`, audience `landing-admin`, tanda tangan, masa berlaku maksimal 120 detik), membuat cookie `admin_session` yang sama dengan login password, lalu mengalihkan ke `/admin`. Tiket tidak sah: dialihkan ke `/admin/login`.

## Siapa yang boleh

Hanya **owner, admin, dan marketing**. Satu akun bisa punya peran di kedua sisi dengan nama berbeda; cukup salah satu yang berhak:

| Sisi | Peran yang boleh |
|---|---|
| Dashboard | `owner`, `admin`, `marketing` |
| Mini App Ops | `owner`, `staff_admin`, `staff_marketing` |

Peran lain (termasuk `pengawas`, `operasional`, `sales`) tidak melihat menunya dan route-nya membalas 403. Pengecekan yang sama dilakukan di server (route), bukan hanya dengan menyembunyikan menu.

## Tentang password

Dari menu, pengguna **tidak mengetik password**: tiket menggantikannya, dan sesi hasil tukar berlaku 7 hari di browser itu. Password admin landing **tidak** dikirim atau disimpan di dashboard.

Halaman `/admin` di landing **tetap meminta password bila diakses langsung** (tanpa lewat menu dashboard atau tanpa sesi 7 hari tadi). Situs landing itu publik, jadi menghapus password sama dengan membiarkan siapa pun yang mengetik `/admin` mengubah isi situs. Login password biasa tetap berfungsi sebagai jalur cadangan.

## Variabel lingkungan

| Variabel | Di mana | Isi |
|---|---|---|
| `LANDING_SSO_SECRET` | dashboard **dan** landing (nilai harus sama) | string acak minimal 32 karakter, mis. `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `LANDING_ADMIN_URL` | dashboard (opsional) | basis URL landing; bawaan `https://tigadaralandingpage.vercel.app` |

Tanpa `LANDING_SSO_SECRET` di dashboard, route membalas 503 "Penghubung admin landing belum dikonfigurasi." Tanpa rahasia yang sama di landing, tiket selalu ditolak dan pengguna jatuh ke halaman login.

Mengganti rahasia: ubah di kedua proyek Vercel lalu redeploy keduanya; tiket yang beredar kedaluwarsa sendiri dalam 60 detik.

## Batasan

- Tiket ada di URL selama satu pengalihan dan berlaku 60 detik; landing mengalihkan segera sehingga token tidak tertinggal di address bar. Tiket tidak sekali-pakai (tanpa penyimpanan), jadi dalam 60 detik itu siapa pun yang memegang URL-nya bisa memakainya.
- Sesi hasil tukar berlaku 7 hari, sama dengan login password.
- Tabel `landing_*` di database dashboard tidak lagi dipakai kode mana pun. Tabel itu **belum dihapus**: sebagian berisi URL foto Google Drive asli yang tidak ada di database landing.

## Pengujian

- Dashboard: `npx tsx --test src/lib/landing-admin.test.ts`
- Landing: `lib/sso.test.ts` (menguji verifikasi tiket; jalankan dengan `tsx --test lib/sso.test.ts`)
