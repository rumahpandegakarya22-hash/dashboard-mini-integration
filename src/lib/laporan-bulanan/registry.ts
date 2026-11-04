import type { Client } from '@libsql/client';
import { turso } from '@/lib/core/turso';
import { getConfig } from '@/lib/app-config';
import { htmlKePdf } from '@/lib/invoice/pdf';
import { arsipkanLaporan } from '@/lib/invoice/arsip';
import type { Periode } from './types';
import { adalahBulanBerjalan, parsePeriode } from './periode';
import { ambilPekerjaan, susunPekerjaan, type DivisiPekerjaan } from './builders/pekerjaan';
import { htmlPekerjaan } from './templates/pekerjaan';
import { ambilOwner } from './builders/owner';
import { htmlOwner } from './templates/owner';
import { ambilKinerjaKeuangan } from './builders/keuangan';
import { htmlKinerjaKeuangan } from './templates/kinerja-keuangan';
import { ambilKinerjaSales } from './builders/sales';
import { htmlKinerjaSales } from './templates/kinerja-sales';
import { ambilKinerjaMarketing } from './builders/marketing';
import { htmlKinerjaMarketing } from './templates/kinerja-marketing';
import { ambilKerjaOperasional, ambilKinerjaOperasional } from './builders/operasional';
import { htmlKerjaOperasional } from './templates/kerja-operasional';
import { htmlKinerjaOperasional } from './templates/kinerja-operasional';
import { ambilKinerjaAdmin } from './builders/admin';
import { htmlKinerjaAdmin } from './templates/kinerja-admin';
import { buildArusKas, buildLabaRugi, buildNeraca } from '@/lib/laporan/generator';
import { htmlArusKas, htmlKeuanganLengkap, htmlLabaRugi, htmlNeraca } from '@/lib/laporan/template';

export interface LaporanDef {
  id: string;
  keluarga: 'keuangan' | 'kerja' | 'kinerja' | 'owner';
  judul: string;
  ownerOnly?: boolean;
  // Tidak tampil di panel laporan bulanan (laporan keuangan sudah punya panel sendiri), tetap ikut cron dan email.
  tersembunyi?: boolean;
  // Ikut dilampirkan di email bulanan.
  email?: boolean;
  // Tidak dilampirkan di email (isinya sudah ada di laporan lain).
  tanpaEmail?: boolean;
  render(periode: Periode, dibuat: Date, oleh?: string): Promise<string>;
  namaFile(periode: Periode): string;
}

const ROLE_DIIZINKAN = new Set(['owner', 'staff_admin', 'staff_sales']);

export function boleh(role: string, def: Pick<LaporanDef, 'ownerOnly'>): boolean {
  if (!ROLE_DIIZINKAN.has(role)) return false;
  return def.ownerOnly ? role === 'owner' : true;
}

function laporanKerja(divisi: DivisiPekerjaan): LaporanDef {
  return {
    id: `kerja-${divisi.toLowerCase()}`,
    keluarga: 'kerja',
    judul: `Laporan Pekerjaan ${divisi}`,
    async render(periode, dibuat) {
      return htmlPekerjaan(susunPekerjaan(divisi, periode, dibuat, await ambilPekerjaan(divisi, periode)));
    },
    namaFile: periode => `Laporan ${divisi.toUpperCase()} - ${periode.label}.pdf`,
  };
}

// Id = jenis di riwayat laporan keuangan lama ('Cashflow' | 'LabaRugi' | 'Neraca'), nama berkas juga format lama.
function laporanKeuangan(jenis: 'Cashflow' | 'LabaRugi' | 'Neraca', judul: string): LaporanDef {
  return {
    id: jenis,
    keluarga: 'keuangan',
    judul,
    tersembunyi: true,
    async render(periode, _dibuat, oleh = 'Sistem') {
      if (jenis === 'LabaRugi') return htmlLabaRugi(await buildLabaRugi(periode.dari, periode.sampai), periode.kode, oleh);
      if (jenis === 'Cashflow') return htmlArusKas(await buildArusKas(periode.dari, periode.sampai), periode.kode, oleh);
      return htmlNeraca(await buildNeraca(periode.sampai), periode.kode, oleh);
    },
    namaFile: periode => `${periode.kode.slice(5, 7)}${periode.kode.slice(2, 4)}-${jenis}-Kost Tiga Dara.pdf`,
  };
}

