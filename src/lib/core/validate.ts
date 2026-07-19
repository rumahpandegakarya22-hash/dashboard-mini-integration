/** Normalisasi No. HP Indonesia ke format 628xxxxxxxxx (dikembalikan sebagai TEKS). */
export function normalizePhone(input: string): string {
  let p = String(input).replace(/[^0-9+]/g, '');
  if (p.startsWith('+62')) p = '62' + p.slice(3);
  else if (p.startsWith('0')) p = '62' + p.slice(1);
  else if (p.startsWith('8')) p = '62' + p;
  if (!/^628[0-9]{7,12}$/.test(p)) {
    throw new Error(`No. HP tidak valid: "${input}". Contoh benar: 081234567890.`);
  }
  return p;
}

/** Parse nominal rupiah dari input UI ("850.000" / "Rp850.000" / 850000) → integer. */
export function parseRupiah(input: string | number): number {
  if (typeof input === 'number') {
    if (!Number.isFinite(input) || input < 0) throw new Error('Nominal tidak valid.');
    return Math.round(input);
  }
  const n = parseInt(String(input).replace(/[^0-9]/g, ''), 10);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`Nominal tidak valid: "${input}".`);
  return n;
}

/** Validasi tanggal ISO (yyyy-mm-dd) dan batasi rentang wajar (2020–2035). */
export function parseDateISO(input: string): string {
  const m = String(input).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) throw new Error(`Tanggal tidak valid: "${input}".`);
  const y = parseInt(m[1], 10);
  if (y < 2020 || y > 2035) throw new Error(`Tahun di luar rentang wajar: ${y}. Periksa lagi.`);
  const d = new Date(`${input}T00:00:00`);
  if (isNaN(d.getTime())) throw new Error(`Tanggal tidak valid: "${input}".`);
  return input;
}

/**
 * Format nomor kamar baku: angka polos tanpa leading zero (mis. "9", "01" → "1").
 * ⚠️ "KTD-x" BUKAN format kamar — itu ID Penghuni Aktif (dikoreksi user 8 Jul). Lihat Tenant.id di master.ts.
 * Tapi data lama di sheet master kamar masih ada yang tertulis "KTD-1" dkk (data quality, PRD §13) —
 * tetap DITERIMA sebagai input & dinormalisasi ke angka polos, sama seperti normalizePhone menerima "0812...".
 */
export function normalizeRoomId(input: string): string {
  const m = String(input).trim().toUpperCase().match(/^(?:KTD[-\s]?)?(\d{1,3})$/);
  if (!m) throw new Error(`Nomor kamar tidak valid: "${input}".`);
  return String(parseInt(m[1], 10));
}

export function required(v: unknown, label: string): string {
  const s = String(v ?? '').trim();
  if (!s) throw new Error(`${label} wajib diisi.`);
  return s;
}

/** Terima 'yyyy-mm-dd', 'd/m/yyyy', atau format tanggal umum lain dari Sheets → ISO, null kalau gagal. */
export function toISODateFlexible(raw: string): string | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return null;
}
