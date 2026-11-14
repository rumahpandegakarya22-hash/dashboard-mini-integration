import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/core/auth';
import { turso } from '@/lib/core/turso';
import { writeAudit } from '@/lib/core/audit';
import { koreksiInvoice, voidInvoice } from '@/lib/invoice/edit';
import { kirimInvoice } from '@/lib/invoice';
import { fmtTanggal } from '@/lib/format-tanggal';
import { urlBerkas } from '@/lib/teman-rara';

/** Link Google Drive (/file/d/<id>/view, ?id=<id>) -> penyaji berkas Ops yang memeriksa sesi. */
function urlBerkasDrive(link: string): string | null {
  const m = link.match(/\/d\/([A-Za-z0-9_-]{10,120})/) ?? link.match(/[?&]id=([A-Za-z0-9_-]{10,120})/);
  return m ? `/api/ops/berkas/${m[1]}` : null;
}

const EDITOR = new Set(['owner', 'admin_finance']);
const ALLOWED = new Set(['owner', 'admin_finance', 'sales']);

async function requireAccess() {
  const user = await getSessionUser();
  if (!user) return { error: NextResponse.json({ error: 'Belum login.' }, { status: 401 }) };
  if (!ALLOWED.has(user.role)) {
    return { error: NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 }) };
  }
  return { user };
}

