/* =========================================================================
   Kost Tiga Dara — Koneksi DB Inventory Stock (libSQL, read-only)

   PORT VERBATIM dari `server/inventory.js` repo Dashboard lama (Fase 2).

   Dashboard membaca DB Turso app Inventory Stock (inventorystockktd.vercel.app)
   untuk seksi monitoring "Stok Inventory". Fungsi di file ini read-only.

   PENTING: sejak Integrasi A dipotong, `lib/inventory.ts` MENULIS ke DB yang
   sama lewat `getInventoryClient()` di bawah. INVENTORY_AUTH_TOKEN karena itu
   TIDAK boleh read-only lagi.

   ENV:
     INVENTORY_DATABASE_URL = libsql://inventoystock-<org>.turso.io
     INVENTORY_AUTH_TOKEN   = token (butuh izin tulis)
   ========================================================================= */

import { createClient, type Client } from '@libsql/client';

export interface InventoryData {
  materials: Record<string, any>[];
  transactions: Record<string, any>[];
}

let client: Client | null = null;
let cache: { at: number; data: InventoryData } | null = null; // TTL 60 detik, sama dgn cache utama dashboard
const CACHE_MS = 60 * 1000;

export function isInventoryConfigured(): boolean {
  return !!process.env.INVENTORY_DATABASE_URL;
}

/** Buang cache 60 detik. Wajib dipanggil setelah menulis ke DB Inventory,
 *  kalau tidak stok yang baru berubah tampil basi sampai TTL habis. */
export function invalidateInventoryCache(): void {
  cache = null;
}

/** Klien libSQL ke DB Inventory. Dipakai bersama oleh pembaca dashboard dan
 *  penulis Mini App (`lib/inventory.ts`) — satu koneksi per proses. */
export function getInventoryClient(): Client {
  return getClient();
}

function getClient(): Client {
  if (client) return client;
  if (!isInventoryConfigured()) throw new Error('INVENTORY_DATABASE_URL belum di-set');
  client = createClient({
    url: process.env.INVENTORY_DATABASE_URL!,
    authToken: process.env.INVENTORY_AUTH_TOKEN || undefined
  });
  return client;
}

/* Baca materials + transaksi terakhir (JOIN nama bahan). Cache 60 detik. */
export async function readInventory(): Promise<InventoryData> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.data;
  const c = getClient();
  const mats = await c.execute(
    'SELECT id, name, category, unit, current_stock, min_stock FROM materials ORDER BY name'
  );
  const txs = await c.execute(
    `SELECT t.id, t.type, t.quantity, t.total_cost, t.notes, t.created_at,
            m.name AS material_name, m.unit, u.name AS user_name
     FROM inventory_transactions t
     JOIN materials m ON m.id = t.material_id
     LEFT JOIN users u ON u.id = t.user_id
     ORDER BY t.created_at DESC, t.id DESC LIMIT 200`
  );
  const toObjs = (rs: any): Record<string, any>[] =>
    rs.rows.map((row: any) => {
      const o: Record<string, any> = {};
      for (const col of rs.columns) o[col] = row[col];
      return o;
    });
  const data: InventoryData = { materials: toObjs(mats), transactions: toObjs(txs) };
  cache = { at: Date.now(), data };
  return data;
}
