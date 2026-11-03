// Filter periode di SQL memakai rentang setengah terbuka: kolom >= dari AND kolom < hari-setelah-sampai.
// Kolom tidak dibungkus fungsi (sargable), jadi indeks tanggal bisa dipakai dan hanya baris dalam periode yang dikirim
// ke server. Nilai ber-jam di hari terakhir ('2026-06-30 23:59') tetap masuk karena < '2026-07-01'.
// Argumen SQL: argTanggal(periode). `kolom` harus nama kolom tetap, bukan input pengguna.
export function kondisiTanggal(kolom: string): string {
  return `${kolom} >= ? AND ${kolom} < ?`;
}

export function hariBerikut(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

export function argTanggal(p: { dari: string; sampai: string }): [string, string] {
  return [p.dari, hariBerikut(p.sampai)];
}
