import type { Periode } from './types';

export type { Periode };

const BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export function namaBulan(m: number): string {
  return BULAN[m - 1];
}

const dua = (n: number) => String(n).padStart(2, '0');

// 'en-CA' menghasilkan YYYY-MM-DD; dipakai agar bulan "sekarang" mengikuti WIB, bukan UTC server.
export function kodeBulanJakarta(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(d).slice(0, 7);
}

function bangunPeriode(y: number, m: number): Periode {
  const hariTerakhir = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    kode: `${y}-${dua(m)}`,
    dari: `${y}-${dua(m)}-01`,
    sampai: `${y}-${dua(m)}-${dua(hariTerakhir)}`,
    label: `${BULAN[m - 1]} ${y}`,
  };
}

export function parsePeriode(kode: string, sekarang: Date = new Date()): Periode {
  const cocok = /^(\d{4})-(\d{2})$/.exec(kode);
  if (!cocok) throw new Error('Periode tidak valid.');
  const y = Number(cocok[1]);
  const m = Number(cocok[2]);
  if (m < 1 || m > 12) throw new Error('Periode tidak valid.');
  if (kode > kodeBulanJakarta(sekarang)) throw new Error('Periode tidak valid.');
  return bangunPeriode(y, m);
}

export function periodeSebelumnya(sekarang: Date): Periode {
  const [y, m] = kodeBulanJakarta(sekarang).split('-').map(Number);
  return m === 1 ? bangunPeriode(y - 1, 12) : bangunPeriode(y, m - 1);
}

export function kodeBulanLalu(sekarang: Date): string {
  return periodeSebelumnya(sekarang).kode;
}

export function adalahBulanBerjalan(kode: string, sekarang: Date = new Date()): boolean {
  return kode === kodeBulanJakarta(sekarang);
}
