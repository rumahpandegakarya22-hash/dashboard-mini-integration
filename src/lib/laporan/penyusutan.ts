import { turso } from '@/lib/core/turso';
import { nowWib } from '@/lib/core/validate';

/* =========================================================================
   Penyusutan aset tetap — metode garis lurus.
     penyusutan/bulan = (harga_perolehan - nilai_residu) / umur_bulan
   Jurnal per bulan: debit Beban Penyusutan (61xx) / kredit Akum (19xx).
   Idempoten: satu (aset, periode) hanya diposting sekali (tabel
   penyusutan_posting UNIQUE). Posting bisa backfill dari bulan perolehan.
   Posting berjalan sendiri (tanpa cron): lihat pastikanPenyusutanTerkini(), dipanggil saat laporan dan
   Dashboard dibaca. Penyusutan berhenti saat nilai buku mencapai nilai residu.
   ========================================================================= */

export type KategoriAset = 'Bangunan' | 'Elektronik' | 'Furniture' | 'Peralatan Operasional';

interface KategoriInfo { umurBulanDefault: number; bebanKode: number; akumKode: number; }

export const KATEGORI: Record<KategoriAset, KategoriInfo> = {
  'Bangunan':              { umurBulanDefault: 240, bebanKode: 6101, akumKode: 1901 }, // 20 th
  'Elektronik':            { umurBulanDefault: 48,  bebanKode: 6102, akumKode: 1902 }, // 4 th
  'Furniture':             { umurBulanDefault: 96,  bebanKode: 6103, akumKode: 1903 }, // 8 th
  'Peralatan Operasional': { umurBulanDefault: 48,  bebanKode: 6104, akumKode: 1904 }, // 4 th
};

export interface Aset {
  id: number;
  nama: string;
  kategori: KategoriAset;
  harga_perolehan: number;
  nilai_residu: number;
  tanggal_perolehan: string;
  umur_bulan: number;
  aktif: number;
  catatan: string | null;
}

function baseSusut(a: Aset): number {
  return Math.max(0, a.harga_perolehan - a.nilai_residu);
}
function perBulan(a: Aset): number {
  if (a.umur_bulan <= 0) return 0;
  return Math.round(baseSusut(a) / a.umur_bulan);
}

