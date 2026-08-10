import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/core/auth';
import { turso } from '@/lib/core/turso';

const ALLOWED = new Set(['owner', 'staff_admin', 'staff_sales']);

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
      sql: `SELECT 'Sewa' AS jenis, no_inv, tanggal_pembayaran, periode_awal, periode_akhir,
                   no_kamar, tipe_kamar, grand_total, jumlah_bulan,
                   CASE WHEN tanggal_pembayaran IS NOT NULL THEN 'Lunas' ELSE 'Belum Bayar' END AS status
            FROM invoice_sewa
            WHERE id_penghuni = ?
            ORDER BY id DESC`,
      args: [idPenghuni]
    }),
    turso().execute({
      sql: `SELECT 'DP' AS jenis, no_inv, tanggal_pembayaran, tanggal_pembayaran AS periode_awal,
                   NULL AS periode_akhir, no_kamar, tipe_kamar, grand_total, NULL AS jumlah_bulan,
                   CASE WHEN tanggal_pembayaran IS NOT NULL THEN 'Lunas' ELSE 'Belum Bayar' END AS status
            FROM invoice_dp
            WHERE id_penghuni = ?
            ORDER BY id DESC`,
      args: [idPenghuni]
    })
  ]);

  const rp = (n: unknown) =>
    n != null && n !== '' ? 'Rp' + Number(n).toLocaleString('id-ID') : '—';

  const rows = [...sewas.rows, ...dps.rows]
    .map((r) => ({
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
      status: String(r.status ?? '')
    }))
    .sort((a, b) => {
      const da = a.tanggalBayar || a.periodeAwal || '0000-00-00';
      const db2 = b.tanggalBayar || b.periodeAwal || '0000-00-00';
      return db2 < da ? -1 : db2 > da ? 1 : 0;
    });

  const totalLunas = rows
    .filter((r) => r.status === 'Lunas')
    .reduce((s, r) => s + r.totalRaw, 0);

  return NextResponse.json({ ok: true, rows, totalLunas: rp(totalLunas) });
}
