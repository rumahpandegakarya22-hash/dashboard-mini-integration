// Akses stok Inventory dari Mini App — query DB Inventory langsung.
//
// Sebelumnya file ini memanggil REST API app terpisah (INVENTORY_API_URL +
// INVENTORY_API_TOKEN). Sejak app Inventory masuk repo ini, hop HTTP itu
// dipotong: logika di bawah adalah port dari `POST /api/external/usage`
// app lama (auto-FIFO batch tertua, satu transaksi atomik).
//
// DB Inventory tetap instance Turso terpisah (keputusan owner) — koneksinya
// dipinjam dari `lib/dashboard/inventory.ts`.

import { getInventoryClient, invalidateInventoryCache } from './dashboard/inventory';

/** User layanan di tabel `users` DB Inventory. Nama staf asli masuk ke notes. */
export const SERVICE_USER_ID = 'svc-miniapp';

export interface InventoryMaterial {
  id: number;
  name: string;
  unit: string;
  currentStock: number;
}

export async function fetchMaterials(category: string): Promise<InventoryMaterial[]> {
  const c = getInventoryClient();
  const rs = category
    ? await c.execute({
        sql: 'SELECT id, name, unit, current_stock FROM materials WHERE category = ? ORDER BY name',
        args: [category]
      })
    : await c.execute('SELECT id, name, unit, current_stock FROM materials ORDER BY name');
  return rs.rows.map((r: any) => ({
    id: Number(r.id),
    name: String(r.name),
    unit: String(r.unit),
    currentStock: Number(r.current_stock)
  }));
}

/**
 * Catat pemakaian bahan: stok berkurang, batch pembelian tertua yang masih
 * bersisa dipakai sebagai dasar biaya (FIFO otomatis — Mini App tidak memilih
 * batch manual). Tanpa batch bersisa, biaya tidak diketahui (null) — stok lama
 * memang tidak punya harga pokok, dan itu bukan alasan menolak pencatatan.
 *
 * Semua tulisan dalam SATU transaksi libSQL: kalau salah satu gagal, stok tidak
 * pernah berkurang tanpa transaksinya tercatat.
 */
export async function postUsage(p: {
  materialId: number;
  quantity: number;
  notes: string;
}): Promise<{ newStock: number; totalCost: number | null; transactionId: number; materialName: string; unit: string }> {
  const { materialId, quantity, notes } = p;
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('Jumlah pemakaian tidak valid.');

  const now = Math.floor(Date.now() / 1000); // kolom created_at bertipe detik, bukan ms
  const tx = await getInventoryClient().transaction('write');
  try {
    const mat = await tx.execute({
      sql: 'SELECT name, unit, current_stock FROM materials WHERE id = ?',
      args: [materialId]
    });
    if (mat.rows.length === 0) throw new Error('Bahan baku tidak ditemukan.');
    const material = mat.rows[0] as any;
    const newStock = Number(material.current_stock) - quantity;

    const batchRs = await tx.execute({
      sql: `SELECT id, remaining_qty, price_per_unit FROM purchase_batches
            WHERE material_id = ? AND remaining_qty > 0
            ORDER BY purchase_date ASC LIMIT 1`,
      args: [materialId]
    });

    let batchId: number | null = null;
    let unitPrice: number | null = null;
    let totalCost: number | null = null;
    if (batchRs.rows.length > 0) {
      const b = batchRs.rows[0] as any;
      batchId = Number(b.id);
      unitPrice = Number(b.price_per_unit);
      totalCost = quantity * unitPrice;
      await tx.execute({
        sql: 'UPDATE purchase_batches SET remaining_qty = ? WHERE id = ?',
        args: [Math.max(0, Number(b.remaining_qty) - quantity), batchId]
      });
    }

    const ins = await tx.execute({
      sql: `INSERT INTO inventory_transactions
              (material_id, user_id, type, quantity, batch_id, unit_price, total_cost, notes, created_at)
            VALUES (?, ?, 'USAGE', ?, ?, ?, ?, ?, ?) RETURNING id`,
      args: [materialId, SERVICE_USER_ID, -quantity, batchId, unitPrice, totalCost, notes || null, now]
    });
    const transactionId = Number((ins.rows[0] as any).id);

    await tx.execute({
      sql: 'UPDATE materials SET current_stock = ? WHERE id = ?',
      args: [newStock, materialId]
    });

    const biaya = totalCost != null ? ` = Rp${Math.round(totalCost).toLocaleString('id-ID')}` : '';
    await tx.execute({
      sql: 'INSERT INTO activity_logs (user_id, action, target_data, created_at) VALUES (?, ?, ?, ?)',
      args: [
        SERVICE_USER_ID,
        `Mencatat pemakaian bahan (via Mini App): ${material.name} (-${quantity} ${material.unit})${biaya}`,
        `transaction_${transactionId}`,
        now
      ]
    });

    await tx.commit();
    invalidateInventoryCache();
    return { newStock, totalCost, transactionId, materialName: String(material.name), unit: String(material.unit) };
  } catch (e) {
    await tx.rollback().catch(() => {});
    throw e;
  }
}