/** Enumerasi 'YYYY-MM' dari mulai s/d akhir (inklusif). */
function bulanRange(mulai: string, akhir: string): string[] {
  const out: string[] = [];
  let [y, m] = mulai.split('-').map(Number);
  const [ay, am] = akhir.split('-').map(Number);
  while (y < ay || (y === ay && m <= am)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return out;
}
function akhirBulan(periode: string): string {
  const [y, m] = periode.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

export async function listAset(): Promise<Aset[]> {
  const r = await turso().execute('SELECT * FROM aset_tetap ORDER BY tanggal_perolehan DESC, id DESC');
  return r.rows.map((x) => ({
    id: Number(x.id), nama: String(x.nama), kategori: String(x.kategori) as KategoriAset,
    harga_perolehan: Number(x.harga_perolehan), nilai_residu: Number(x.nilai_residu),
    tanggal_perolehan: String(x.tanggal_perolehan), umur_bulan: Number(x.umur_bulan),
    aktif: Number(x.aktif), catatan: x.catatan != null ? String(x.catatan) : null,
  }));
}

/** Akumulasi penyusutan yang sudah diposting per aset. */
async function akumulasiMap(): Promise<Map<number, number>> {
  const r = await turso().execute('SELECT aset_id, COALESCE(SUM(nominal),0) t FROM penyusutan_posting GROUP BY aset_id');
  const m = new Map<number, number>();
  for (const x of r.rows) m.set(Number(x[0]), Number(x[1]));
  return m;
}

async function kaliMap(): Promise<Map<number, number>> {
  const r = await turso().execute('SELECT aset_id, COUNT(*) n FROM penyusutan_posting GROUP BY aset_id');
  return new Map(r.rows.map((x) => [Number(x[0]), Number(x[1])]));
}

export interface AsetRingkas extends Aset {
  per_bulan: number;
  akumulasi: number;
  nilai_buku: number;
  /** Sudah berapa bulan disusutkan (jumlah baris posting). */
  kali: number;
  lunas: boolean;
}

export async function ringkasanAset(): Promise<AsetRingkas[]> {
  const [aset, akum, kali] = await Promise.all([listAset(), akumulasiMap(), kaliMap()]);
  return aset.map((a) => {
    const akumulasi = akum.get(a.id) ?? 0;
    return {
      ...a,
      per_bulan: perBulan(a),
      akumulasi,
      nilai_buku: a.harga_perolehan - akumulasi,
      kali: kali.get(a.id) ?? 0,
      lunas: akumulasi >= baseSusut(a),
    };
  });
}

/** Posting penyusutan garis lurus untuk semua aset aktif, backfill dari bulan
 *  perolehan s/d `sampaiPeriode` (YYYY-MM). Idempoten. */
export async function postingPenyusutan(sampaiPeriode: string): Promise<{ posted: number; total: number; skipped: number }> {
  const db = turso();
  const aset = (await listAset()).filter((a) => a.aktif === 1);
  const akum = await akumulasiMap();

  let posted = 0, total = 0, skipped = 0;

  for (const a of aset) {
    const info = KATEGORI[a.kategori];
    if (!info) { skipped++; continue; }
    const base = baseSusut(a);
    const bulanan = perBulan(a);
    if (bulanan <= 0) { skipped++; continue; }

    let terkumpul = akum.get(a.id) ?? 0;
    const mulai = a.tanggal_perolehan.slice(0, 7);
    if (mulai > sampaiPeriode) { skipped++; continue; }

    // periode yang sudah diposting untuk aset ini
    const existRes = await db.execute({
      sql: 'SELECT periode FROM penyusutan_posting WHERE aset_id=?',
      args: [a.id],
    });
    const sudah = new Set(existRes.rows.map((x) => String(x[0])));

    for (const periode of bulanRange(mulai, sampaiPeriode)) {
      if (sudah.has(periode)) continue;
      if (terkumpul >= base) break; // sudah lunas
      const nominal = Math.min(bulanan, base - terkumpul);
      if (nominal <= 0) break;

      // Satu transaksi: posting (UNIQUE), jurnal laba rugi, dan nilai buku di aset. Dua proses yang
      // berjalan bersamaan tidak bisa menggandakan jurnal karena yang kedua gagal di UNIQUE dan dibatalkan.
      try {
        await db.batch(
          [
            { sql: 'INSERT INTO penyusutan_posting (aset_id, periode, nominal) VALUES (?, ?, ?)', args: [a.id, periode, nominal] },
            {
              sql: `INSERT INTO jurnal_transaksi (tanggal, akun_debit_kode, akun_kredit_kode, nominal, keterangan, kategori)
                    VALUES (?, ?, ?, ?, ?, 'Non-Operasional')`,
              args: [akhirBulan(periode), info.bebanKode, info.akumKode, nominal, `Penyusutan ${a.nama} ${periode}`],
            },
            { sql: 'UPDATE aset_tetap SET nilai_buku = ? WHERE id = ?', args: [a.harga_perolehan - (terkumpul + nominal), a.id] },
          ],
          'write'
        );
      } catch (e) {
        if (/UNIQUE/i.test(String((e as Error)?.message))) { sudah.add(periode); continue; }
        throw e;
      }
      terkumpul += nominal;
      posted++;
      total += nominal;
    }
  }

  return { posted, total, skipped };
}

let memo = { periode: '', at: 0 };

/**
 * Pastikan penyusutan sampai bulan berjalan sudah tercatat di jurnal. Menghitung sendiri berapa bulan
 * yang belum diposting per aset, berhenti otomatis saat nilai buku mencapai nilai residu. Murah dan idempoten,
 * jadi dipanggil tiap laporan/Dashboard dibaca; hasilnya diingat 10 menit. `paksa` dipakai setelah aset ditambah.
 */
export async function pastikanPenyusutanTerkini(opsi: { paksa?: boolean } = {}): Promise<void> {
  const periode = nowWib().slice(0, 7);
  if (!opsi.paksa && memo.periode === periode && Date.now() - memo.at < 10 * 60_000) return;
  memo = { periode, at: Date.now() };
  try {
    await postingPenyusutan(periode);
  } catch (e) {
    memo.at = 0;
    console.error('[penyusutan] gagal posting otomatis:', (e as Error)?.message);
  }
}
