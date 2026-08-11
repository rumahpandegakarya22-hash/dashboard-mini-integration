import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/core/auth';
import { turso } from '@/lib/core/turso';

const ALLOWED_ROLES = ['owner', 'staff_admin', 'staff_inspeksi'] as const;

function canAccess(role: string): boolean {
  return (ALLOWED_ROLES as readonly string[]).includes(role);
}

// 26 item column names for _awal
const ITEM_COLS_AWAL = Array.from({ length: 26 }, (_, i) => `item${String(i + 1).padStart(2, '0')}_awal`);

export async function GET() {
  const user = await getSessionUser();
  if (!user || !canAccess(user.role)) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
  }

  const itemSelect = ITEM_COLS_AWAL.map((c) => `kk.${c}`).join(', ');

  const result = await turso().execute({
    sql: `SELECT b.no_booking, b.id_penghuni, b.nama_penyewa, b.kamar_no, b.tgl_masuk, b.no_hp,
                 kk.id as kk_id, kk.status_checkin,
                 ${itemSelect},
                 kk.catatan_awal, kk.tanggal_cek_awal, kk.pic
          FROM booking b
          LEFT JOIN kondisi_kamar kk ON kk.id_penghuni = b.id_penghuni
          WHERE b.status_booking IS NOT NULL
            AND b.status_booking NOT IN ('Check-in', 'Check-out', 'Batal')
          ORDER BY b.tgl_masuk ASC`,
    args: [],
  });

  return NextResponse.json({ data: result.rows });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user || !canAccess(user.role)) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
  }

  type ItemKey = `item${string}`;
  const body = await req.json() as {
    kk_id?: number | null;
    id_penghuni: string;
    no_kamar: number;
    nama_penghuni: string;
    items: Record<ItemKey, string>;
    catatan_awal: string;
    tanggal_cek_awal: string;
    pic: string;
    fotos?: string[];
  };

  const {
    kk_id,
    id_penghuni,
    no_kamar,
    nama_penghuni,
    items,
    catatan_awal,
    tanggal_cek_awal,
    pic,
    fotos,
  } = body;

  // Build item args in order item01..item26
  const itemArgs = ITEM_COLS_AWAL.map((col) => {
    const key = col.replace('_awal', '') as ItemKey;
    return items[key] ?? 'Baik';
  });

  let kondisiKamarId: number;

  if (kk_id != null) {
    const res = await turso().execute({
      sql: `UPDATE kondisi_kamar SET
              ${ITEM_COLS_AWAL.map((c) => `${c}=?`).join(', ')},
              catatan_awal=?, tanggal_cek_awal=?, pic=?,
              status_checkin='Menunggu', updated_at=CURRENT_TIMESTAMP
            WHERE id=? AND status_checkin NOT IN ('Menunggu','Disetujui')`,
      args: [...itemArgs, catatan_awal, tanggal_cek_awal, pic, kk_id],
    });

    if (res.rowsAffected === 0) {
      return NextResponse.json({ error: 'Sudah diajukan atau disetujui' }, { status: 409 });
    }
    kondisiKamarId = kk_id;
  } else {
    const id_kamar = `KTD-${no_kamar}`;
    const res = await turso().execute({
      sql: `INSERT INTO kondisi_kamar
              (id_kamar, no_kamar, id_penghuni, nama_penghuni,
               ${ITEM_COLS_AWAL.join(', ')},
               catatan_awal, tanggal_cek_awal, pic, status_checkin, created_at, updated_at)
            VALUES (?, ?, ?, ?, ${ITEM_COLS_AWAL.map(() => '?').join(', ')}, ?, ?, ?, 'Menunggu', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      args: [id_kamar, no_kamar, id_penghuni, nama_penghuni, ...itemArgs, catatan_awal, tanggal_cek_awal, pic],
    });
    kondisiKamarId = Number(res.lastInsertRowid);
  }

  // Insert foto jika ada (item_no=1 sebagai placeholder — schema NOT NULL)
  if (fotos && fotos.length > 0) {
    for (const url of fotos) {
      await turso().execute({
        sql: `INSERT INTO kondisi_kamar_foto (kondisi_kamar_id, fase, item_no, url, created_at)
              VALUES (?, 'awal', 1, ?, CURRENT_TIMESTAMP)`,
        args: [kondisiKamarId, url],
      });
    }
  }

  return NextResponse.json({ ok: true, id: kondisiKamarId });
}
