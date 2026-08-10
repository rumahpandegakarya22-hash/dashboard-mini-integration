import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/core/auth';
import { turso } from '@/lib/core/turso';
import { redis, nsKey } from '@/lib/core/redis';
import { DURASI_TIER } from '@/lib/master';
import { writeAudit } from '@/lib/core/audit';

/**
 * Kelola Harga Kamar (Owner) — sumber tunggal tarif sewa & DP.
 *
 * Harga disimpan per BARIS kamar di tabel `kamar`, tapi diedit per TIPE dan
 * ditulis ke SEMUA kamar bertipe sama. Alasannya: master invoice
 * (fetchInvoiceSewaMasterUncached) mengambil tarif dari baris PERTAMA tiap tipe,
 * jadi kalau antar-kamar setipe boleh beda harga, angka invoice jadi bergantung
 * urutan baris — bug diam-diam. Menulis serempak per tipe menjaganya konsisten.
 *
 * DP TIDAK disimpan: selalu 50% dari harga 1 bulan, dihitung saat preview
 * pembayaran (pembayaran-sewa-preview.ts).
 */

const TIER_COLUMNS = DURASI_TIER.map((d) => d.kolom);

async function requireOwner() {
  const user = await getSessionUser();
  if (!user) return { error: NextResponse.json({ error: 'Belum login.' }, { status: 401 }) };
  if (user.role !== 'owner') {
    return { error: NextResponse.json({ error: 'Hanya Owner yang bisa mengubah harga kamar.' }, { status: 403 }) };
  }
  return { user };
}

export async function GET() {
  const gate = await requireOwner();
  if (gate.error) return gate.error;

  const res = await turso().execute(
    `SELECT tipe_kamar,
            COUNT(*) AS jumlah_kamar,
            MIN(harga_bulan) AS harga_bulan,
            MIN(harga_2bulan) AS harga_2bulan,
            MIN(harga_3bulan) AS harga_3bulan,
            MIN(harga_6bulan) AS harga_6bulan,
            MIN(harga_9bulan) AS harga_9bulan,
            MIN(harga_tahun) AS harga_tahun,
            COUNT(DISTINCT harga_bulan) AS variasi_harga
     FROM kamar
     WHERE COALESCE(tipe_kamar, '') != ''
     GROUP BY tipe_kamar
     ORDER BY harga_bulan`
  );

  const data = res.rows.map((r) => {
    const hargaBulan = Number(r.harga_bulan ?? 0);
    return {
      tipe: String(r.tipe_kamar),
      jumlahKamar: Number(r.jumlah_kamar ?? 0),
      tidakSeragam: Number(r.variasi_harga ?? 1) > 1,
      hargaBulan,
      harga2bulan: Number(r.harga_2bulan ?? 0),
      harga3bulan: Number(r.harga_3bulan ?? 0),
      harga6bulan: Number(r.harga_6bulan ?? 0),
      harga9bulan: Number(r.harga_9bulan ?? 0),
      hargaTahun: Number(r.harga_tahun ?? 0),
      dp: Math.round(hargaBulan / 2)
    };
  });

  return NextResponse.json({ ok: true, data });
}

export async function PATCH(req: NextRequest) {
  const gate = await requireOwner();
  if (gate.error) return gate.error;
  const user = gate.user!;
  const t0 = Date.now();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body bukan JSON yang valid.' }, { status: 400 });
  }

  const tipe = String(body.tipe ?? '').trim();
  if (!tipe) return NextResponse.json({ error: 'Tipe kamar wajib diisi.' }, { status: 400 });

  // Validasi semua tarif sebelum menulis apa pun — jangan sampai separuh tersimpan.
  const nilai: Record<string, number> = {};
  for (const { bulan, kolom } of DURASI_TIER) {
    const raw = body[kolom];
    const n = Math.round(Number(raw));
    if (!Number.isFinite(n) || n < 0) {
      return NextResponse.json({ error: `Tarif ${bulan} bulan tidak valid.` }, { status: 400 });
    }
    if (n > 1_000_000_000) {
      return NextResponse.json({ error: `Tarif ${bulan} bulan tidak masuk akal (terlalu besar).` }, { status: 400 });
    }
    nilai[kolom] = n;
  }
  if (nilai.harga_bulan <= 0) {
    return NextResponse.json({ error: 'Tarif 1 bulan harus lebih dari 0 (dipakai menghitung DP).' }, { status: 400 });
  }

  const sebelum = await turso().execute({
    sql: `SELECT ${TIER_COLUMNS.join(', ')} FROM kamar WHERE tipe_kamar = ? LIMIT 1`,
    args: [tipe]
  });
  if (sebelum.rows.length === 0) {
    return NextResponse.json({ error: `Tipe kamar "${tipe}" tidak ditemukan.` }, { status: 404 });
  }

  const res = await turso().execute({
    sql: `UPDATE kamar SET ${TIER_COLUMNS.map((c) => `${c} = ?`).join(', ')} WHERE tipe_kamar = ?`,
    args: [...TIER_COLUMNS.map((c) => nilai[c]), tipe]
  });

  // Master di-cache 5 menit — tanpa dibersihkan, harga baru tidak langsung
  // terpakai di dropdown & preview invoice.
  await Promise.all([
    redis.del(nsKey('master:rooms')),
    redis.del(nsKey('master:invoice-sewa')),
    redis.del(nsKey('master:invoice-dp'))
  ]);

  await writeAudit({
    requestId: `harga-${Date.now()}`,
    user,
    moduleId: 'kelola-harga-kamar',
    action: 'UPDATE',
    target: `Turso → kamar (tipe ${tipe})`,
    oldData: sebelum.rows[0],
    newData: nilai,
    durationSec: (Date.now() - t0) / 1000,
    status: 'sukses'
  });

  return NextResponse.json({
    ok: true,
    tipe,
    kamarTerdampak: res.rowsAffected,
    dp: Math.round(nilai.harga_bulan / 2)
  });
}