/** Daftar semua penghuni (aktif + alumni) dari occupancy_history. */
export async function GET(req: NextRequest) {
  const gate = await requireAccess();
  if (gate.error) return gate.error;

  const idPenghuni = req.nextUrl.searchParams.get('id');

  if (!idPenghuni) {
    // Daftar penghuni untuk dropdown
    const res = await turso().execute(
      `SELECT oh.id_penghuni, oh.nama, oh.no_kamar, oh.status,
              oh.tanggal_mulai, oh.tanggal_selesasi
       FROM occupancy_history oh
       ORDER BY oh.id_penghuni DESC`
    );
    const data = res.rows.map((r) => ({
      id: String(r.id_penghuni ?? ''),
      nama: String(r.nama ?? ''),
      noKamar: String(r.no_kamar ?? ''),
      status: String(r.status ?? ''),
      tanggalMulai: String(r.tanggal_mulai ?? ''),
      tanggalSelesai: String(r.tanggal_selesasi ?? '')
    }));
    return NextResponse.json({ ok: true, data });
  }

  // Riwayat invoice untuk satu penghuni
  const [sewas, dps] = await Promise.all([
    turso().execute({
      sql: `SELECT 'Sewa' AS jenis, id AS inv_id, no_inv, tanggal_pembayaran, periode_awal, periode_akhir,
                   no_kamar, tipe_kamar, grand_total, jumlah_bulan, email, jumlah_denda, denda, diskon, pajak,
                   CASE WHEN void_pada IS NOT NULL THEN 'Void' WHEN tanggal_pembayaran IS NOT NULL THEN 'Lunas' ELSE 'Belum Bayar' END AS status,
                   void_alasan, koreksi_dari
            FROM invoice_sewa
            WHERE id_penghuni = ?
            ORDER BY id DESC`,
      args: [idPenghuni]
    }),
    turso().execute({
      sql: `SELECT 'DP' AS jenis, id AS inv_id, no_inv, tanggal_pembayaran, tanggal_pembayaran AS periode_awal,
                   NULL AS periode_akhir, no_kamar, tipe_kamar, grand_total, NULL AS jumlah_bulan,
                   email, NULL AS jumlah_denda, NULL AS denda, diskon, pajak,
                   CASE WHEN void_pada IS NOT NULL THEN 'Void' WHEN tanggal_pembayaran IS NOT NULL THEN 'Lunas' ELSE 'Belum Bayar' END AS status,
                   void_alasan, koreksi_dari
            FROM invoice_dp
            WHERE id_penghuni = ?
            ORDER BY id DESC`,
      args: [idPenghuni]
    })
  ]);

  const rp = (n: unknown) =>
    n != null && n !== '' ? 'Rp' + Number(n).toLocaleString('id-ID') : '—';

  // Bukti transfer: (1) unggahan penghuni lewat Teman Rara (tr_payment_proof, terhubung ke invoice),
  // (2) lampiran yang diunggah admin saat mencatat pembayaran (tabel dokumen, dicocokkan lewat judul).
  const [proofs, dokumen] = await Promise.all([
    turso().execute({
      sql: `SELECT invoice_sewa_id, invoice_dp_id, file_url, file_type, verified_at, rejected_at
            FROM tr_payment_proof WHERE id_penghuni = ? ORDER BY created_at`,
      args: [idPenghuni]
    }),
    turso().execute({
      sql: `SELECT id_dokumen, judul, link_drive FROM dokumen WHERE judul LIKE 'Bukti Pembayaran%' AND judul LIKE ?`,
      args: [`%${idPenghuni}%`]
    })
  ]);

  const buktiDari = (jenis: string, invId: number, tanggal: string) => {
    const hasil: { label: string; url: string; tipe: string; idDokumen?: string }[] = [];
    for (const p of proofs.rows) {
      const cocok = jenis === 'Sewa' ? Number(p.invoice_sewa_id) === invId : Number(p.invoice_dp_id) === invId;
      const url = urlBerkas(String(p.file_url ?? ''));
      if (cocok && url) {
        const st = p.verified_at ? 'terverifikasi' : p.rejected_at ? 'ditolak' : 'menunggu verifikasi';
        hasil.push({ label: `Unggahan penghuni (${st})`, url, tipe: String(p.file_type ?? '') });
      }
    }
    for (const d of dokumen.rows) {
      const judul = String(d.judul ?? '');
      const url = urlBerkasDrive(String(d.link_drive ?? ''));
      const tglCocok = tanggal && (judul.includes(tanggal) || judul.includes(fmtTanggal(tanggal)));
      if (url && judul.includes(`Bukti Pembayaran ${jenis}`) && tglCocok) hasil.push({ label: 'Lampiran admin', url, tipe: '', idDokumen: String(d.id_dokumen) });
    }
    return hasil;
  };

  const rows = [...sewas.rows, ...dps.rows]
    .map((r) => ({
      bukti: buktiDari(String(r.jenis ?? ''), Number(r.inv_id), String(r.tanggal_pembayaran ?? '').slice(0, 10)),
      jenis: String(r.jenis ?? ''),
      noInv: String(r.no_inv ?? ''),
      tanggalBayar: String(r.tanggal_pembayaran ?? ''),
      periodeAwal: String(r.periode_awal ?? ''),
      periodeAkhir: String(r.periode_akhir ?? ''),
      noKamar: String(r.no_kamar ?? ''),
      tipeKamar: String(r.tipe_kamar ?? ''),
      jumlahBulan: r.jumlah_bulan != null ? Number(r.jumlah_bulan) : null,
      total: rp(r.grand_total),
      totalRaw: Number(r.grand_total ?? 0),
      status: String(r.status ?? ''),
      voidAlasan: r.void_alasan ? String(r.void_alasan) : '',
      koreksiDari: r.koreksi_dari ? String(r.koreksi_dari) : '',
      email: String(r.email ?? ''),
      jumlahDenda: Number(r.jumlah_denda ?? 0),
      dendaPerUnit: Number(r.denda ?? 0),
      diskon: Number(r.diskon ?? 0),
      pajak: Number(r.pajak ?? 0)
    }))
    .sort((a, b) => {
      const da = a.tanggalBayar || a.periodeAwal || '0000-00-00';
      const db2 = b.tanggalBayar || b.periodeAwal || '0000-00-00';
      return db2 < da ? -1 : db2 > da ? 1 : 0;
    });

  const totalLunas = rows
    .filter((r) => r.status === 'Lunas')
    .reduce((s, r) => s + r.totalRaw, 0);

  return NextResponse.json({ ok: true, rows, totalLunas: rp(totalLunas), bolehEdit: EDITOR.has(gate.user!.role) });
}

