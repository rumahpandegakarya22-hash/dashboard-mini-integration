import { parseDateISO, parseRupiah, required } from '../../core/validate';
import { turso } from '../../core/turso';
import { saveLampiran } from './helpers';
import { catatPengeluaran } from './beban-dimuka';
import type { SubmitHandler } from '../types';

export const submitAktivitasFinansial: SubmitHandler = async (values, ctx) => {
  const jenisAktivitas = required(values.jenisAktivitas, 'Jenis Aktivitas');

  if (jenisAktivitas === 'Pengeluaran') {
    const tanggal = parseDateISO(String(values.tanggal ?? ''));
    const akunDebit = required(values.akunTujuan, 'COA Tujuan');
    const akunKredit = required(values.akunSumber, 'COA Sumber');
    const nominal = parseRupiah(values.nominal as string | number);
    const keterangan = required(values.keterangan, 'Keterangan');
    const kategori = required(values.kategori, 'Kategori');
    const divisi = required(values.divisi, 'Divisi Pengeluar Biaya');

    const { row } = await catatPengeluaran({
      tanggal,
      akunDebit,
      akunKredit,
      nominal,
      keterangan,
      kategori,
      bebanDimuka: String(values.bebanDimuka ?? '') === 'ya',
      jumlahBulan: Number(values.jumlahBulanAmortisasi ?? 0)
    });
    const db = turso();

    const prefixNota = `NOTA-${tanggal.slice(2, 4)}${tanggal.slice(5, 7)}-${divisi}`;
    const urut = await db.execute({
      sql: `SELECT id_dokumen FROM dokumen WHERE id_dokumen LIKE ? ORDER BY id_dokumen DESC LIMIT 1`,
      args: [`${prefixNota}-%`]
    });
    const terakhir = parseInt(String(urut.rows[0]?.id_dokumen ?? '').slice(-3), 10) || 0;
    const nomorNota = `${prefixNota}-${String(Math.min(terakhir + 1, 999)).padStart(3, '0')}`;

    const lampiranWarning = await saveLampiran(
      { ...values, lampiran: values.lampiranPengeluaran },
      ctx,
      `Nota Pengeluaran — ${keterangan} (${tanggal})`,
      'Admin',
      { idDokumen: nomorNota, penamaan: { jenis: 'Nota', idDocs: nomorNota.replace(/^NOTA-/, '') } }
    );

    return {
      target: 'Turso → jurnal_transaksi',
      row,
      data: { tanggal, jenisAktivitas, akunDebit, akunKredit, nominal, keterangan, kategori, divisi },
      warning: lampiranWarning || undefined
    };
  }

  // Pemasukan: dicatat ke jurnal (debit kas/bank, kredit akun pendapatan) supaya masuk
  // Laba Rugi, Arus Kas, Neraca, dan dashboard. Dulu hanya ke tabel income_non_rent yang tidak terbaca laporan.
  const tanggal = parseDateISO(String(values.tanggal ?? ''));
  const namaTransaksi = required(values.namaTransaksi, 'Nama Transaksi');
  const nominal = parseRupiah(values.jumlah as string | number);
  if (nominal <= 0) throw new Error('Jumlah nominal harus lebih dari 0.');
  const akunKas = required(values.akunTujuanPemasukan, 'COA Tujuan (Kas/Bank)');
  const akunPendapatan = required(values.akunPendapatan, 'Akun Pendapatan');
  const catatan = String(values.keteranganPemasukan ?? '').trim();

  const db = turso();
  const kode = async (nama: string, syarat: string) => {
    const r = await db.execute({ sql: `SELECT kode FROM coa WHERE nama_akun = ? AND ${syarat}`, args: [nama] });
    return r.rows[0]?.kode ?? null;
  };
  const kodeKas = await kode(akunKas, "grup_laporan = 'Kas & Bank'");
  const kodePendapatan = await kode(akunPendapatan, "tipe_akun = 'Pendapatan'");
  if (kodeKas === null) throw new Error(`Akun "${akunKas}" bukan akun Kas & Bank — pemasukan TIDAK dicatat.`);
  if (kodePendapatan === null) throw new Error(`Akun "${akunPendapatan}" bukan akun Pendapatan — pemasukan TIDAK dicatat.`);

  const keterangan = `Pemasukan: ${namaTransaksi}${catatan ? ` — ${catatan}` : ''}`;
  const res = await db.execute({
    sql: 'INSERT INTO jurnal_transaksi (tanggal, akun_debit_kode, akun_kredit_kode, nominal, keterangan, kategori) VALUES (?, ?, ?, ?, ?, ?)',
    args: [tanggal, kodeKas, kodePendapatan, nominal, keterangan, 'Operasional']
  });

  return {
    target: 'Turso → jurnal_transaksi',
    row: Number(res.lastInsertRowid ?? -1),
    data: { tanggal, jenisAktivitas, namaTransaksi, nominal, akunKas, akunPendapatan, keterangan: catatan }
  };
};
