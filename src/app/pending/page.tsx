export default function PendingPage() {
  return (
    <div className="card" style={{ marginTop: 48 }}>
      <h1>Menunggu Persetujuan</h1>
      <p className="muted">
        Akun kamu sudah terdaftar lewat Google, tapi belum diaktifkan. Hubungi Owner untuk approve akun & menentukan
        role kamu. Setelah disetujui, login lagi dengan tombol &quot;Daftar / Masuk dengan Google&quot; di halaman login.
      </p>
      <a href="/login">
        <button type="button">Kembali ke Login</button>
      </a>
    </div>
  );
}
