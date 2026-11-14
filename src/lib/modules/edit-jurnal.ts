import { turso } from '../core/turso';
import { balikBarisJurnal, cekAlasan, dalamTransaksi, grupBaru, idJurnalGrup } from '../koreksi';
import { fmtTanggal } from '../format-tanggal';
import { catatPengeluaran } from './handlers/beban-dimuka';
import { catatPemasukan, parseAktivitas } from './handlers/aktivitas-finansial';
import type { EditEntry } from './edit';

/* =========================================================================
   Koreksi dan void untuk modul Aktivitas Finansial (jurnal_transaksi).

   Tidak ada edit-di-tempat. "Simpan" pada form edit = KOREKSI: baris lama
   dibalik (void) dan transaksi baru dicatat, dalam satu transaksi database.

   Yang bisa dikoreksi:
   - Transaksi yang dibuat modul ini (grup_id berawalan "AF-"), termasuk beban
     dibayar dimuka beserta seluruh baris amortisasinya (satu grup).
   - Baris lama tanpa grup_id yang jelas berasal dari modul ini: keterangan
     "Pemasukan: ..." atau debit ke akun Beban. Rujukannya "L:<id>" dan hanya
     satu baris. Baris pembayaran sewa/DP, pengakuan pendapatan, penyusutan, dst.
     TIDAK ditawarkan di sini.
   ========================================================================= */

const GRUP_AF = /^AF-[0-9a-f]{8}$/;
const REF_LAMA = /^L:(\d+)$/;
const LIST_LIMIT = 20;

interface Baris {
  id: number;
  tanggal: string;
  nominal: number;
  keterangan: string;
  kategori: string;
  grup_id: string | null;
  dibalik_oleh: number | null;
  dn: string;
  dt: string;
  kn: string;
}

function keForm(rows: Baris[]): Record<string, string> {
  const r0 = rows[0];
  const dasar = { tanggal: String(r0.tanggal ?? '').slice(0, 10), divisi: '' };

  if (/^Pemasukan:/.test(r0.keterangan)) {
    const sisa = r0.keterangan.replace(/^Pemasukan:\s*/, '');
    const [nama, ...catatan] = sisa.split(' — ');
    return {
      ...dasar,
      jenisAktivitas: 'Pemasukan',
      namaTransaksi: nama,
      jumlah: String(r0.nominal),
      akunTujuanPemasukan: r0.dn,
      akunPendapatan: r0.kn,
      keteranganPemasukan: catatan.join(' — ')
    };
  }

  const dimuka = r0.keterangan.match(/^Bayar dimuka (\d+) bln: (.*)$/);
  if (dimuka && rows.length > 1) {
    return {
      ...dasar,
      jenisAktivitas: 'Pengeluaran',
      tipeAkun: rows[1].dt,
      akunTujuan: rows[1].dn,
      akunSumber: r0.kn,
      nominal: String(r0.nominal),
      keterangan: dimuka[2],
      kategori: r0.kategori,
      bebanDimuka: 'ya',
      jumlahBulanAmortisasi: dimuka[1]
    };
  }

  return {
    ...dasar,
    jenisAktivitas: 'Pengeluaran',
    tipeAkun: r0.dt,
    akunTujuan: r0.dn,
    akunSumber: r0.kn,
    nominal: String(r0.nominal),
    keterangan: r0.keterangan,
    kategori: r0.kategori
  };
}

