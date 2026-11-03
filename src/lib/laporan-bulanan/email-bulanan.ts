import type { Lampiran } from '@/lib/core/email';
import type { HasilCron } from './cron';
import { esc, waktuWib } from './format';

export type KeluargaEmail = 'keuangan' | 'kerja' | 'kinerja';
export interface ItemEmail { id: string; keluarga: KeluargaEmail }

export interface HasilEmail {
  status: 'terkirim' | 'dilewati' | 'ditunda' | 'gagal';
  alasan?: string;
  error?: string;
  jumlahEmail?: number;
  jumlahLampiran?: number;
}

export interface DepsEmail {
  kode: string;
  label: string;
  laporan: ItemEmail[];
  ambilPdf(id: string): Promise<{ namaFile: string; pdf: Buffer }>;
  tujuan(): Promise<string | null | undefined>;
  sudahTerkirim(kode: string): Promise<boolean>;
  tandaiTerkirim(kode: string): Promise<void>;
  kirim(o: { to: string; subject: string; html: string; lampiran: Lampiran[] }): Promise<void>;
  sekarang?(): Date;
  batasBytes?: number;
}

// Brevo membatasi total lampiran per email sekitar 4 MB; sisakan ruang untuk overhead.
const BATAS_BAWAAN = 3.5 * 1024 * 1024;

const KELOMPOK: [KeluargaEmail, string][] = [
  ['keuangan', 'Laporan Keuangan'],
  ['kerja', 'Laporan Kerja Divisi'],
  ['kinerja', 'Laporan Kinerja Divisi'],
];

// Serakan berurutan: bagian baru dibuka hanya saat bagian berjalan sudah berisi dan akan melewati batas.
export function bagiLampiran<T extends { ukuran: number }>(items: T[], batas: number): T[][] {
  const bagian: T[][] = [];
  let sekarang: T[] = [];
  let total = 0;
  for (const it of items) {
    if (sekarang.length > 0 && total + it.ukuran > batas) {
      bagian.push(sekarang);
      sekarang = [];
      total = 0;
    }
    sekarang.push(it);
    total += it.ukuran;
  }
  if (sekarang.length > 0) bagian.push(sekarang);
  return bagian;
}

export function rakitEmail(o: {
  label: string;
  waktu: string;
  berkas: { keluarga: KeluargaEmail; namaFile: string }[];
  bagian: number;
  dari: number;
}): { subject: string; html: string } {
  const subject = `Laporan Bulanan Kost Tiga Dara - ${o.label}${o.dari > 1 ? ` (bagian ${o.bagian}/${o.dari})` : ''}`;
  const kelompok = KELOMPOK.map(([kunci, judul]) => {
    const daftar = o.berkas.filter(b => b.keluarga === kunci);
    if (daftar.length === 0) return '';
    return `<h3 style="margin:16px 0 6px;font-size:15px">${judul}</h3><ul style="margin:0;padding-left:20px">${daftar.map(b => `<li>${esc(b.namaFile)}</li>`).join('')}</ul>`;
  }).join('');
  const lanjutan = o.dari > 1
    ? `<p style="color:#666">Karena ukuran lampiran, laporan periode ini dikirim dalam ${o.dari} email. Ini bagian ${o.bagian}.</p>`
    : '';
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;line-height:1.5">`
    + `<p>Halo,</p>`
    + `<p>Terlampir laporan bulanan <b>Kost Tiga Dara Putri UGM</b> periode <b>${esc(o.label)}</b> (${o.berkas.length} berkas PDF).</p>`
    + lanjutan
    + kelompok
    + `<p style="margin-top:20px;color:#666;font-size:12px">Email ini dikirim otomatis pada ${esc(o.waktu)} WIB. Alamat tujuan diatur di halaman Laporan.</p>`
    + `</div>`;
  return { subject, html };
}

export async function kirimEmailBulanan(d: DepsEmail): Promise<HasilEmail> {
  if (await d.sudahTerkirim(d.kode)) return { status: 'dilewati', alasan: 'Email periode ini sudah terkirim.' };
  const to = (await d.tujuan())?.trim();
  if (!to) return { status: 'dilewati', alasan: 'Alamat email tujuan belum diatur.' };

  // Kelompok Keuangan, Kerja, Kinerja; urutan dalam kelompok mengikuti registry.
  const urut = [...d.laporan].sort(
    (a, b) => KELOMPOK.findIndex(k => k[0] === a.keluarga) - KELOMPOK.findIndex(k => k[0] === b.keluarga),
  );
  const berkas: { keluarga: KeluargaEmail; namaFile: string; pdf: Buffer; ukuran: number }[] = [];
  for (const it of urut) {
    try {
      const { namaFile, pdf } = await d.ambilPdf(it.id);
      berkas.push({ keluarga: it.keluarga, namaFile, pdf, ukuran: pdf.length });
    } catch (e: unknown) {
      return { status: 'gagal', error: `Gagal membuat ${it.id}: ${e instanceof Error ? e.message : String(e)}` };
    }
  }

  const bagian = bagiLampiran(berkas, d.batasBytes ?? BATAS_BAWAAN);
  const waktu = waktuWib((d.sekarang ?? (() => new Date()))(), true);
  for (let i = 0; i < bagian.length; i++) {
    const { subject, html } = rakitEmail({ label: d.label, waktu, berkas: bagian[i], bagian: i + 1, dari: bagian.length });
    try {
      await d.kirim({
        to,
        subject,
        html,
        lampiran: bagian[i].map(b => ({ namaFile: b.namaFile, mime: 'application/pdf', isi: b.pdf })),
      });
    } catch (e: unknown) {
      return { status: 'gagal', error: `Gagal mengirim email bagian ${i + 1}/${bagian.length}: ${e instanceof Error ? e.message : String(e)}` };
    }
  }

  try {
    await d.tandaiTerkirim(d.kode);
  } catch (e: unknown) {
    return {
      status: 'terkirim',
      jumlahEmail: bagian.length,
      jumlahLampiran: berkas.length,
      alasan: `Email terkirim, tetapi penanda gagal disimpan (cron berikutnya bisa mengirim ulang): ${e instanceof Error ? e.message : String(e)}`,
    };
  }
  return { status: 'terkirim', jumlahEmail: bagian.length, jumlahLampiran: berkas.length };
}

// Email hanya dikirim bila semua laporan periode itu ada; bila ada yang gagal, ditunda sampai cron/Run berikutnya.
export async function emailSetelahCron(hasil: HasilCron[], kirim: () => Promise<HasilEmail>): Promise<HasilEmail> {
  if (hasil.some(h => h.status === 'gagal')) {
    return { status: 'ditunda', alasan: 'Ada laporan yang gagal dibuat; email dikirim setelah semuanya berhasil.' };
  }
  try {
    return await kirim();
  } catch (e: unknown) {
    return { status: 'gagal', error: e instanceof Error ? e.message : String(e) };
  }
}
