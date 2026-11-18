/* =========================================================================
   Mengisi template pesan admin dan membuat tautan WhatsApp.
   Murni (tanpa dependensi) supaya dipakai di klien dan bisa diuji.
   Placeholder di data berbentuk {{Label}} (lihat parse-html.ts).
   ========================================================================= */

export type JenisIsian = 'hari' | 'tanggal' | 'bulan' | 'jam' | 'rupiah' | 'teks' | 'teksPanjang';

export interface Isian {
  /** Kunci unik (label huruf kecil): label yang sama di beberapa tempat jadi satu isian. */
  kunci: string;
  label: string;
  /** Contoh atau petunjuk (mis. "misal: Meja Depan/Lobi"). */
  petunjuk?: string;
  jenis: JenisIsian;
  /** Placeholder yang berdiri sendiri di satu baris (mis. nama penghuni ke-2): boleh kosong, barisnya dibuang. */
  opsional: boolean;
}

export const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const POLA = /\{\{([^}]+)\}\}/g;
const BARIS_SENDIRI = /^\s*(?:[-•]\s+)?\{\{([^}]+)\}\}\s*$/;

const kunciDari = (label: string) => label.trim().toLowerCase().replace(/\s+/g, ' ');

function pisahPetunjuk(mentah: string): { label: string; petunjuk?: string } {
  const m = /^(.*?)(?:,\s*|\s+—\s+)((?:misal|contoh).*)$/i.exec(mentah.trim());
  return m ? { label: m[1].trim(), petunjuk: m[2].trim() } : { label: mentah.trim() };
}

const rapikanLabel = (l: string) =>
  l === l.toUpperCase() && l.length > 3 ? l.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()) : l;

export function jenisDari(label: string): JenisIsian {
  const k = kunciDari(label);
  if (k === 'hari') return 'hari';
  if (k.startsWith('nama bulan')) return 'bulan';
  if (['tanggal', 'dd bulan yyyy', 'hari, dd bulan yyyy'].includes(k)) return 'tanggal';
  if (['jam', 'jam mulai', 'sebutkan jam', 'hh:mm'].includes(k)) return 'jam';
  if (['harga', 'jumlah dp', 'total', 'sisa'].includes(k)) return 'rupiah';
  if (k.includes('deskripsi') || k.startsWith('masalah')) return 'teksPanjang';
  return 'teks';
}

/** Daftar isian unik sesuai urutan kemunculan di template. */
export function daftarIsian(isi: string): Isian[] {
  const hasil = new Map<string, Isian>();
  for (const baris of isi.split('\n')) {
    const sendiri = BARIS_SENDIRI.exec(baris);
    for (const m of baris.matchAll(POLA)) {
      const { label, petunjuk } = pisahPetunjuk(m[1]);
      const kunci = kunciDari(m[1]);
      const ada = hasil.get(kunci);
      if (ada) {
        if (!sendiri) ada.opsional = false; // satu kali dipakai di dalam kalimat → wajib
        continue;
      }
      hasil.set(kunci, { kunci, label: rapikanLabel(label), petunjuk, jenis: jenisDari(m[1]), opsional: !!sendiri });
    }
  }
  return [...hasil.values()];
}

const dua = (n: number) => String(n).padStart(2, '0');

