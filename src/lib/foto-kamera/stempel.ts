/* Stempel waktu pada foto kamera Mini App.
   Isi stempel: tanggal + jam WIB saat tombol rana ditekan, dan nama pengunggah. */

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/** Date → bagian waktu di zona Asia/Jakarta, apa pun zona perangkat. */
function bagianWib(d: Date) {
  const p = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(d);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? '00';
  return { y: get('year'), mo: get('month'), d: get('day'), h: get('hour'), mi: get('minute'), s: get('second') };
}

/** '27 Nov 2026 14:32 WIB' */
export function teksWaktuWib(d: Date): string {
  const w = bagianWib(d);
  return `${w.d} ${BULAN[Number(w.mo) - 1]} ${w.y} ${w.h}:${w.mi} WIB`;
}

/** Dua baris stempel: waktu, lalu nama pengunggah (baris nama dibuang bila kosong). */
export function barisStempel(d: Date, nama: string): string[] {
  const n = nama.trim().replace(/\s+/g, ' ');
  return n ? [teksWaktuWib(d), n] : [teksWaktuWib(d)];
}

/** 'foto-20261127-143205.jpg' (jam WIB) */
export function namaBerkasFoto(d: Date): string {
  const w = bagianWib(d);
  return `foto-${w.y}${w.mo}${w.d}-${w.h}${w.mi}${w.s}.jpg`;
}

/** Skala foto agar sisi terpanjangnya ≤ maks piksel; tidak pernah memperbesar. */
export function ukuranKeluaran(lebar: number, tinggi: number, maks = 1600): { w: number; h: number } {
  const sisi = Math.max(lebar, tinggi);
  if (sisi <= maks) return { w: lebar, h: tinggi };
  const k = maks / sisi;
  return { w: Math.round(lebar * k), h: Math.round(tinggi * k) };
}
