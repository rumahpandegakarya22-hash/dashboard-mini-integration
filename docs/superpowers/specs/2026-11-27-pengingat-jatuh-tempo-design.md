# Desain: Pengingat Jatuh Tempo di Mini App

Tanggal: 27 November 2026. Status: disetujui, sudah diimplementasikan; belum di-deploy.

## Tujuan

Admin, Owner, dan Sales melihat di beranda Mini App (`/ops`) siapa yang perlu ditagih, lalu menghubungi penghuni lewat WhatsApp dengan draft yang sudah terisi. Admin diingatkan lewat Telegram tanpa harus membuka web.

Di luar lingkup: kirim WhatsApp otomatis, status "sudah dibroadcast", nominal tagihan, perubahan di Teman Rara.

## Dasar jatuh tempo

- Hanya penghuni aktif (ada di `active_tenant`). Penghuni yang sudah check-out tidak muncul.
- Jatuh tempo = `periode_akhir` paling akhir dari `invoice_sewa` penghuni itu yang `tanggal_pembayaran`-nya terisi dan `void_pada` kosong. Kalau ada dua dengan tanggal sama, dipakai `id` terbesar.
- Penghuni tanpa invoice seperti itu tidak muncul.
- Setelah pembayaran berikutnya dicatat, jatuh temponya maju dan namanya hilang dari daftar. Void invoice memundurkannya lagi.
- "Hari ini" dihitung dalam GMT+7, tidak bergantung zona waktu server.

## Tiga section

`selisih` = hari ini dikurangi jatuh tempo, dalam hari. Urutan di beranda:

| Urutan | Section | `selisih` | Urutan isi | Keterangan di kartu |
|---|---|---|---|---|
| 1 | Terlambat | 7 ke atas | paling lama telat di atas | "Lewat n hari" |
| 2 | Jatuh Tempo | 0 sampai 6 | paling lama telat di atas | "Hari ini" atau "Lewat n hari" |
| 3 | Pengingat | -3 sampai -1 | paling dekat jatuh tempo di atas | "n hari lagi" |

`selisih` di bawah -3 tidak ditampilkan. Satu penghuni hanya ada di satu section.

Posisi: di bawah sapaan dan pengumuman, di atas Joblist. Tiap section punya penanda pemisah sendiri: judul, jumlah, ikon, dan warna (Terlambat merah, Jatuh Tempo kuning/oranye, Pengingat biru), memakai token tema yang ada. Warna bukan satu-satunya pembeda. Section tanpa data disembunyikan; kalau ketiganya kosong, tidak ada yang tampil (revisi setelah rilis). Kalau database gagal dibaca, tampil pesan gagal (tidak disembunyikan) dan isi beranda lain tetap jalan.

Isi kartu: nama, nomor kamar, tipe kamar, tanggal jatuh tempo, keterangan hari, tombol WhatsApp. Tanpa nominal. Dirancang untuk layar HP.

## Akses

Hanya `owner`, `admin_finance` (Admin), dan `sales`. Role lain tidak menerima data sama sekali: pengecekan dilakukan di server sebelum query dijalankan. Sales boleh melihat nomor HP penghuni. Tidak ada API baru untuk membaca daftar ini.

## Tombol WhatsApp

- Membuka chat nomor penghuni (dinormalkan ke format 62) dengan draft terisi.
- Di komputer: `web.whatsapp.com/send?phone=…&text=…` supaya emoji tidak rusak. Di HP: `wa.me/…`, yang membuka aplikasi WhatsApp. Perilaku ini sama dengan halaman Draft Info Admin.
- Nomor kosong atau tidak valid: tombol nonaktif dengan keterangan "Nomor HP belum diisi".
- Admin tetap menekan kirim sendiri.

## Isi draft

Sumber: template #22 "Pengingat Pembayaran Bulanan" (dokumen "Draft Informasi Admin"). Perubahannya: baris nama, tipe, dan periode berikutnya ditambahkan; baris "untuk bulan …" diganti baris periode; nominal dihapus.

```text
Halo Kak {nama panggilan, atau nama lengkap} 😊

{kalimat pembuka}

👤 Nama : {nama lengkap}
🚪 Kamar : {nomor} ({tipe})
📅 Jatuh tempo : {tanggal}
🗓️ Periode sewa berikutnya : {awal} s.d. {akhir}

Pembayaran dapat melalui:
🏦 {bank} — {nomor rekening} a.n. {atas nama}

Mohon konfirmasi setelah transfer ya 🙏

Terima kasih!
Salam,
Admin Kost Tiga Dara
```

| Keadaan | Kalimat pembuka |
|---|---|
| Pengingat | Sekedar mengingatkan, tagihan sewa kamar {nomor} akan jatuh tempo {n} hari lagi: |
| Jatuh Tempo | Sekedar mengingatkan, tagihan sewa kamar {nomor} sudah jatuh tempo: |
| Terlambat | Sekedar mengingatkan, tagihan sewa kamar {nomor} sudah lewat {n} hari dari jatuh tempo. Mohon segera diselesaikan ya: |

Periode berikutnya mulai pada tanggal jatuh tempo, selama `jumlah_bulan` invoice terakhir (1 bila kosong), dengan aturan akhir bulan yang sama seperti form Pembayaran Sewa (31 Januari + 1 bulan = akhir Februari). Tipe kamar diambil dari tabel `kamar`, atau dari invoice terakhir bila kosong.

Teks draft disimpan di satu file kode; mengubahnya perlu deploy. Rekening diatur dari web app (di bawah).

## Setting rekening pembayaran

