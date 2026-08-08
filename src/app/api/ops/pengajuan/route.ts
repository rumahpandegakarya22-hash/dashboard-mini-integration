import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/core/auth';
import { canAccess, type Role } from '@/lib/core/roles';
import { turso } from '@/lib/core/turso';
import { writeAudit } from '@/lib/core/audit';
import { getPenghuniByIds, labelPenghuni } from '@/lib/teman-rara';
import { submitPindahKamar } from '@/lib/modules/handlers/pindah-kamar';

/* Panel pengelola untuk pengajuan Pindah Kamar & Checkout dari aplikasi penghuni
   Teman Rara. Alur (disepakati 8 Agt 2026, lihat docs/RENCANA-PINDAH-CHECKOUT.md):

     Menunggu  → pengajuan masuk
     Disetujui → "On Process", DATA BELUM BERUBAH
     Selesai   → data berubah final
     Ditolak   → pengajuan ditolak, disertai alasan

   Pindah kamar diselesaikan DI SINI (memanggil submitPindahKamar yang sudah
   teruji). Checkout TIDAK: penyelesaiannya lewat modul Checkout yang sudah ada
   supaya deposit/kondisi kamar/tunggakan diisi di formnya — panel hanya
   mengarahkan ke sana, dan modul itu yang menandai pengajuan jadi 'Selesai'. */

const JENIS = {
  pindah: { tabel: 'tr_pindah_request', modul: 'pindah-kamar' },
  checkout: { tabel: 'tr_checkout_request', modul: 'checkout' }
} as const;
type Jenis = keyof typeof JENIS;