async function daftar(): Promise<EditEntry[]> {
  const rs = await turso().execute(
    `SELECT j.id, j.tanggal, j.nominal, j.keterangan, j.kategori, j.grup_id, j.dibalik_oleh,
            d.nama_akun AS dn, d.tipe_akun AS dt, k.nama_akun AS kn
     FROM jurnal_transaksi j
     LEFT JOIN coa d ON d.kode = j.akun_debit_kode
     LEFT JOIN coa k ON k.kode = j.akun_kredit_kode
     WHERE j.void_dari IS NULL AND j.dibalik_oleh IS NULL
       AND ( j.grup_id LIKE 'AF-%'
          OR (j.grup_id IS NULL AND (j.keterangan LIKE 'Pemasukan:%' OR d.tipe_akun IN ('Beban', 'Beban Non-Operasional'))
              AND j.keterangan NOT LIKE 'Amortisasi%' AND j.keterangan NOT LIKE 'Pengakuan%'
              AND j.keterangan NOT LIKE 'Diskon %' AND j.keterangan NOT LIKE 'Penyusutan%') )
     ORDER BY j.id DESC LIMIT 400`
  );
  const baris = rs.rows.map((r) => ({
    id: Number(r.id),
    tanggal: String(r.tanggal ?? ''),
    nominal: Number(r.nominal ?? 0),
    keterangan: String(r.keterangan ?? ''),
    kategori: String(r.kategori ?? ''),
    grup_id: r.grup_id ? String(r.grup_id) : null,
    dibalik_oleh: r.dibalik_oleh == null ? null : Number(r.dibalik_oleh),
    dn: String(r.dn ?? ''),
    dt: String(r.dt ?? ''),
    kn: String(r.kn ?? '')
  })) as Baris[];

  // Kelompokkan per grup_id; tiap baris lama tanpa grup berdiri sendiri.
  const grup = new Map<string, Baris[]>();
  for (const b of baris) {
    const kunci = b.grup_id ?? `L:${b.id}`;
    grup.set(kunci, [...(grup.get(kunci) ?? []), b]);
  }
  const hasil: EditEntry[] = [];
  for (const [ref, rows] of grup) {
    rows.sort((a, b) => a.id - b.id);
    // Grup beban dimuka: baris amortisasi ikut grup yang sama, yang pertama (id terkecil) adalah pembayarannya.
    const nominal = rows[0].nominal;
    hasil.push({
      ref,
      label: `${fmtTanggal(rows[0].tanggal)} · ${rows[0].keterangan.slice(0, 70)} · Rp${nominal.toLocaleString('id-ID')}`,
      values: keForm(rows)
    });
    if (hasil.length >= LIST_LIMIT) break;
  }
  return hasil;
}

async function idAktif(ref: string): Promise<number[]> {
  if (GRUP_AF.test(ref)) return idJurnalGrup(ref);
  const lama = ref.match(REF_LAMA);
  if (!lama) throw new Error('Referensi transaksi tidak valid.');
  const rs = await turso().execute({
    sql: 'SELECT id FROM jurnal_transaksi WHERE id = ? AND grup_id IS NULL AND void_dari IS NULL AND dibalik_oleh IS NULL',
    args: [Number(lama[1])]
  });
  return rs.rows.map((r) => Number(r.id));
}

export const aktivitasFinansialEdit = {
  kind: 'custom' as const,
  mode: 'koreksi' as const,
  list: daftar,

  /** Simpan = koreksi: void entri lama, catat entri baru, satu transaksi. */
  save: async (ref: string, values: Record<string, unknown>): Promise<string> => {
    const parsed = parseAktivitas(values);
    const ids = await idAktif(ref);
    const grupId = grupBaru('AF');
    await dalamTransaksi(async (tx) => {
      await balikBarisJurnal(tx, ids, 'Koreksi data');
      if (parsed.jenis === 'Pengeluaran') await catatPengeluaran(parsed.p, { tx, grupId, koreksiDari: ref });
      else await catatPemasukan(parsed.p, { tx, grupId, koreksiDari: ref });
    });
    return 'Entri lama di-void dengan baris pembalik dan entri koreksi dicatat baru. Laporan yang sudah dibuat sebelumnya tidak ikut berubah.';
  },

  void: async (ref: string, alasan: string): Promise<string> => {
    const a = cekAlasan(alasan);
    const ids = await idAktif(ref);
    await dalamTransaksi((tx) => balikBarisJurnal(tx, ids, a));
    return 'Transaksi di-void dengan baris pembalik. Laporan yang sudah dibuat sebelumnya tidak ikut berubah.';
  }
};