/**
 * Catat pembelian: 1 pembelian = 1 batch (dasar HPP per unit) + mutasi PURCHASE.
 * Port dari branch PURCHASE `POST /api/transactions` app lama.
 */
export async function postPurchase(p: {
  materialId: number;
  quantity: number;
  totalPrice: number;
  purchaseDate: string; // YYYY-MM-DD
  notes: string;
}): Promise<{ newStock: number; batchId: number; transactionId: number }> {
  // Ditulis atas nama user layanan, bukan user Clerk: `users` di DB Inventory
  // adalah tabel milik app lama dan tidak berbagi id dengan repo ini — memakai
  // id Clerk akan melanggar foreign key. Pelakunya dicatat di notes.
  const { materialId, quantity, totalPrice, notes } = p;
  const userId = SERVICE_USER_ID;
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('Jumlah pembelian tidak valid.');
  if (!Number.isFinite(totalPrice) || totalPrice < 0) throw new Error('Harga tidak valid.');

  // Jam 12 lokal seperti app lama: tanggal tanpa jam tidak boleh geser hari
  // gara-gara timezone saat dibaca balik.
  const at = new Date(`${p.purchaseDate}T12:00:00`);
  if (isNaN(at.getTime())) throw new Error('Tanggal pembelian tidak valid.');
  const purchaseAt = Math.floor(at.getTime() / 1000);
  const now = Math.floor(Date.now() / 1000);
  const pricePerUnit = totalPrice / quantity;

  const tx = await getInventoryClient().transaction('write');
  try {
    const mat = await tx.execute({
      sql: 'SELECT name, unit, current_stock FROM materials WHERE id = ?',
      args: [materialId]
    });
    if (mat.rows.length === 0) throw new Error('Bahan baku tidak ditemukan.');
    const material = mat.rows[0] as any;
    const newStock = Number(material.current_stock) + quantity;

    const batchRs = await tx.execute({
      sql: `INSERT INTO purchase_batches
              (material_id, user_id, purchase_date, quantity, remaining_qty, total_price, price_per_unit, notes, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      args: [materialId, userId, purchaseAt, quantity, quantity, totalPrice, pricePerUnit, notes || null, now]
    });
    const batchId = Number((batchRs.rows[0] as any).id);

    const ins = await tx.execute({
      sql: `INSERT INTO inventory_transactions
              (material_id, user_id, type, quantity, batch_id, unit_price, total_cost, notes, created_at)
            VALUES (?, ?, 'PURCHASE', ?, ?, ?, ?, ?, ?) RETURNING id`,
      args: [materialId, userId, quantity, batchId, pricePerUnit, totalPrice, notes || null, purchaseAt]
    });
    const transactionId = Number((ins.rows[0] as any).id);

    await tx.execute({
      sql: 'UPDATE materials SET current_stock = ? WHERE id = ?',
      args: [newStock, materialId]
    });

    await tx.execute({
      sql: 'INSERT INTO activity_logs (user_id, action, target_data, created_at) VALUES (?, ?, ?, ?)',
      args: [
        userId,
        `Mencatat pembelian bahan: ${material.name} (+${quantity} ${material.unit}) @ Rp${Math.round(pricePerUnit).toLocaleString('id-ID')}/unit`,
        `transaction_${transactionId}`,
        now
      ]
    });

    await tx.commit();
    invalidateInventoryCache();
    return { newStock, batchId, transactionId };
  } catch (e) {
    await tx.rollback().catch(() => {});
    throw e;
  }
}