function tanggalDari(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

export const namaHari = (iso: string): string => {
  const d = tanggalDari(iso);
  return d ? HARI[d.getDay()] : '';
};

export function formatTanggal(iso: string, denganHari: boolean): string {
  const d = tanggalDari(iso);
  if (!d) return iso;
  const tgl = `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
  return denganHari ? `${HARI[d.getDay()]}, ${tgl}` : tgl;
}

export function formatBulan(ym: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(ym);
  return m ? `${BULAN[Number(m[2]) - 1]} ${m[1]}` : ym;
}

export function formatRupiah(v: string): string {
  const angka = v.replace(/\D/g, '');
  return angka ? Number(angka).toLocaleString('id-ID') : '';
}

/** Potongan hasil: teks biasa, atau nilai isian (terisi/kosong) supaya pratinjau bisa menyorotnya. */
export interface Segmen {
  teks: string;
  /** Isian terisi (nilai dari admin). */
  isian?: boolean;
  /** Isian wajib yang belum diisi: tampil sebagai [Label]. */
  kosong?: boolean;
}

function nilaiTampil(i: Isian, mentah: string, sebelum: string, sesudah: string, adaIsianHari: boolean): string {
  const v = (mentah ?? '').trim();
  if (!v) return '';
  switch (i.jenis) {
    case 'tanggal': {
      const denganHari = /hari/i.test(i.label) || (/Hari\/Tanggal:\s*$/.test(sebelum) && !adaIsianHari);
      return formatTanggal(v, denganHari);
    }
    case 'bulan':
      return formatBulan(v);
    case 'jam':
      return /^\s*(WIB|s\/d)\b/.test(sesudah) ? v : `${v} WIB`;
    case 'rupiah':
      return formatRupiah(v);
    default:
      return v;
  }
}

/** Nilai awal yang efektif: hari otomatis dari tanggal pertama yang terisi bila belum dipilih. */
function nilaiEfektif(isian: Isian[], nilai: Record<string, string>): Record<string, string> {
  const hasil = { ...nilai };
  const hari = isian.find((i) => i.jenis === 'hari');
  if (hari && !(hasil[hari.kunci] ?? '').trim()) {
    const tgl = isian.find((i) => i.jenis === 'tanggal' && (hasil[i.kunci] ?? '').trim());
    if (tgl) hasil[hari.kunci] = namaHari(hasil[tgl.kunci].trim());
  }
  return hasil;
}

export function segmenPesan(isi: string, nilaiMentah: Record<string, string>): Segmen[] {
  const isian = daftarIsian(isi);
  const peta = new Map(isian.map((i) => [i.kunci, i]));
  const nilai = nilaiEfektif(isian, nilaiMentah);
  const adaIsianHari = isian.some((i) => i.jenis === 'hari');
  const segmen: Segmen[] = [];
  const baris = isi.split('\n');

  baris.forEach((b, idx) => {
    const sendiri = BARIS_SENDIRI.exec(b);
    if (sendiri && !(nilai[kunciDari(sendiri[1])] ?? '').trim()) return; // opsional kosong: baris dibuang

    let akhir = 0;
    for (const m of b.matchAll(POLA)) {
      const i = peta.get(kunciDari(m[1]))!;
      const index = m.index ?? 0;
      if (index > akhir) segmen.push({ teks: b.slice(akhir, index) });
      const sebelum = b.slice(0, index);
      const sesudah = b.slice(index + m[0].length);
      const teks = nilaiTampil(i, nilai[i.kunci] ?? '', sebelum, sesudah, adaIsianHari);
      segmen.push(teks ? { teks, isian: true } : { teks: `[${i.label}]`, kosong: true });
      akhir = index + m[0].length;
    }
    if (akhir < b.length) segmen.push({ teks: b.slice(akhir) });
    if (idx < baris.length - 1) segmen.push({ teks: '\n' });
  });
  return segmen;
}

export interface HasilPesan {
  teks: string;
  /** Label isian wajib yang belum diisi. */
  kosong: string[];
}

export function susunPesan(isi: string, nilai: Record<string, string>): HasilPesan {
  const segmen = segmenPesan(isi, nilai);
  const teks = segmen.map((s) => s.teks).join('').replace(/\n{3,}/g, '\n\n').trim();
  const kosong = [...new Set(segmen.filter((s) => s.kosong).map((s) => s.teks.slice(1, -1)))];
  return { teks, kosong };
}

/** Membuka WhatsApp dengan teks siap kirim; admin memilih grup lalu menekan kirim. */
export const tautanWhatsApp = (teks: string): string => `https://wa.me/?text=${encodeURIComponent(teks)}`;