/** Koreksi: invoice lama di-void (+ jurnal dibalik), invoice baru bernomor -K<n> dibuat dan dikirim (REVISI). */
export async function PATCH(req: NextRequest) {
  const gate = await requireAccess();
  if (gate.error) return gate.error;
  const user = gate.user!;
  if (!EDITOR.has(user.role)) return NextResponse.json({ error: 'Hanya owner dan admin yang boleh mengedit pembayaran.' }, { status: 403 });
  const t0 = Date.now();

  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body bukan JSON yang valid.' }, { status: 400 });
  }
  const jenis = b.jenis === 'DP' ? 'DP' : b.jenis === 'Sewa' ? 'Sewa' : null;
  const noInv = String(b.noInv ?? '').trim();
  if (!jenis || !noInv) return NextResponse.json({ error: 'Invoice tidak valid.' }, { status: 400 });

  try {
    const hasil = await koreksiInvoice({
      oleh: user.username,
      noInv,
      jenis,
      email: String(b.email ?? ''),
      tanggalBayar: String(b.tanggalBayar ?? ''),
      periodeAwal: String(b.periodeAwal ?? ''),
      jumlahBulan: Number(b.jumlahBulan),
      jumlahDenda: Number(b.jumlahDenda),
      dendaPerUnit: Number(b.dendaPerUnit),
      diskon: Number(b.diskon),
      pajak: Number(b.pajak),
      akunKasBank: String(b.akunKasBank ?? '')
    });

    // Email dikirim setelah data tersimpan; gagal kirim tidak membatalkan edit.
    const email = await kirimInvoice(hasil.noInvBaru, jenis, { revisi: true });

    await writeAudit({
      requestId: `edit-inv-${noInv}-${Date.now()}`,
      user,
      moduleId: 'riwayat-pembayaran',
      action: 'UPDATE',
      target: `Turso → ${jenis === 'Sewa' ? 'invoice_sewa' : 'invoice_dp'}, payment, jurnal_transaksi (koreksi ${noInv} -> ${hasil.noInvBaru})`,
      oldData: hasil.sebelum,
      newData: hasil.sesudah,
      durationSec: (Date.now() - t0) / 1000,
      status: 'sukses'
    });

    return NextResponse.json({ ok: true, pesan: email.pesan, noInvBaru: hasil.noInvBaru, terkirim: email.terkirim });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Gagal menyimpan perubahan.' }, { status: 400 });
  }
}

/** Void: invoice dibatalkan, payment Cancelled, semua baris jurnalnya dibalik. Tidak ada pengganti. */
export async function POST(req: NextRequest) {
  const gate = await requireAccess();
  if (gate.error) return gate.error;
  const user = gate.user!;
  if (!EDITOR.has(user.role)) return NextResponse.json({ error: 'Hanya owner dan admin yang boleh mem-void pembayaran.' }, { status: 403 });
  const t0 = Date.now();

  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body bukan JSON yang valid.' }, { status: 400 });
  }
  const jenis = b.jenis === 'DP' ? 'DP' : b.jenis === 'Sewa' ? 'Sewa' : null;
  const noInv = String(b.noInv ?? '').trim();
  if (!jenis || !noInv) return NextResponse.json({ error: 'Invoice tidak valid.' }, { status: 400 });

  try {
    const hasil = await voidInvoice({ noInv, jenis, alasan: String(b.alasan ?? ''), oleh: user.username });
    await writeAudit({
      requestId: `void-inv-${noInv}-${Date.now()}`,
      user,
      moduleId: 'riwayat-pembayaran',
      action: 'UPDATE',
      target: `Turso → ${jenis === 'Sewa' ? 'invoice_sewa' : 'invoice_dp'}, payment, jurnal_transaksi (void ${noInv})`,
      oldData: hasil.sebelum,
      newData: { void: true, alasan: b.alasan },
      durationSec: (Date.now() - t0) / 1000,
      status: 'sukses'
    });
    // Penghuni sudah memegang PDF invoice lama, jadi kirim ulang salinan bercap DIBATALKAN (best-effort).
    const email = await kirimInvoice(noInv, jenis, { batal: { alasan: String(b.alasan ?? '').trim() } });
    return NextResponse.json({
      ok: true,
      pesan: `Invoice ${noInv} di-void dan jurnalnya dibalik. ${email.pesan}`,
      terkirim: email.terkirim
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Gagal mem-void pembayaran.' }, { status: 400 });
  }
}
