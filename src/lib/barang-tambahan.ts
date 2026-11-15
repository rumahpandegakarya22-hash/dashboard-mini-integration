import { turso } from '@/lib/core/turso';

/** "kulkas,  rice cooker,, Kulkas" -> "kulkas, rice cooker": rapikan spasi, buang entri kosong & duplikat. */
export function rapikanBarang(v: unknown): string {
  const unik = new Map<string, string>();
  for (const b of String(v ?? '').split(',')) {
    const nama = b.trim().replace(/\s+/g, ' ');
    if (nama && !unik.has(nama.toLowerCase())) unik.set(nama.toLowerCase(), nama);
  }
  return [...unik.values()].join(', ');
}

/** Salin booking.barang_tambahan ke penghuni saat check-in (baris penghuni dibuat trigger DB,
 *  yang tidak tahu kolom ini). Hanya mengisi yang masih kosong, jadi koreksi manual tidak tertimpa. */
export async function salinBarangKePenghuni(noBooking: string): Promise<void> {
  const stmts = ['occupancy_history', 'active_tenant'].map((tabel) => ({
    sql: `UPDATE ${tabel} SET barang_tambahan = (SELECT b.barang_tambahan FROM booking b WHERE b.no_booking = ?)
          WHERE id_penghuni = (SELECT b.id_penghuni FROM booking b WHERE b.no_booking = ?)
            AND (barang_tambahan IS NULL OR TRIM(barang_tambahan) = '')`,
    args: [noBooking, noBooking]
  }));
  await turso().batch(stmts, 'write');
}
