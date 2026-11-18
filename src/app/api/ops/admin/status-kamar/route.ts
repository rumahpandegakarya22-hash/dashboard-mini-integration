import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/core/auth';
import { turso } from '@/lib/core/turso';
import { writeAudit } from '@/lib/core/audit';
import { normalizeRoomId } from '@/lib/core/validate';
import { bukaMaintenanceKamar, pastikanSkema, selaraskanSemuaKamar, tutupMaintenanceDiKamar } from '@/lib/kamar-maintenance';

/**
 * Status Kamar: daftar kamar + tombol manual Maintenance.
 *
 * Kamar Maintenance selama ada pemicu terbuka (tombol ini, pengaduan Teman Rara, inspeksi
 * checkout, atau work order Maintenance). "Selesai" di sini menutup SEMUA pemicu kamar itu
 * (override); pemicu otomatis biasanya menutup dirinya sendiri.
 */

const BOLEH = ['owner', 'admin_finance', 'operasional'];

async function gate() {
  const user = await getSessionUser();
  if (!user) return { error: NextResponse.json({ error: 'Belum login.' }, { status: 401 }) };
  if (!BOLEH.includes(user.role)) {
    return { error: NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 }) };
  }
  return { user };
}

export async function GET() {
  const g = await gate();
  if (g.error) return g.error;

  await pastikanSkema();
  const [kamar, pemicu] = await Promise.all([
    turso().execute(
      `SELECT k.no_kamar, k.tipe_kamar, k.status,
              (SELECT at.nama_lengkap FROM active_tenant at WHERE CAST(at.no_kamar AS INTEGER) = k.no_kamar LIMIT 1) AS penghuni
       FROM kamar k ORDER BY k.no_kamar`
    ),
    turso().execute(
      `SELECT no_kamar, sumber, ref, alasan, dibuka_oleh, dibuka_pada
       FROM kamar_maintenance WHERE ditutup_pada IS NULL ORDER BY dibuka_pada`
    )
  ]);

  const perKamar = new Map<string, { sumber: string; ref: string; alasan: string; oleh: string; sejak: string }[]>();
  for (const r of pemicu.rows) {
    const k = String(r.no_kamar);
    perKamar.set(k, [
      ...(perKamar.get(k) ?? []),
      {
        sumber: String(r.sumber),
        ref: String(r.ref ?? ''),
        alasan: String(r.alasan ?? ''),
        oleh: String(r.dibuka_oleh ?? ''),
        sejak: String(r.dibuka_pada ?? '').slice(0, 10)
      }
    ]);
  }

  return NextResponse.json({
    ok: true,
    data: kamar.rows.map((r) => ({
      no: String(r.no_kamar),
      tipe: String(r.tipe_kamar ?? ''),
      status: String(r.status ?? ''),
      penghuni: r.penghuni ? String(r.penghuni) : '',
      pemicu: perKamar.get(String(r.no_kamar)) ?? []
    }))
  });
}

export async function POST(req: NextRequest) {
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

  // Selaraskan semua kamar dengan keadaan sebenarnya (data lama). 'pratinjau-semua' hanya menghitung.
  if (body.aksi === 'pratinjau-semua' || body.aksi === 'selaraskan-semua') {
    if (user.role === 'operasional') {
      return NextResponse.json({ error: 'Hanya Owner dan Admin and Finance yang bisa menyelaraskan semua kamar.' }, { status: 403 });
    }
    try {
      const tulis = body.aksi === 'selaraskan-semua';
      const hasil = await selaraskanSemuaKamar(tulis);
      if (tulis) {
        await writeAudit({
          requestId: `status-kamar-semua-${Date.now()}`,
          user,
          moduleId: 'status-kamar',
          action: 'UPDATE',
          target: 'Turso → kamar (semua)',
          newData: hasil,
          durationSec: (Date.now() - t0) / 1000,
          status: 'sukses'
        });
      }
      return NextResponse.json({ ok: true, ...hasil });
    } catch (e) {
      console.error('[status-kamar] gagal selaraskan semua:', e instanceof Error ? e.message : e);
      return NextResponse.json({ error: 'Gagal menyelaraskan status kamar.' }, { status: 500 });
    }
  }

  let noKamar: string;
  try {
    noKamar = normalizeRoomId(String(body.no_kamar ?? ''));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Nomor kamar tidak valid.' }, { status: 400 });
  }
  const aksi = String(body.aksi ?? '');
  const alasan = String(body.alasan ?? '').trim();

  if (aksi !== 'mulai' && aksi !== 'selesai') {
    return NextResponse.json({ error: 'Aksi tidak dikenal.' }, { status: 400 });
  }
  if (aksi === 'mulai' && (!alasan || alasan.length > 200)) {
    return NextResponse.json({ error: 'Alasan wajib diisi (maksimal 200 karakter).' }, { status: 400 });
  }

  const sebelum = await turso().execute({ sql: 'SELECT status FROM kamar WHERE CAST(no_kamar AS TEXT) = ?', args: [noKamar] });
  if (!sebelum.rows.length) return NextResponse.json({ error: `Kamar ${noKamar} tidak ditemukan.` }, { status: 404 });

  try {
    const status =
      aksi === 'mulai'
        ? await bukaMaintenanceKamar({ noKamar, sumber: 'manual', alasan, oleh: user.username })
        : await tutupMaintenanceDiKamar({ noKamar, oleh: user.username });

    await writeAudit({
      requestId: `status-kamar-${noKamar}-${Date.now()}`,
      user,
      moduleId: 'status-kamar',
      action: 'UPDATE',
      target: `Turso → kamar (${noKamar})`,
      oldData: { status: String(sebelum.rows[0].status ?? '') },
      newData: { status, aksi, alasan: alasan || undefined },
      durationSec: (Date.now() - t0) / 1000,
      status: 'sukses'
    });
    return NextResponse.json({ ok: true, no: noKamar, status });
  } catch (e) {
    console.error('[status-kamar] gagal:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Gagal mengubah status kamar.' }, { status: 500 });
  }
}
