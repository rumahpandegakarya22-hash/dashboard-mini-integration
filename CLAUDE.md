# CLAUDE.md

Sebelum mengerjakan apa pun di proyek ini, baca dulu ketiga file berikut secara berurutan:

1. `/SETUP/ABOUT_ME.md` — siapa saya, konteks bisnis, goals, cara kerja saya
2. `/SETUP/OUTPUTS.md` — standar output yang harus diikuti di setiap respons
3. `/SETUP/TEMPLATES.md` — template dokumen yang sudah ada, jangan duplikat, perbaiki yang existing

## Konteks Proyek Ini Secara Spesifik
- Stack: Next.js, React (TypeScript), Turso (libSQL), sebagian integrasi Google Workspace.
- Ini adalah sistem administrasi operasional kost (2 properti, 90 kamar) — mencakup keuangan, manajemen penyewa, check-in/out, kegiatan operasional, feedback, data vendor, dokumen penyewa.
- Developer (saya) punya skill coding dasar, dibantu AI pair-programming — jangan asumsikan level expert, tapi juga jangan terlalu menyederhanakan penjelasan logika/arsitektur.
- Prioritas saat ini: Properti A (30 kamar, okupansi 100%) — sistem untuk properti ini yang harus solid duluan.

## Aturan Kerja Wajib (dari OUTPUTS.md, ditekankan ulang di sini)
- **Jangan asumsi struktur kode/database yang sudah ada** — cek dulu file/schema yang relevan sebelum mengubah atau menambah sesuatu.
- **Root cause dulu, baru solusi** — kalau ada bug/error, diagnosis penyebab aslinya dulu, jangan tambal gejala.
- Komentar kode: minimal, kecuali di bagian yang tidak umum bagi pemula.
- Rilis per fitur secara MVP dulu, disempurnakan bertahap — jangan tunda sampai "sempurna".
- Kalau ada keputusan desain/arsitektur yang ambigu, tanya dulu — jangan langsung pilih sendiri kalau dampaknya besar ke struktur data/fitur lain.

## Yang Harus Dihindari
- Basa-basi di penjelasan/komentar commit/PR.
- Mengasumsikan konteks bisnis (misal soal Properti B) tanpa mengecek ABOUT_ME.md dulu.
- Mengubah kode di luar scope yang diminta tanpa memberi tahu dulu.