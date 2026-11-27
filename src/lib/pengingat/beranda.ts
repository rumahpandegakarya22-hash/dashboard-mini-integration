import type { KartuTagihan } from '@/components/PengingatTagihan';
import { turso } from '@/lib/core/turso';
import { fmtTanggal, hariIniIso } from '@/lib/format-tanggal';
import { bacaRekening, bacaTagihan } from './db';
import { URUTAN_TAHAP, keterangan, nomorWa, susunDaftar, susunDraft, type Tahap } from './tagihan';

/** null = gagal dibaca; beranda tetap tampil. */
export async function muatKartuTagihan(): Promise<Record<Tahap, KartuTagihan[]> | null> {
  try {
    const [baris, { rekening }] = await Promise.all([bacaTagihan(turso()), bacaRekening(turso())]);
    const daftar = susunDaftar(baris, hariIniIso());
    return Object.fromEntries(
      URUTAN_TAHAP.map((tahap) => [
        tahap,
        daftar[tahap].map((t) => ({
          id: t.idPenghuni,
          nama: t.nama,
          noKamar: t.noKamar,
          tipe: t.tipe,
          jatuhTempo: fmtTanggal(t.jatuhTempo),
          keterangan: keterangan(t),
          nomor: nomorWa(t.noHp),
          draft: rekening ? susunDraft(t, rekening) : null
        }))
      ])
    ) as Record<Tahap, KartuTagihan[]>;
  } catch (e) {
    console.error('[pengingat] gagal membaca tagihan:', e);
    return null;
  }
}
