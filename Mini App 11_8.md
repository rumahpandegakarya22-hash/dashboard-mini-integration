Mini App



Tambah Fitur:



1.Buat Setting On/Off (toggle) Deposit. 

&#x09;Jika On, ada field jumlah deposit di pendaftaran (berikan settingan untuk Jumlah Deposit) dan ada field no rekening untuk refund deposit, Nama rekening, dan Nama Bank di Pengajuan Checkout teman-rara. 



2\. Buat Menu Form Kondisi Kamar Checkout dan Checkin

&#x09;Format (checkout dan Checkin) seperti di spreadsheet https://docs.google.com/spreadsheets/d/16usEPxHg3PdeWlFMHKieJq5MJfCyx8q2wW69pqMS-fg/edit?gid=1998798808#gid=1998798808 (Buat database baru dengan judul Kondisi kamar). Item dijadikan kolom, nilainya diisi dropdown: Baik, Perlu Perbaikan, Rusak, N/A. 

&#x09;-Struktur Database: id\_kamar, no\_kamar (integer), id\_penghuni, Nama penghuni, Item 1, Item 2, ....., Item ke-N, Tanggal Cek Awal, Tanggal Cek Akhir, PIC, Approved Checkin By, Approve Checkout By,. 



Untuk Menu Checkout, dirikan sendiri di sidebar dengan judul Checkout berisikan menu: Daftar Pengajuan Checkout, Pre-Check Out Form (Poin 2) dan Approval Checkout (untuk role Admin dan Owner).



3\. Buat juga Fitur Approval untuk Poin 2 bagi role Owner dan Admin. 

&#x09;Fitur Poin 2 akan diisi oleh Role Admin/Operasional (Inpection). 



&#x09;



4\. Buat Menu Check-in di sidebar (dapat dilihat oleh role Admin dan Owner).

&#x09;Isi: Daftar  booking, Pre-Check In Form (poin 2) dan Penghuni Baru \& Review (pindahkan ke Menu Check-in dari Administrasi).



4.1. Modul Daftar Booking

&#x09;Menampilkan daftar booking baik pengisian mandiri dari teman rara ataupun input manual di Menu Administrasi: Penghuni Baru. Tampilan berbentuk Tabel berupa id\_penghuni, nama, no kamar, nomor WhatsApp, CTA checkin (dengan syarat kamar sudah di inspeksi melalui menu Form Checkin) dan CTA WhatsApp. 



4.2. Modul Form Check-in (khusus modul ini tambahkan role Inspeksi )

&#x09;Berisikan seperti Poin 2. Semua item harus diinspeksi dan ada field upload foto. 



5\. Tambah modul pada sidebar menu berupa generate laporan arus kas, laporan laba rugi dan laporan Neraca (Export to pdf, kirim email, simpan ke drive).

&#x09;Berikan Setting di menu ini berupa field tujuan email. Gunakan Brevo untuk mengirim email.  

&#x09;Berikan juga table Riwayat laporan di menu ini dengan CTA buka file. 

&#x09;Ambil Semua data dari table Jurnal\_transaksi. 

&#x09;Generate laporan ini harus berdasarkan prinsip Akuntansi dan PSAK.

&#x09;Jadilah Senior Accountant, Riset Peraturan PSAK dan pelajari Prinsip Pembuatan Laporan Akuntansi!. 

&#x09;Rancang Laporan dari data yang ada, berikan masukan jika ada yang kurang dari struktur data atau data.

&#x09;Format Nama file: Periode (MMYY)-Nama Laporan(Cashflow/Labarugi/Neraca)-Kost Tiga Dara.   



6\. Pindahkan Modul:

&#x09;- Kredensial Wifi (di Teman Rara) ke Menu Setting

&#x09;- Kelola Harga Kamar (di Admin) ke Menu Setting 

&#x09;- Kelola User (di Admin) ke Menu Setting 

&#x09;- Ubah Data Penghuni (di Teman Rara) ke Menu Administrasi



7\. Lengkapi lagi menu Sidebar. 

&#x09;Cek semua menu di beranda. Tambahkan menu beranda yang belum ada di sidebar. 







**Penjelasan Tambahan** 



\-Untuk poin 1

&#x09;1. Setting Hanya ditampilkan untuk role Owner dan Admin. 



\-Untuk Poin 2. 

&#x09;1. Hydrate untuk data penghuni aktif saat ini dengan semua kondisi baik. 

&#x09;2. Buat card seperti menu kredensial Wifi dan menu Ubah Data Penghuni. 

&#x09;3. Menu ini akan dijadikan sebagai pengisian form. bentuk form adalah table dengan dropdown pada: kondisi item,no Kamar,nama penghuni; date picker pada kolom tanggal. 

&#x09;4. Role Inspection hanya berwenang di Modul Pre-Check Out Form. 





\-Untuk Poin 3. 

&#x09;1.Approval dengan tombol CTA dengan popup warning.

&#x09;2.Buat tombol preview data kondisi kamar. 

&#x09;3.Menu Approval ada di dalam Menu Check-Out



\-Untuk Poin 4

&#x09;1. Menu Check-in Lengkap (Daftar Booking, Pre-Check In Form, Penghuni Baru\& Review) hanya ditampilkan bagi Admin dan Owner. 

&#x09;3. Role Inspeksi hanya berwenang di modul Pre Check In Form. 



\-Untuk Poin 6

&#x09;1. Kredensial Wifi hanya ditampilkan bagi Admin dan Owner

&#x09;2. Kelola Harga Kamar hanya ditampilkan bagi Owner

&#x09;3. Kelola User hanya ditampilkan bagi Owner

&#x09;4. Ubah Data Penghuni hanya ditampilkan bagi Admin dan Owner



\-Untuk Poin 5

&#x09;1. Hanya ditampilkan bagi role Admin, Sales dan Admin

&#x09;

