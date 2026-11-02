import { turso } from '@/lib/core/turso';
import { getConfig } from '@/lib/app-config';
import { htmlKePdf } from '@/lib/invoice/pdf';
import { arsipkanLaporan } from '@/lib/invoice/arsip';
import type { Periode } from './types';
import { parsePeriode } from './periode';
import { ambilPekerjaan, susunPekerjaan, type DivisiPekerjaan } from './builders/pekerjaan';
import { htmlPekerjaan } from './templates/pekerjaan';
import { ambilOwner } from './builders/owner';
import { htmlOwner } from './templates/owner';

export interface LaporanDef {
  id: string;
  keluarga: 'kerja' | 'kinerja' | 'owner';
  judul: string;
  ownerOnly?: boolean;
  render(periode: Periode, dibuat: Date): Promise<string>;
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

// Tugas berikutnya menambah satu objek per laporan ke array ini.
export const LAPORAN: LaporanDef[] = [
  laporanKerja('Admin'),
  laporanKerja('Keuangan'),
  laporanKerja('Marketing'),
  laporanKerja('Sales'),
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
];

export function cariLaporan(id: string): LaporanDef | undefined {
  return LAPORAN.find(l => l.id === id);
}

export async function generateLaporan(
  id: string,
  kode: string,
  oleh: string,
): Promise<{ namaFile: string; pdf: Buffer; driveUrl?: string; riwayatId: number }> {
  const def = cariLaporan(id);
  if (!def) throw new Error('Jenis laporan tidak valid.');
  const periode = parsePeriode(kode);

  const pdf = await htmlKePdf(await def.render(periode, new Date()));
  const namaFile = def.namaFile(periode);

  // Drive best-effort: arsipkanLaporan tidak melempar, gagal -> undefined.
  const folderKhusus = (await getConfig(`drive_folder_laporan_${id}`))?.trim() || undefined;
  const driveUrl = await arsipkanLaporan(namaFile, pdf, folderKhusus);

  try {
    const res = await turso().execute({
      sql: 'INSERT INTO laporan_riwayat (periode, jenis, nama_file, drive_url, dibuat_oleh) VALUES (?, ?, ?, ?, ?)',
      args: [periode.kode, id, namaFile, driveUrl ?? null, oleh],
    });
    return { namaFile, pdf, driveUrl, riwayatId: Number(res.lastInsertRowid) };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Laporan dibuat tetapi gagal dicatat ke riwayat: ${msg}`);
  }
}

export async function laporanSudahAda(id: string, kode: string): Promise<boolean> {
  const res = await turso().execute({
    sql: 'SELECT 1 FROM laporan_riwayat WHERE jenis = ? AND periode = ? LIMIT 1',
    args: [id, kode],
  });
  return res.rows.length > 0;
}

/** Validasi body POST: harus objek dengan id dan periode string. */
export function bacaBody(raw: unknown): { id: string; periode: string } | null {
  if (!raw || typeof raw !== 'object') return null;
  const { id, periode } = raw as Record<string, unknown>;
  return typeof id === 'string' && typeof periode === 'string' ? { id, periode } : null;
}