// Panel menempel di modul yang sama; akses ikut modul itu.
function boleh(role: Role, jenis: Jenis): boolean {
  return canAccess(role, JENIS[jenis].modul);
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Belum login.' }, { status: 401 });

  const jenis = String(req.nextUrl.searchParams.get('jenis') ?? '') as Jenis;
  if (!(jenis in JENIS)) return NextResponse.json({ error: 'Jenis tidak dikenal.' }, { status: 400 });
  if (!boleh(user.role, jenis)) return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });

  const semua = req.nextUrl.searchParams.get('filter') === 'semua';
  // Antrean kerja = yang masih perlu tindakan (Menunggu + Disetujui/On Process).
  const filter = semua ? '' : "WHERE status IN ('Menunggu', 'Disetujui')";
  const res = await turso().execute(
    jenis === 'pindah'
      ? `SELECT id, id_penghuni, no_kamar_lama, no_kamar_baru, tanggal, alasan, catatan, status, response_note, created_at
         FROM tr_pindah_request ${filter} ORDER BY created_at DESC LIMIT 100`
      : `SELECT id, id_penghuni, no_kamar, tanggal_checkout AS tanggal, alasan, catatan, status, response_note, created_at
         FROM tr_checkout_request ${filter} ORDER BY created_at DESC LIMIT 100`
  );

  const ids = res.rows.map((r) => String(r.id_penghuni));
  const nama = await getPenghuniByIds(ids);
  /* Label penghuni dalam format PERSIS master 'tenants' ("id — nama") supaya
     link "Lanjut ke Checkout" bisa memilih penghuni di dropdown modul Checkout.
     Diambil dari active_tenant, bukan nama Teman Rara, karena dropdown itu juga
     bersumber dari active_tenant. */
  const labelTenant = new Map<string, string>();
  if (ids.length) {
    const at = await turso().execute(
      `SELECT COALESCE(id_penghuni, kamar_id) id, nama_lengkap FROM active_tenant
       WHERE COALESCE(id_penghuni, kamar_id) IN (${ids.map(() => '?').join(',')})`,
      ids
    );
    for (const r of at.rows) labelTenant.set(String(r.id), `${String(r.id)} — ${String(r.nama_lengkap ?? '')}`);
  }
  const data = res.rows.map((r) => ({
    id: String(r.id),
    penghuni: labelPenghuni(nama.get(String(r.id_penghuni)), String(r.id_penghuni)),
    idPenghuni: String(r.id_penghuni),
    kamarLama: jenis === 'pindah' ? String(r.no_kamar_lama) : String(r.no_kamar),
    kamarBaru: jenis === 'pindah' ? String(r.no_kamar_baru) : null,
    tanggal: String(r.tanggal ?? '').slice(0, 10),
    alasan: String(r.alasan ?? ''),
    catatan: String(r.catatan ?? ''),
    status: String(r.status ?? ''),
    penghuniLabel: labelTenant.get(String(r.id_penghuni)) ?? '',
    responseNote: r.response_note ? String(r.response_note) : null
  }));
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Belum login.' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const jenis = String(body.jenis ?? '') as Jenis;
  const id = String(body.id ?? '').trim();
  const aksi = String(body.aksi ?? '').trim(); // 'setuju' | 'tolak' | 'selesai'
  const alasan = String(body.alasan ?? '').trim();
  if (!(jenis in JENIS)) return NextResponse.json({ error: 'Jenis tidak dikenal.' }, { status: 400 });
  if (!boleh(user.role, jenis)) return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
  if (!id) return NextResponse.json({ error: 'ID pengajuan wajib.' }, { status: 400 });
  if (aksi === 'tolak' && alasan.length < 5) {
    return NextResponse.json({ error: 'Alasan penolakan wajib diisi (minimal 5 karakter).' }, { status: 400 });
  }

  const db = turso();
  const tabel = JENIS[jenis].tabel;
  const sebelum = await db.execute({ sql: `SELECT * FROM ${tabel} WHERE id = ?`, args: [id] });
  if (sebelum.rows.length === 0) return NextResponse.json({ error: 'Pengajuan tidak ditemukan.' }, { status: 404 });
  const row = sebelum.rows[0] as any;
  const statusLama = String(row.status ?? '');

  let peringatan: string | undefined;
  let statusBaru: string;

  if (aksi === 'setuju') {
    if (statusLama !== 'Menunggu') return NextResponse.json({ error: `Pengajuan sudah ${statusLama}.` }, { status: 409 });
    statusBaru = 'Disetujui'; // = "On Process", data belum berubah
  } else if (aksi === 'tolak') {
    if (statusLama === 'Selesai') return NextResponse.json({ error: 'Pengajuan sudah selesai, tidak bisa ditolak.' }, { status: 409 });
    statusBaru = 'Ditolak';
  } else if (aksi === 'selesai') {
    if (jenis !== 'pindah') {
      return NextResponse.json({ error: 'Checkout diselesaikan lewat modul Checkout, bukan dari sini.' }, { status: 400 });
    }
    if (statusLama !== 'Disetujui') return NextResponse.json({ error: 'Setujui dulu sebelum menyelesaikan.' }, { status: 409 });

    // Eksekusi perpindahan lewat handler yang sudah teruji — tidak menduplikasi
    // SQL pindah kamar. Tarif kamar baru otomatis berlaku periode berikutnya
    // (harga dibaca dari kamar yang ditempati), jadi tidak menyentuh invoice.
    const hasil = await submitPindahKamar(
      {
        penghuni: String(row.id_penghuni),
        kamarBaru: String(row.no_kamar_baru),
        tanggal: String(row.tanggal ?? new Date().toISOString().slice(0, 10)),
        alasan: String(row.alasan ?? 'Pengajuan penghuni'),
        notes: String(row.catatan ?? '')
      },
      { user, requestId: `pindah-req-${id}-${Date.now()}` }
    ).catch((e: any) => {
      throw new Error(`Perpindahan gagal dieksekusi: ${e?.message || 'unknown error'}`);
    });
    peringatan = hasil.warning;
    statusBaru = 'Selesai';
  } else {
    return NextResponse.json({ error: 'Aksi tidak dikenal.' }, { status: 400 });
  }

  await db.execute({
    sql: `UPDATE ${tabel} SET status = ?, response_note = ?, processed_by = ?, processed_at = CURRENT_TIMESTAMP WHERE id = ?`,
    args: [statusBaru, aksi === 'tolak' ? alasan : row.response_note ?? null, user.username, id]
  });

  await writeAudit({
    requestId: `pengajuan-${jenis}-${id}-${Date.now()}`,
    user,
    moduleId: `pengajuan-${jenis}`,
    action: 'UPDATE',
    target: `Turso → ${tabel} (${id})`,
    oldData: { status: statusLama },
    newData: { status: statusBaru, aksi },
    durationSec: (Date.now() - t0) / 1000,
    status: 'sukses'
  });

  return NextResponse.json({ ok: true, id, status: statusBaru, peringatan });
}
