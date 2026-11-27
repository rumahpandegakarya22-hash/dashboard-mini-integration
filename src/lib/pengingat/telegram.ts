/* Rangkuman tagihan ke Telegram untuk admin, sekali per penghuni per tahap per tanggal jatuh tempo. */
import type { Client } from '@libsql/client';
import { fmtTanggal } from '../format-tanggal';
import { bacaTagihan } from './db';
import { JUDUL_TAHAP, URUTAN_TAHAP, keterangan, susunDaftar, type Tagihan } from './tagihan';

const BATAS_TELEGRAM = 4096;
const escapeHtml = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

/** `daftar` harus sudah berurutan per tahap. */
export function susunPesanTelegram(daftar: Tagihan[], tautan: string): { teks: string; isi: Tagihan[] }[] {
  const kepala = `🔔 <b>Pengingat tagihan kost</b>\nMohon broadcast lewat web app: ${escapeHtml(tautan)}`;
  const pecahan: { teks: string; isi: Tagihan[] }[] = [];
  for (const t of daftar) {
    const judul = `\n\n<b>${JUDUL_TAHAP[t.tahap]}</b>`;
    const baris =
      `\n• ${escapeHtml(t.nama.slice(0, 100))} — Kamar ${escapeHtml(t.noKamar)}${t.tipe ? ` (${escapeHtml(t.tipe)})` : ''}` +
      `\n  Jatuh tempo ${fmtTanggal(t.jatuhTempo)} · ${keterangan(t)}`;
    const akhir = pecahan.at(-1);
    const tambahan = (akhir?.isi.at(-1)?.tahap === t.tahap ? '' : judul) + baris;
    if (akhir && akhir.teks.length + tambahan.length <= BATAS_TELEGRAM) {
      akhir.teks += tambahan;
      akhir.isi.push(t);
    } else {
      pecahan.push({ teks: kepala + judul + baris, isi: [t] });
    }
  }
  return pecahan;
}

const kunci = (t: Tagihan) => [t.idPenghuni, t.jatuhTempo, t.tahap];

export async function jalankanPengingat(
  db: Client,
  kirim: (teks: string) => Promise<void>,
  hariIni: string,
  tautan: string
): Promise<{ terkirim: number }> {
  const daftar = susunDaftar(await bacaTagihan(db), hariIni);
  const semua = URUTAN_TAHAP.flatMap((t) => daftar[t]);
  if (!semua.length) return { terkirim: 0 };

  // Klaim dulu baru kirim: run yang bersamaan tidak mendapat baris yang sama.
  const klaim = await db.batch(
    semua.map((t) => ({
      sql: `INSERT INTO tagihan_pengingat_log (id_penghuni, jatuh_tempo, tahap) VALUES (?, ?, ?)
            ON CONFLICT DO NOTHING RETURNING id_penghuni`,
      args: kunci(t)
    })),
    'write'
  );
  const pecahan = susunPesanTelegram(semua.filter((_, i) => klaim[i].rows.length > 0), tautan);

  let terkirim = 0;
  for (const [i, p] of pecahan.entries()) {
    try {
      await kirim(p.teks);
    } catch (e) {
      // Lepas klaim yang belum terkirim supaya run berikutnya mencoba lagi.
      await db.batch(
        pecahan.slice(i).flatMap((sisa) => sisa.isi).map((t) => ({
          sql: 'DELETE FROM tagihan_pengingat_log WHERE id_penghuni = ? AND jatuh_tempo = ? AND tahap = ?',
          args: kunci(t)
        })),
        'write'
      );
      throw e;
    }
    terkirim += p.isi.length;
  }
  return { terkirim };
}

export async function kirimTelegram(token: string, chatId: string, teks: string): Promise<void> {
  // URL memuat token, jadi error jaringan asli tidak diteruskan ke log.
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: teks, parse_mode: 'HTML', disable_web_page_preview: true }),
    signal: AbortSignal.timeout(15_000)
  }).catch(() => {
    throw new Error('Telegram tidak bisa dihubungi.');
  });
  if (!res.ok) throw new Error(`Telegram menolak pesan (HTTP ${res.status}): ${(await res.text()).slice(0, 200)}`);
}
