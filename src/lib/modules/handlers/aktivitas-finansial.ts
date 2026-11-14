import type { Transaction } from '@libsql/client';
import { parseDateISO, parseRupiah, required } from '../../core/validate';
import { turso } from '../../core/turso';
import { grupBaru } from '../../koreksi';
import { saveLampiran } from './helpers';
import { catatPengeluaran, type OpsiJurnal, type PengeluaranParams } from './beban-dimuka';
import type { SubmitHandler } from '../types';
import { fmtTanggal } from '../../format-tanggal';

export type PemasukanParams = {
  tanggal: string;
  namaTransaksi: string;
  nominal: number;
  akunKas: string;
  akunPendapatan: string;
  catatan: string;
};

export type AktivitasParsed =
  | { jenis: 'Pengeluaran'; p: PengeluaranParams; divisi: string }
  | { jenis: 'Pemasukan'; p: PemasukanParams };

/** Satu aturan validasi untuk input baru DAN koreksi. */
export function parseAktivitas(values: Record<string, unknown>): AktivitasParsed {
  const jenis = required(values.jenisAktivitas, 'Jenis Aktivitas');
  const tanggal = parseDateISO(String(values.tanggal ?? ''));

  if (jenis === 'Pengeluaran') {
    return {
      jenis,
      divisi: required(values.divisi, 'Divisi Pengeluar Biaya'),
      p: {
        tanggal,
        akunDebit: required(values.akunTujuan, 'COA Tujuan'),
        akunKredit: required(values.akunSumber, 'COA Sumber'),
        nominal: parseRupiah(values.nominal as string | number),
        keterangan: required(values.keterangan, 'Keterangan'),
        kategori: required(values.kategori, 'Kategori'),
        bebanDimuka: String(values.bebanDimuka ?? '') === 'ya',
        jumlahBulan: Number(values.jumlahBulanAmortisasi ?? 0)
      }
    };
  }

  const nominal = parseRupiah(values.jumlah as string | number);
  if (nominal <= 0) throw new Error('Jumlah nominal harus lebih dari 0.');
  return {
    jenis: 'Pemasukan',
    p: {
      tanggal,
      namaTransaksi: required(values.namaTransaksi, 'Nama Transaksi'),
      nominal,
      akunKas: required(values.akunTujuanPemasukan, 'COA Tujuan (Kas/Bank)'),
      akunPendapatan: required(values.akunPendapatan, 'Akun Pendapatan'),
      catatan: String(values.keteranganPemasukan ?? '').trim()
    }
  };
}

/** Pemasukan: debit kas/bank, kredit akun pendapatan, supaya masuk Laba Rugi, Arus Kas, Neraca, dan dashboard. */
export async function catatPemasukan(p: PemasukanParams, opsi: OpsiJurnal = {}): Promise<number> {
  const db = turso();
  const baca = (opsi.tx as Transaction | undefined) ?? db;
  const kode = async (nama: string, syarat: string) => {
    const r = await baca.execute({ sql: `SELECT kode FROM coa WHERE nama_akun = ? AND ${syarat}`, args: [nama] });
    return r.rows[0]?.kode ?? null;
  };
  const kodeKas = await kode(p.akunKas, "grup_laporan = 'Kas & Bank'");
  const kodePendapatan = await kode(p.akunPendapatan, "tipe_akun = 'Pendapatan'");
  if (kodeKas === null) throw new Error(`Akun "${p.akunKas}" bukan akun Kas & Bank — pemasukan TIDAK dicatat.`);
  if (kodePendapatan === null) throw new Error(`Akun "${p.akunPendapatan}" bukan akun Pendapatan — pemasukan TIDAK dicatat.`);

  const keterangan = `Pemasukan: ${p.namaTransaksi}${p.catatan ? ` — ${p.catatan}` : ''}`;
  const res = await baca.execute({
    sql: `INSERT INTO jurnal_transaksi (tanggal, akun_debit_kode, akun_kredit_kode, nominal, keterangan, kategori, grup_id, koreksi_dari)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [p.tanggal, kodeKas, kodePendapatan, p.nominal, keterangan, 'Operasional', opsi.grupId ?? null, opsi.koreksiDari ?? null]
  });
  return Number(res.lastInsertRowid ?? -1);
}

export const submitAktivitasFinansial: SubmitHandler = async (values, ctx) => {
  const parsed = parseAktivitas(values);
  const grupId = grupBaru('AF');

  if (parsed.jenis === 'Pengeluaran') {
    const { p, divisi } = parsed;
    const { row } = await catatPengeluaran(p, { grupId });
    const db = turso();

    const prefixNota = `NOTA-${p.tanggal.slice(2, 4)}${p.tanggal.slice(5, 7)}-${divisi}`;
    const urut = await db.execute({
      sql: `SELECT id_dokumen FROM dokumen WHERE id_dokumen LIKE ? ORDER BY id_dokumen DESC LIMIT 1`,
      args: [`${prefixNota}-%`]
    });
    const terakhir = parseInt(String(urut.rows[0]?.id_dokumen ?? '').slice(-3), 10) || 0;
    const nomorNota = `${prefixNota}-${String(Math.min(terakhir + 1, 999)).padStart(3, '0')}`;

    const lampiranWarning = await saveLampiran(
      { ...values, lampiran: values.lampiranPengeluaran },
      ctx,
      `Nota Pengeluaran — ${p.keterangan} (${fmtTanggal(p.tanggal)})`,
      'Admin',
      { idDokumen: nomorNota, penamaan: { jenis: 'Nota', idDocs: nomorNota.replace(/^NOTA-/, '') } }
    );

    return {
      target: 'Turso → jurnal_transaksi',
      row,
      data: { ...p, jenisAktivitas: parsed.jenis, divisi, grupId },
      warning: lampiranWarning || undefined
    };
  }

  const row = await catatPemasukan(parsed.p, { grupId });
  return {
    target: 'Turso → jurnal_transaksi',
    row,
    data: { ...parsed.p, jenisAktivitas: parsed.jenis, grupId }
  };
};