// Arus Kas + Laba Rugi + Neraca dalam satu file; hanya diarsipkan ke Drive, tidak dilampirkan di email.
const laporanKeuanganLengkap: LaporanDef = {
  id: 'KeuanganLengkap',
  keluarga: 'keuangan',
  judul: 'Laporan Keuangan Lengkap',
  tersembunyi: true,
  tanpaEmail: true,
  async render(periode, _dibuat, oleh = 'Sistem') {
    const [ak, lr, neraca] = await Promise.all([
      buildArusKas(periode.dari, periode.sampai),
      buildLabaRugi(periode.dari, periode.sampai),
      buildNeraca(periode.sampai),
    ]);
    return htmlKeuanganLengkap(ak, lr, neraca, periode.kode, oleh);
  },
  namaFile: periode => `${periode.kode.slice(5, 7)}${periode.kode.slice(2, 4)}-Lengkap-Kost Tiga Dara.pdf`,
};

// Tugas berikutnya menambah satu objek per laporan ke array ini.
const DAFTAR: LaporanDef[] = [
  laporanKerja('Admin'),
  laporanKerja('Keuangan'),
  laporanKerja('Marketing'),
  laporanKerja('Sales'),
  {
    id: 'kinerja-keuangan',
    keluarga: 'kinerja',
    judul: 'Kinerja Keuangan',
    async render(periode, dibuat) {
      return htmlKinerjaKeuangan(await ambilKinerjaKeuangan(periode, dibuat));
    },
    namaFile: periode => `Laporan Kinerja Keuangan - ${periode.label}.pdf`,
  },
  {
    id: 'kinerja-sales',
    keluarga: 'kinerja',
    judul: 'Kinerja Sales',
    async render(periode, dibuat) {
      return htmlKinerjaSales(await ambilKinerjaSales(periode, dibuat));
    },
    namaFile: periode => `Laporan Kinerja Sales - ${periode.label}.pdf`,
  },
  {
    id: 'kinerja-marketing',
    keluarga: 'kinerja',
    judul: 'Kinerja Marketing',
    async render(periode, dibuat) {
      return htmlKinerjaMarketing(await ambilKinerjaMarketing(periode, dibuat));
    },
    namaFile: periode => `Laporan Kinerja Marketing - ${periode.label}.pdf`,
  },
  {
    id: 'kerja-operasional',
    keluarga: 'kerja',
    judul: 'Kerja Operasional',
    async render(periode, dibuat) {
      return htmlKerjaOperasional(await ambilKerjaOperasional(periode, dibuat));
    },
    namaFile: periode => `Laporan Kerja Divisi Operasional - ${periode.label}.pdf`,
  },
  {
    id: 'kinerja-operasional',
    keluarga: 'kinerja',
    judul: 'Kinerja Operasional',
    async render(periode, dibuat) {
      return htmlKinerjaOperasional(await ambilKinerjaOperasional(periode, dibuat));
    },
    namaFile: periode => `Laporan Kinerja Operasional (Inspeksi & Maintenance) - ${periode.label}.pdf`,
  },
  {
    id: 'kinerja-admin',
    keluarga: 'kinerja',
    judul: 'Kinerja Admin',
    async render(periode, dibuat) {
      return htmlKinerjaAdmin(await ambilKinerjaAdmin(periode, dibuat));
    },
    namaFile: periode => `Laporan Kinerja Admin - ${periode.label}.pdf`,
  },
  {
    id: 'owner-review',
    keluarga: 'owner',
    judul: 'Owner Review',
    ownerOnly: true,
    async render(periode, dibuat) {
      return htmlOwner(await ambilOwner(periode, dibuat));
    },
    namaFile: periode => `Laporan Owner Review - ${periode.label}.pdf`,
  },
  laporanKeuangan('Cashflow', 'Laporan Arus Kas'),
  laporanKeuangan('LabaRugi', 'Laporan Laba Rugi'),
  laporanKeuangan('Neraca', 'Laporan Neraca'),
  laporanKeuanganLengkap,
];

// Semua laporan, termasuk Owner Review, ikut email bulanan. Daftar penerima hanya bisa diubah owner.
export const LAPORAN: LaporanDef[] = DAFTAR.map(l => ({ ...l, email: !l.tanpaEmail }));

export function laporanUntukEmail(): { id: string; keluarga: LaporanDef['keluarga'] }[] {
  return LAPORAN.filter(l => l.email).map(l => ({ id: l.id, keluarga: l.keluarga }));
}

export function cariLaporan(id: string): LaporanDef | undefined {
  return LAPORAN.find(l => l.id === id);
}

// Owner Review sengaja tanpa fallback ke folder keuangan: isinya hanya untuk owner.
export function pilihFolder(id: string, configValue: string | null | undefined, envFallback: string | undefined): string | undefined {
  const khusus = configValue?.trim();
  if (khusus) return khusus;
  if (id === 'owner-review') return undefined;
  return envFallback?.trim() || undefined;
}

export interface DepsGenerate {
  db: Client;
  htmlKePdf(html: string): Promise<Buffer>;
  getConfig(key: string): Promise<string | null>;
  arsipkan(namaFile: string, pdf: Buffer, folderId: string): Promise<string | undefined>;
  envFolder: string | undefined;
  sekarang(): Date;
}

