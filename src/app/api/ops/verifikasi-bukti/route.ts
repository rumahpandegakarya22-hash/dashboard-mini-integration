import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/core/auth';
import { canAccess } from '@/lib/core/roles';
import { turso } from '@/lib/core/turso';
import { writeAudit } from '@/lib/core/audit';
import { getPenghuniByIds, labelPenghuni, urlBerkas } from '@/lib/teman-rara';
import { barisJurnalDp, barisJurnalSewa, kodeAkunKas } from '@/lib/jurnal';

/**
 * Verifikasi bukti bayar yang diunggah penghuni lewat aplikasi Teman Rara.
 *
 * Kolom `verified_at`/`verified_by` sudah lama ada di tabel tapi tidak pernah
 * punya mekanisme pengisinya — bukti menumpuk tanpa pernah ditandai. Migrasi
 * 004 menambah pasangannya untuk penolakan, sehingga bukti yang salah tidak
 * menggantung selamanya di antrean.
 *
 * PENTING: endpoint ini TIDAK mencatat pembayaran. Memverifikasi bukti hanya
 * berarti "berkasnya sah dan sudah dicek", bukan "uangnya masuk". Pencatatan
 * pembayaran tetap lewat form Pembayaran Sewa di atas panel ini, karena itu
 * yang menerbitkan invoice dan menulis jurnal.
 */

const LIMIT = 50;

async function gate() {
  const user = await getSessionUser();
  if (!user) return { error: NextResponse.json({ error: 'Belum login.' }, { status: 401 }) };
  if (!canAccess(user.role, 'pembayaran-sewa')) {
    return { error: NextResponse.json({ error: 'Divisi kamu tidak menangani pembayaran.' }, { status: 403 }) };
  }
  return { user };
}

export async function GET(req: NextRequest) {
  const g = await gate();
  if (g.error) return g.error;

  const semua = req.nextUrl.searchParams.get('filter') === 'semua';
  const res = await turso().execute(
    `SELECT p.id, p.id_penghuni, p.invoice_sewa_id, p.invoice_dp_id, p.file_url, p.file_type,
            p.file_size, p.catatan, p.created_at,
            p.verified_at, p.verified_by, p.rejected_at, p.rejected_by, p.rejected_reason,
            s.no_inv AS sewa_no_inv, s.grand_total AS sewa_total, s.periode_awal, s.periode_akhir,
            d.no_inv AS dp_no_inv, d.grand_total AS dp_total
     FROM tr_payment_proof p
     LEFT JOIN invoice_sewa s ON s.id = p.invoice_sewa_id
     LEFT JOIN invoice_dp   d ON d.id = p.invoice_dp_id
     ${semua ? '' : 'WHERE p.verified_at IS NULL AND p.rejected_at IS NULL'}
     ORDER BY p.created_at DESC
     LIMIT ${LIMIT}`
  );

  const penghuni = await getPenghuniByIds(res.rows.map((r) => String(r.id_penghuni)));

  const data = res.rows.map((r) => {
    const idp = String(r.id_penghuni);
    const sewa = r.sewa_no_inv != null;
    return {
      id: String(r.id),
      penghuni: labelPenghuni(penghuni.get(idp), idp),
      berkas: urlBerkas(String(r.file_url)),
      tipeBerkas: String(r.file_type ?? ''),
      ukuranKb: Math.round(Number(r.file_size ?? 0) / 1024),
      catatan: r.catatan ? String(r.catatan) : '',
      diunggah: String(r.created_at ?? '').slice(0, 10),
      invoice: sewa ? String(r.sewa_no_inv) : r.dp_no_inv != null ? String(r.dp_no_inv) : null,
      jenisInvoice: sewa ? 'Sewa' : r.dp_no_inv != null ? 'DP' : null,
      nominalInvoice: Number((sewa ? r.sewa_total : r.dp_total) ?? 0),
      periode: sewa && r.periode_awal ? `${String(r.periode_awal)} s/d ${String(r.periode_akhir ?? '')}` : null,
      status: r.verified_at ? 'Terverifikasi' : r.rejected_at ? 'Ditolak' : 'Menunggu',
      diprosesOleh: r.verified_by ? String(r.verified_by) : r.rejected_by ? String(r.rejected_by) : null,
      diprosesPada: r.verified_at
        ? String(r.verified_at).slice(0, 10)
        : r.rejected_at
          ? String(r.rejected_at).slice(0, 10)
          : null,
      alasanTolak: r.rejected_reason ? String(r.rejected_reason) : ''
    };
  });

  return NextResponse.json({ ok: true, data });
}

