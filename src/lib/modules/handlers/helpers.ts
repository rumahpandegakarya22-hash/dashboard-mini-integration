import { turso } from '../../core/turso';
import { namaFileDokumen, renameDokumenDrive } from '../../drive-dokumen';
import type { SubmitContext, SubmitHandler } from '../types';

/* AppendConfig / createAppendHandler (jalur Google Sheets) DIHAPUS pada Wave 4
   migrasi Sheets → Turso: seluruh modul yang memakainya sudah pindah ke
   createInsertHandler di bawah. Satu-satunya penulis Sheets yang tersisa di
   repo adalah handlers/pembayaran-sewa.ts, yang memanggil appendRow langsung
   dan sengaja ditunda (lihat catatan di file itu). */

/**
 * Simpan URL lampiran (field `lampiran`, sudah di Drive via /api/upload) ke tabel Turso
 * `dokumen`. Best-effort: data utama sudah tercatat, gagal simpan link tidak membatalkan
 * submit — kembalikan warning supaya user tahu link harus dicatat manual.
 *
 * `penamaan` opsional: kalau diisi, berkasnya sekalian di-rename di Drive mengikuti
 * format (Jenis Docs)-(ID Docs)-(ID Penghuni). Dilakukan di sini, bukan saat unggah,
 * karena ID Penghuni baru pasti setelah submit tersimpan. ID Docs memakai
 * `penamaan.idDocs` kalau dokumennya sudah punya nomor sendiri (mis. nomor invoice
 * untuk bukti bayar); kalau tidak, dipakai id_dokumen yang dibuat di bawah.
 */
export async function saveLampiran(
  values: Record<string, unknown>,
  ctx: SubmitContext,
  judul: string,
  role: string,
  opts?: {
    field?: string;
    idDokumen?: string;
    penamaan?: { jenis: string; idDocs?: string; idPenghuni?: string };
  }
): Promise<string | undefined> {
  const { field = 'lampiran', penamaan } = opts ?? {};
  const url = String(values[field] ?? '').trim();
  if (!/^https:\/\//.test(url)) return undefined; // tidak ada lampiran / belum terunggah

  /* requestId sama untuk seluruh submit, sedangkan satu modul bisa mengunggah
     lebih dari satu berkas (mis. identitas + kontrak di Penghuni Baru). Tanpa
     pembeda nama field, id_dokumen keduanya identik dan INSERT kedua kena
     PRIMARY KEY constraint. */
  const pembeda = field === 'lampiran' ? '' : `-${field.replace(/^lampiran/i, '').toUpperCase()}`;
  const idDokumen =
    opts?.idDokumen || `DOC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${ctx.requestId.slice(0, 8)}${pembeda}`;

  const peringatanRename = penamaan
    ? await renameDokumenDrive(url, namaFileDokumen({ ...penamaan, idDocs: penamaan.idDocs || idDokumen }))
    : undefined;

  try {
    await turso().execute({
      sql: 'INSERT INTO dokumen (id_dokumen, judul, role, link_drive) VALUES (?, ?, ?, ?)',
      args: [idDokumen, judul.slice(0, 120), role, url]
    });
    return peringatanRename;
  } catch (e: any) {
    console.error('[lampiran] gagal simpan ke dokumen:', e?.message);
    return [peringatanRename, `Data tersimpan, tapi link lampiran gagal dicatat ke database — simpan manual: ${url}`]
      .filter(Boolean)
      .join(' ');
  }
}

/**
 * Resolve id_penghuni Turso (format 'KTD-YYMM-NNN', dari occupancy_history) dari nomor kamar.
 * SENGAJA TIDAK pakai Tenant.id (format 'KTD-x' dari sheet Database Penghuni) — dua ID itu
 * namespace berbeda dan TIDAK saling cocok (lihat "Skema Turso - Invoice DP dan Sewa.sql").
 * Tabel `payment`/`invoice_dp`/`invoice_sewa` FK ke occupancy_history, jadi query harus pakai id dari situ.
 */
export async function resolveOccupancyId(kamar: string): Promise<string | null> {
  const res = await turso().execute({
    sql: `SELECT id_penghuni FROM occupancy_history
          WHERE no_kamar = ? AND status = 'Check-in' AND tanggal_selesasi IS NULL
          ORDER BY tanggal_mulai DESC LIMIT 1`,
    args: [kamar]
  });
  return res.rows.length > 0 ? String(res.rows[0].id_penghuni) : null;
}

/* ----------------------------- Turso (Wave 2) ----------------------------- */

export interface InsertConfig {
  /** Nama tabel Turso tujuan. */
  table: string;
  /** Label audit, mis. "Turso → survey". */
  target: string;
  /** Bangun baris sebagai peta kolom → nilai. Kolom HARUS sama persis dgn skema
   *  (lihat db/schema/000_existing_snapshot.sql). Kolom yang tidak disebut
   *  dibiarkan DEFAULT/NULL. */
  buildRow: (values: Record<string, unknown>) => Record<string, string | number | null>;
  /** Sama seperti AppendConfig.lampiran — metadata upload disimpan ke tabel `dokumen`.
   *  `penamaan` opsional: dipakai untuk menyeragamkan nama berkas di Drive. Menerima
   *  rowid hasil INSERT supaya bisa dipakai sebagai kode unik yang merujuk barisnya. */
  lampiran?: {
    judul: (values: Record<string, unknown>) => string;
    role: string;
    penamaan?: (values: Record<string, unknown>, rowId?: number) => { jenis: string; idDocs: string };
  };
}

/**
 * Padanan Turso dari createAppendHandler (migrasi Sheets → Turso, Wave 2).
 *
 * Perbedaan yang disengaja dari versi Sheets:
 * - TIDAK ada assertHeaders: urutan/nama kolom dijamin skema database, bukan
 *   posisi kolom sheet yang bisa bergeser. Ini justru menghapus seluruh kelas
 *   bug "salah kolom diam-diam" yang dulu dijaga assertHeaders.
 * - TIDAK ada prefiks apostrof pada nomor HP. Itu hack khusus Sheets supaya
 *   angka panjang tidak diubah jadi notasi ilmiah; kolom TEXT Turso menyimpan
 *   apa adanya, jadi apostrofnya harus DIBUANG (kalau tidak, ikut tersimpan).
 * - `row` yang dikembalikan kini rowid Turso, bukan nomor baris sheet.
 */
export function createInsertHandler(cfg: InsertConfig): SubmitHandler {
  return async (values, ctx) => {
    const row = cfg.buildRow(values);
    const cols = Object.keys(row);
    if (cols.length === 0) throw new Error(`buildRow untuk tabel ${cfg.table} tidak menghasilkan kolom apa pun.`);
    const res = await turso().execute({
      sql: `INSERT INTO "${cfg.table}" (${cols.map((c) => `"${c}"`).join(', ')})
            VALUES (${cols.map(() => '?').join(', ')})`,
      args: cols.map((c) => row[c])
    });
    const rowId = res.lastInsertRowid != null ? Number(res.lastInsertRowid) : undefined;
    const warning = cfg.lampiran
      ? await saveLampiran(values, ctx, cfg.lampiran.judul(values), cfg.lampiran.role, {
          penamaan: cfg.lampiran.penamaan?.(values, rowId)
        })
      : undefined;
    return { target: cfg.target, row: rowId, data: values, warning };
  };
}