- Halaman baru "Rekening Pembayaran" di grup Pengaturan Mini App, mengikuti pola halaman Setting yang sudah ada.
- Satu rekening aktif: nama bank, nomor rekening, atas nama. Ketiganya wajib; nomor hanya boleh angka, spasi, dan tanda hubung.
- Hanya `owner` yang bisa melihat halaman dan mengubah nilainya, dicek di halaman dan di API. Alasannya: nilai ini menentukan ke mana uang sewa ditransfer. Admin dan Sales hanya melihatnya di dalam draft.
- Sebelum menyimpan, tampil konfirmasi berisi baris rekening persis seperti yang akan terkirim. Halaman menampilkan siapa dan kapan terakhir mengubah. Perubahan dicatat di audit log.
- Disimpan di tabel `app_config` yang sudah ada (kunci `rekening_pembayaran`, nilai JSON). Dibaca langsung dari database, tanpa cache di memori, supaya perubahan langsung berlaku di semua instance.
- Nilai awal diisi oleh migrasi 039 (tidak menimpa bila sudah ada): BRI, 0892-0102-1802-537, Dwi Antari K A Roem. Tidak ada rekening cadangan di kode.
- Kalau nilainya kosong atau rusak, tombol WhatsApp nonaktif dengan keterangan "Rekening pembayaran belum diatur". Draft tidak pernah terkirim tanpa rekening.
- Template #21 dan #22 di halaman Draft Info Admin juga memakai rekening ini, supaya tidak tertinggal saat rekening diganti. Baris rekening di kedua template diganti saat ditampilkan, sehingga tetap berlaku bila `templates.json` dibuat ulang dari dokumen sumber. Kalau setting kosong, tampil `[Rekening belum diatur]`. Dokumen Google "Draft Informasi Admin" tidak ikut berubah.

## Telegram

- Endpoint `GET /api/cron/pengingat-tagihan`, dilindungi `CRON_SECRET` seperti cron laporan bulanan. Tanpa secret yang benar: 401.
- Jadwal di `vercel.json`: `0 1 * * *` (08.00 GMT+7). Paket gratis hanya mendukung jadwal harian dan waktunya bisa bergeser dalam jam itu. Cron Vercel hanya jalan di produksi.
- Data baru yang muncul setelah jam itu terkirim besok paginya.
- Isi: satu pesan rangkuman, dikelompokkan per section, memuat nama, nomor kamar, tipe, tanggal jatuh tempo, keterangan hari, ajakan broadcast lewat web app beserta tautannya. Tanpa nominal dan tanpa nomor HP. Pesan di atas 4096 karakter dipecah. Isi di-escape untuk HTML Telegram.
- Hanya entri baru yang masuk pesan. Tidak ada entri baru: tidak ada pesan.
- Run pertama di produksi akan mengirim semua yang sedang cocok.
- Anti-dobel: tabel baru `tagihan_pengingat_log` (`id_penghuni`, `jatuh_tempo`, `tahap`, `dikirim_pada`; kunci utama tiga kolom pertama). Maksimal tiga pesan per penghuni per jatuh tempo, satu per tahap. Baris diklaim sebelum kirim, sehingga dua run bersamaan tidak mengirim dua kali. Kirim gagal: klaim dihapus, endpoint menjawab 500, dan dicoba lagi pada run berikutnya. Kalau proses mati di antara klaim dan kirim, entri itu terlewat.
- Hari yang terlewat tidak dikejar: yang dikirim adalah tahap saat run berjalan.
- `TELEGRAM_BOT_TOKEN` dan `TELEGRAM_CHAT_ID` diisi di env Vercel, memakai bot dan chat yang sama dengan Teman Rara. Kalau belum diisi: tidak ada klaim, endpoint menjawab 500.
- Cadangan kalau cron Vercel tidak bisa diandalkan: n8n di server sendiri memanggil endpoint yang sama dengan header `Authorization: Bearer <CRON_SECRET>`. Tidak perlu ubah kode.

## Pendekatan yang dipertimbangkan

1. **Cron Vercel memanggil endpoint (dipilih).** Tidak perlu server tambahan. Waktunya kurang presisi.
2. **n8n di server sendiri.** Jadwal presisi, tapi ada satu sistem lagi yang harus dijaga. Jadi cadangan.
3. **Dipicu saat beranda dibuka.** Tanpa cron, tapi tidak ada pesan kalau tidak ada yang membuka web. Ditolak.

Daftar di beranda dihitung langsung dari database setiap dibuka, tanpa tabel tagihan terpisah yang bisa basi.

## Pengujian

- Rekening: validasi isian, hanya Owner yang bisa membaca dan mengubah lewat API, draft dan template #21/#22 mengikuti nilai terbaru, nilai kosong.
- Unit test: batas `selisih` (-4, -3, -1, 0, 6, 7), pergantian hari GMT+7 (16.59 dan 17.00 UTC), akhir bulan dan tahun kabisat, role yang boleh dan tidak.
- Uji database di file libSQL lokal: invoice void, belum dibayar, penghuni tanpa invoice, penghuni check-out.
- Telegram diuji dengan pengirim tiruan: tidak dobel, kirim gagal, run bersamaan. Tidak ada pesan sungguhan tanpa izin.
- Tampilan dicek di ukuran HP.

## Constraint

- Tidak memakai database produksi untuk uji. `.env.local` menunjuk database remote, jadi harus ditimpa.
- Tidak push ke `main` tanpa izin.
- Migrasi `db/schema/039` harus diterapkan ke produksi sebelum deploy, dengan izin.

## Diserahkan ke pembuat

Struktur file, nama fungsi, detail visual di dalam tema yang ada, format tautan web app di pesan Telegram.