export async function PATCH(req: NextRequest) {
  const g = await gate();
  if (g.error) return g.error;
  const user = g.user!;
  const t0 = Date.now();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body bukan JSON yang valid.' }, { status: 400 });
  }

  const id = String(body.id ?? '').trim();
  const aksi = String(body.aksi ?? '').trim();
  const alasan = String(body.alasan ?? '').trim();

  if (!id) return NextResponse.json({ error: 'ID bukti wajib diisi.' }, { status: 400 });
  if (aksi !== 'verifikasi' && aksi !== 'tolak' && aksi !== 'batal') {
    return NextResponse.json({ error: 'Aksi harus "verifikasi", "tolak", atau "batal".' }, { status: 400 });
  }
  if (aksi === 'tolak' && alasan.length < 5) {
    return NextResponse.json({ error: 'Alasan penolakan wajib diisi (minimal 5 karakter).' }, { status: 400 });
  }
  if (alasan.length > 500) {
    return NextResponse.json({ error: 'Alasan maksimal 500 karakter.' }, { status: 400 });
  }

  const db = turso();
  const sebelum = await db.execute({
    sql: 'SELECT verified_at, verified_by, rejected_at, rejected_reason FROM tr_payment_proof WHERE id = ?',
    args: [id]
  });
  if (sebelum.rows.length === 0) return NextResponse.json({ error: 'Bukti tidak ditemukan.' }, { status: 404 });

  const sekarang = new Date().toISOString();
  // Verifikasi dan penolakan saling meniadakan — satu bukti tidak boleh
  // menyandang dua keputusan sekaligus.
  const args =
    aksi === 'verifikasi'
      ? [sekarang, user.username, null, null, null]
      : aksi === 'tolak'
        ? [null, null, sekarang, user.username, alasan]
        : [null, null, null, null, null];

  await db.execute({
    sql: `UPDATE tr_payment_proof
          SET verified_at = ?, verified_by = ?, rejected_at = ?, rejected_by = ?, rejected_reason = ?
          WHERE id = ?`,
    args: [...args, id]
  });

  /* "Bukti Sah" = pembayaran diakui, jadi baris `payment` dibuat di sini —
     admin tidak perlu mengetik ulang lewat modul Pembayaran Sewa. Datanya
     diambil dari invoice yang sudah tertaut ke bukti ini, jadi tidak ada angka
     yang diketik dua kali.

     Jurnal ikut dibuat HANYA kalau admin memilih akun kas/bank tujuan di panel
     — bukti unggahan penghuni tidak menyebutkannya, dan menebak berarti salah
     akun di pembukuan. Kalau tidak dipilih, payment tetap tercatat dan admin
     diberi peringatan. */
  let peringatan: string | undefined;
  if (aksi === 'verifikasi') peringatan = await catatPembayaran(id, user.username, String(body.akunKasBank ?? '').trim());

  await writeAudit({
    requestId: `bukti-${id}-${Date.now()}`,
    user,
    moduleId: 'verifikasi-bukti-bayar',
    action: 'UPDATE',
    target: `Turso → tr_payment_proof (${id})`,
    oldData: sebelum.rows[0],
    newData: { aksi, alasan: alasan || null },
    durationSec: (Date.now() - t0) / 1000,
    status: 'sukses'
  });

  return NextResponse.json({ ok: true, id, aksi, peringatan });
}

/** Buat baris `payment` dari invoice yang tertaut ke bukti. Idempoten: kalau
 *  baris untuk nomor invoice itu sudah ada, tidak melakukan apa-apa. */
