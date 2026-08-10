import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/core/auth';
import { turso } from '@/lib/core/turso';
import { writeAudit } from '@/lib/core/audit';

async function requireAccess() {
  const user = await getSessionUser();
  if (!user) return { error: NextResponse.json({ error: 'Belum login.' }, { status: 401 }) };
  if (user.role !== 'owner' && user.role !== 'staff_admin') {
    return { error: NextResponse.json({ error: 'Hanya Owner dan Admin yang bisa mengubah data penghuni.' }, { status: 403 }) };
  }
  return { user };
}

export async function GET() {
  const gate = await requireAccess();
  if (gate.error) return gate.error;

  const res = await turso().execute(
    `SELECT kamar_id, id_penghuni, no_kamar, nama_lengkap, nama_panggilan, email,
            no_hp, pekerjaan, instansi, tanggal_lahir, asal_daerah, tanggal_masuk,
            nomor_darurat_1, hubungan_kontak_darurat_1, nama_kontak_darurat_1,
            nomor_darurat_2, hubungan_kontak_darurat_2, nama_kontak_darurat_2,
            link_identitas, tambahan_listrik
     FROM active_tenant
     ORDER BY CAST(no_kamar AS INTEGER)`
  );

  const data = res.rows.map((r) => ({
    kamarId: String(r.kamar_id ?? ''),
    idPenghuni: String(r.id_penghuni ?? ''),
    noKamar: String(r.no_kamar ?? ''),
    namaLengkap: String(r.nama_lengkap ?? ''),
    namaPanggilan: String(r.nama_panggilan ?? ''),
    email: String(r.email ?? ''),
    noHp: String(r.no_hp ?? ''),
    pekerjaan: String(r.pekerjaan ?? ''),
    instansi: String(r.instansi ?? ''),
    tanggalLahir: String(r.tanggal_lahir ?? ''),
    asalDaerah: String(r.asal_daerah ?? ''),
    tanggalMasuk: String(r.tanggal_masuk ?? ''),
    nomorDarurat1: String(r.nomor_darurat_1 ?? ''),
    hubunganDarurat1: String(r.hubungan_kontak_darurat_1 ?? ''),
    namaDarurat1: String(r.nama_kontak_darurat_1 ?? ''),
    nomorDarurat2: String(r.nomor_darurat_2 ?? ''),
    hubunganDarurat2: String(r.hubungan_kontak_darurat_2 ?? ''),
    namaDarurat2: String(r.nama_kontak_darurat_2 ?? ''),
    linkIdentitas: String(r.link_identitas ?? ''),
    tambahanListrik: Number(r.tambahan_listrik ?? 0)
  }));

  return NextResponse.json({ ok: true, data });
}

const EDITABLE_COLS: Record<string, { col: string; numeric?: boolean }> = {
  namaLengkap: { col: 'nama_lengkap' },
  namaPanggilan: { col: 'nama_panggilan' },
  email: { col: 'email' },
  noHp: { col: 'no_hp' },
  pekerjaan: { col: 'pekerjaan' },
  instansi: { col: 'instansi' },
  tanggalLahir: { col: 'tanggal_lahir' },
  asalDaerah: { col: 'asal_daerah' },
  tanggalMasuk: { col: 'tanggal_masuk' },
  nomorDarurat1: { col: 'nomor_darurat_1' },
  hubunganDarurat1: { col: 'hubungan_kontak_darurat_1' },
  namaDarurat1: { col: 'nama_kontak_darurat_1' },
  nomorDarurat2: { col: 'nomor_darurat_2' },
  hubunganDarurat2: { col: 'hubungan_kontak_darurat_2' },
  namaDarurat2: { col: 'nama_kontak_darurat_2' },
  linkIdentitas: { col: 'link_identitas' },
  tambahanListrik: { col: 'tambahan_listrik', numeric: true }
};

export async function PUT(req: NextRequest) {
  const gate = await requireAccess();
  if (gate.error) return gate.error;
  const user = gate.user!;
  const t0 = Date.now();

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Body bukan JSON.' }, { status: 400 });
  }

  const kamarId = String(body.kamarId ?? '').trim();
  if (!kamarId) return NextResponse.json({ error: 'kamarId wajib diisi.' }, { status: 400 });

  const sebelum = await turso().execute({
    sql: 'SELECT * FROM active_tenant WHERE kamar_id = ? LIMIT 1',
    args: [kamarId]
  });
  if (!sebelum.rows.length) {
    return NextResponse.json({ error: `Penghuni di kamar ${kamarId} tidak ditemukan.` }, { status: 404 });
  }

  const set: string[] = [];
  const args: (string | number | null)[] = [];
  for (const [field, { col, numeric }] of Object.entries(EDITABLE_COLS)) {
    if (field in body) {
      set.push(`${col} = ?`);
      const raw = body[field];
      if (numeric) {
        args.push(raw === '' || raw === null ? null : Number(raw));
      } else {
        args.push(raw === '' || raw === null ? null : String(raw));
      }
    }
  }
  if (!set.length) return NextResponse.json({ error: 'Tidak ada field yang diubah.' }, { status: 400 });

  set.push('updated_at = CURRENT_TIMESTAMP');
  args.push(kamarId);

  await turso().execute({
    sql: `UPDATE active_tenant SET ${set.join(', ')} WHERE kamar_id = ?`,
    args
  });

  await writeAudit({
    requestId: `penghuni-${Date.now()}`,
    user,
    moduleId: 'ubah-data-penghuni',
    action: 'UPDATE',
    target: `active_tenant (kamar_id=${kamarId})`,
    oldData: sebelum.rows[0],
    newData: body,
    durationSec: (Date.now() - t0) / 1000,
    status: 'sukses'
  });

  return NextResponse.json({ ok: true });
}