export interface HasilGenerate {
  namaFile: string;
  pdf: Buffer;
  driveUrl?: string;
  riwayatId: number;
  catatanArsip?: string;
}

export async function generateLaporan(
  id: string,
  kode: string,
  oleh: string,
  deps: Partial<DepsGenerate> = {},
): Promise<HasilGenerate> {
  const def = cariLaporan(id);
  if (!def) throw new Error('Jenis laporan tidak valid.');
  const d: DepsGenerate = {
    db: deps.db ?? turso(),
    htmlKePdf: deps.htmlKePdf ?? htmlKePdf,
    getConfig: deps.getConfig ?? getConfig,
    arsipkan: deps.arsipkan ?? arsipkanLaporan,
    envFolder: 'envFolder' in deps ? deps.envFolder : process.env.DRIVE_FOLDER_LAPORAN,
    sekarang: deps.sekarang ?? (() => new Date()),
  };
  const sekarang = d.sekarang();
  const periode = parsePeriode(kode, sekarang);
  if (adalahBulanBerjalan(periode.kode, sekarang)) {
    throw new Error('Bulan berjalan belum selesai. Pilih bulan lalu atau sebelumnya.');
  }

  const pdf = await d.htmlKePdf(await def.render(periode, sekarang, oleh));
  const namaFile = def.namaFile(periode);

  // Riwayat dicatat DULU: bila gagal (mis. migrasi 019 belum diterapkan) tidak ada file Drive yatim.
  let riwayatId: number;
  try {
    const res = await d.db.execute({
      sql: 'INSERT INTO laporan_riwayat (periode, jenis, nama_file, drive_url, dibuat_oleh) VALUES (?, ?, ?, NULL, ?)',
      args: [periode.kode, id, namaFile, oleh],
    });
    riwayatId = Number(res.lastInsertRowid);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Gagal mencatat riwayat laporan, laporan tidak diarsipkan: ${msg}`);
  }

  const folder = pilihFolder(id, await d.getConfig(`drive_folder_laporan_${id}`), d.envFolder);
  if (!folder) {
    const catatanArsip = id === 'owner-review'
      ? 'Owner Review tidak diarsipkan: folder Drive belum diatur.'
      : 'Laporan tidak diarsipkan: folder Drive belum diatur.';
    return { namaFile, pdf, riwayatId, catatanArsip };
  }

  // Drive best-effort: arsipkan tidak melempar, gagal -> undefined.
  const driveUrl = await d.arsipkan(namaFile, pdf, folder);
  if (!driveUrl) return { namaFile, pdf, riwayatId, catatanArsip: 'Arsip ke Drive gagal; riwayat tercatat tanpa tautan.' };
  try {
    await d.db.execute({ sql: 'UPDATE laporan_riwayat SET drive_url = ? WHERE id = ?', args: [driveUrl, riwayatId] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { namaFile, pdf, driveUrl, riwayatId, catatanArsip: `Tautan Drive gagal disimpan ke riwayat: ${msg}` };
  }
  return { namaFile, pdf, driveUrl, riwayatId };
}

// PDF tanpa mencatat riwayat atau mengarsipkan: dipakai melampirkan laporan yang sudah ada ke email bulanan.
export async function renderPdf(
  id: string,
  kode: string,
  deps: Partial<Pick<DepsGenerate, 'htmlKePdf' | 'sekarang'>> = {},
  oleh = 'Jadwal otomatis',
): Promise<{ namaFile: string; pdf: Buffer }> {
  const def = cariLaporan(id);
  if (!def) throw new Error('Jenis laporan tidak valid.');
  const sekarang = (deps.sekarang ?? (() => new Date()))();
  const periode = parsePeriode(kode, sekarang);
  const pdf = await (deps.htmlKePdf ?? htmlKePdf)(await def.render(periode, sekarang, oleh));
  return { namaFile: def.namaFile(periode), pdf };
}

// Baris yang dibuat sebelum bulan itu berakhir (mis. uji coba di bulan berjalan) tidak dihitung: laporan resminya belum ada.
export async function laporanSudahAda(id: string, kode: string, db: Client = turso()): Promise<boolean> {
  const res = await db.execute({
    sql: 'SELECT 1 FROM laporan_riwayat WHERE jenis = ? AND periode = ? AND substr(created_at, 1, 10) > ? LIMIT 1',
    args: [id, kode, parsePeriode(kode).sampai],
  });
  return res.rows.length > 0;
}

/** Validasi body POST: harus objek dengan id dan periode string. */
export function bacaBody(raw: unknown): { id: string; periode: string } | null {
  if (!raw || typeof raw !== 'object') return null;
  const { id, periode } = raw as Record<string, unknown>;
  return typeof id === 'string' && typeof periode === 'string' ? { id, periode } : null;
}
