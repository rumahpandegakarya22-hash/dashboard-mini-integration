// Kolom tanggal bisa ber-jam ('2026-06-30 10:00'); substr(1,10) menjaga hari terakhir tetap masuk.
// Argumen SQL: [periode.dari, periode.sampai]. `kolom` harus nama kolom tetap, bukan input pengguna.
export function kondisiTanggal(kolom: string): string {
  return `substr(${kolom}, 1, 10) BETWEEN ? AND ?`;
}