async function catatPembayaran(idBukti: string, username: string, akunKasBank: string): Promise<string | undefined> {
  const db = turso();
  try {
    const b = (
      await db.execute({
        sql: 'SELECT id_penghuni, invoice_sewa_id, invoice_dp_id FROM tr_payment_proof WHERE id = ?',
        args: [idBukti]
      })
    ).rows[0] as any;
    const sewaId = b?.invoice_sewa_id ? Number(b.invoice_sewa_id) : null;
    const dpId = b?.invoice_dp_id ? Number(b.invoice_dp_id) : null;
    if (!sewaId && !dpId) return 'Bukti ini tidak tertaut ke invoice mana pun — pembayaran TIDAK dicatat otomatis, input lewat modul Pembayaran Sewa.';

    const inv = (
      await db.execute(
        sewaId
          ? { sql: 'SELECT * FROM invoice_sewa WHERE id = ?', args: [sewaId] }
          : { sql: 'SELECT *, tanggal_pembayaran AS periode_awal, NULL AS periode_akhir FROM invoice_dp WHERE id = ?', args: [dpId] }
      )
    ).rows[0] as any;
    if (!inv) return 'Invoice yang tertaut ke bukti ini tidak ditemukan — pembayaran TIDAK dicatat otomatis.';

    const tglBayar = String(inv.tanggal_pembayaran ?? new Date().toISOString().slice(0, 10));
    // Nama tabel ditentukan dari sewaId/dpId (bukan input) → aman diinterpolasi.
    const tabelInvoice = sewaId ? 'invoice_sewa' : 'invoice_dp';
    const invoiceId = sewaId ?? dpId;

    const sudah = await db.execute({ sql: 'SELECT 1 FROM payment WHERE id_payment = ? LIMIT 1', args: [String(inv.no_inv)] });
    const paymentBaru = sudah.rows.length === 0;

    /* Stempel `tanggal_pembayaran` di invoice = SATU-SATUNYA yang dibaca Teman
       Rara untuk status "Lunas". Selalu dijalankan (idempoten via WHERE), termasuk
       untuk bukti yang baris payment-nya sudah terlanjur tercatat tapi invoicenya
       belum distempel — tanpa ini tagihan penghuni tak pernah berubah jadi Lunas.
       Payment + stempel invoice dijalankan atomik. */
    const ops: { sql: string; args: (string | number | null)[] }[] = [];
    if (paymentBaru) {
      ops.push({
        sql: `INSERT INTO payment
                (id_payment, id_penghuni, invoice_dp_id, invoice_sewa_id, periode_awal, periode_akhir, amount, payment_date, status, notes)
              VALUES (?,?,?,?,?,?,?,?,'Paid',?)`,
        args: [
          String(inv.no_inv),
          String(inv.id_penghuni ?? b.id_penghuni),
          dpId,
          sewaId,
          inv.periode_awal ?? null,
          inv.periode_akhir ?? null,
          Number(inv.grand_total ?? 0),
          tglBayar,
          `Dari verifikasi bukti bayar penghuni oleh ${username}`
        ]
      });
    }
    ops.push({
      sql: `UPDATE ${tabelInvoice} SET tanggal_pembayaran = ? WHERE id = ? AND (tanggal_pembayaran IS NULL OR tanggal_pembayaran = '')`,
      args: [tglBayar, invoiceId]
    });
    await db.batch(ops, 'write');

    // Payment sudah pernah dicatat sebelumnya → cukup stempel invoicenya, jurnal
    // jangan diulang (sudah dibuat saat pencatatan pertama, atau diinput manual).
    if (!paymentBaru) return `Invoice ${inv.no_inv} ditandai lunas. Pembayaran sudah tercatat sebelumnya — jurnal tidak diulang.`;

    if (!akunKasBank) {
      return `Pembayaran ${inv.no_inv} tercatat & invoice ditandai lunas. Jurnal BELUM dibuat — akun kas/bank tujuan tidak dipilih, catat jurnalnya manual.`;
    }
    const kodeKas = await kodeAkunKas(akunKasBank);
    if (!kodeKas) {
      return `Pembayaran ${inv.no_inv} tercatat. Jurnal TIDAK dibuat: akun "${akunKasBank}" tidak ada di COA grup Kas & Bank.`;
    }
    const umum = {
      kodeKas,
      nama: String(inv.nama ?? ''),
      noKamar: String(inv.no_kamar ?? ''),
      tanggalBayar: tglBayar,
      diskon: Number(inv.diskon ?? 0),
      pajak: Number(inv.pajak ?? 0)
    };
    const baris = sewaId
      ? barisJurnalSewa({
          ...umum,
          periodeAwal: String(inv.periode_awal ?? umum.tanggalBayar),
          jumlahBulan: Number(inv.jumlah_bulan ?? 1) || 1,
          totalSewa: Number(inv.total_sewa ?? 0),
          totalListrik: Number(inv.total_listrik ?? 0),
          totalDenda: Number(inv.total_denda ?? 0),
          grandTotal: Number(inv.grand_total ?? 0)
        })
      : barisJurnalDp({ ...umum, subtotal: Number(inv.subtotal ?? inv.grand_total ?? 0) });
    await db.batch(
      baris.map((b) => ({
        sql: `INSERT INTO jurnal_transaksi (tanggal, akun_debit_kode, akun_kredit_kode, nominal, keterangan, kategori)
              VALUES (?,?,?,?,?,?)`,
        args: [b.tanggal, b.debit, b.kredit, b.nominal, b.keterangan, b.kategori]
      })),
      'write'
    );
    return `Pembayaran ${inv.no_inv} tercatat, invoice ditandai lunas & jurnal dibuat (${baris.length} baris) ke akun ${akunKasBank}.`;
  } catch (e: any) {
    console.error('[verifikasi-bukti] gagal catat payment:', e?.message);
    return `Bukti diverifikasi, tapi pencatatan pembayaran otomatis gagal (${e?.message || 'unknown'}) — input manual lewat modul Pembayaran Sewa.`;
  }
}
