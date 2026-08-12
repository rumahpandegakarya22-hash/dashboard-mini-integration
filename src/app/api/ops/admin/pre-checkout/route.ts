import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/core/auth';
import { turso } from '@/lib/core/turso';

const ALLOWED_ROLES = ['owner', 'staff_admin', 'staff_inspeksi'] as const;

function canAccess(role: string): boolean {
  return (ALLOWED_ROLES as readonly string[]).includes(role);
}

const ITEM_COLS_AKHIR = Array.from({ length: 26 }, (_, i) => `item${String(i + 1).padStart(2, '0')}_akhir`);

export async function GET() {
  const user = await getSessionUser();
  if (!user || !canAccess(user.role)) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
  }

  const itemSelect = ITEM_COLS_AKHIR.map((c) => `kk.${c}`).join(', ');

  const result = await turso().execute({
    sql: `SELECT at.kamar_id, at.no_kamar, at.nama_lengkap, at.no_hp, at.id_penghuni,
                 kk.id as kk_id, kk.status_checkout,
                 ${itemSelect},
                 kk.catatan_akhir, kk.tanggal_cek_akhir
          FROM active_tenant at
          LEFT JOIN kondisi_kamar kk ON kk.id_penghuni = at.id_penghuni
          WHERE kk.status_checkout IS NULL OR kk.status_checkout = 'Draft'
          ORDER BY at.no_kamar ASC`,
    args: [],
  });

  return NextResponse.json({ data: result.rows });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user || !canAccess(user.role)) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
  }

  const VALID_KONDISI = new Set(['Baik', 'Perlu Perbaikan', 'Rusak', 'N/A']);

  type ItemKey = `item${string}`;
  const body = await req.json() as {
    kk_id?: number | null;
    id_penghuni?: string;
    no_kamar?: number | string;
    nama_penghuni?: string;
    items: Record<ItemKey, string>;
    catatan_akhir: string;
    tanggal_cek_akhir: string;
    pic: string;
    item_fotos?: { item_no: number; url: string }[];
  };

  const { kk_id, id_penghuni, no_kamar, nama_penghuni, items, catatan_akhir, tanggal_cek_akhir, pic, item_fotos } = body;

  for (const val of Object.values(items)) {
    if (!VALID_KONDISI.has(val)) {
      return NextResponse.json({ error: 'Nilai item kondisi tidak valid.' }, { status: 400 });
    }
  }

  const itemArgs = ITEM_COLS_AKHIR.map((col) => {
    const key = col.replace('_akhir', '') as ItemKey;
    return items[key] ?? 'Baik';
  });

  let kondisiKamarId: number;
  if (kk_id != null) {
    const res = await turso().execute({
      sql: `UPDATE kondisi_kamar SET
              ${ITEM_COLS_AKHIR.map((c) => `${c}=?`).join(', ')},
              catatan_akhir=?, tanggal_cek_akhir=?, pic=?,
              status_checkout='Menunggu', updated_at=CURRENT_TIMESTAMP
            WHERE id=? AND status_checkout NOT IN ('Menunggu','Disetujui')`,
      args: [...itemArgs, catatan_akhir, tanggal_cek_akhir, pic, kk_id],
    });
    if (res.rowsAffected === 0) {
      return NextResponse.json({ error: 'Sudah diajukan atau disetujui' }, { status: 409 });
    }
    kondisiKamarId = kk_id;
  } else {
    if (!id_penghuni || !no_kamar || !nama_penghuni) {
      return NextResponse.json({ error: 'id_penghuni, no_kamar, dan nama_penghuni wajib untuk penghuni tanpa data kondisi.' }, { status: 400 });
    }
    const id_kamar = `KTD-${no_kamar}`;
    const res = await turso().execute({
      sql: `INSERT INTO kondisi_kamar
              (id_kamar, no_kamar, id_penghuni, nama_penghuni,
               ${ITEM_COLS_AKHIR.join(', ')},
               catatan_akhir, tanggal_cek_akhir, pic, status_checkin, status_checkout, created_at, updated_at)
            VALUES (?, ?, ?, ?, ${ITEM_COLS_AKHIR.map(() => '?').join(', ')}, ?, ?, ?, 'Disetujui', 'Menunggu', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      args: [id_kamar, no_kamar, id_penghuni, nama_penghuni, ...itemArgs, catatan_akhir, tanggal_cek_akhir, pic],
    });
    kondisiKamarId = Number(res.lastInsertRowid);
  }

  // Foto per-item (fase akhir). Hapus foto akhir per-item lama supaya tidak dobel saat re-submit.
  if (item_fotos && item_fotos.length > 0) {
    await turso().execute({
      sql: `DELETE FROM kondisi_kamar_foto WHERE kondisi_kamar_id=? AND fase='akhir' AND item_no IS NOT NULL`,
      args: [kondisiKamarId],
    });
    for (const f of item_fotos) {
      if (!f?.url || !(f.item_no >= 1 && f.item_no <= 26)) continue;
      await turso().execute({
        sql: `INSERT INTO kondisi_kamar_foto (kondisi_kamar_id, fase, item_no, url, created_at)
              VALUES (?, 'akhir', ?, ?, CURRENT_TIMESTAMP)`,
        args: [kondisiKamarId, f.item_no, f.url],
      });
    }
  }

  return NextResponse.json({ ok: true, id: kondisiKamarId });
}
