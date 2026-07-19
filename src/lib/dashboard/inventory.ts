/* =========================================================================
   Kost Tiga Dara — Koneksi DB Inventory Stock (libSQL, read-only)

   PORT VERBATIM dari `server/inventory.js` repo Dashboard lama (Fase 2).

   Dashboard membaca DB Turso app Inventory Stock (inventorystockktd.vercel.app)
   untuk seksi monitoring "Stok Inventory". Dashboard TIDAK pernah menulis ke DB
   ini — gunakan token read-only bila ada.

   CATATAN: berbeda dari `lib/inventory.ts` milik Mini App, yang memanggil REST
   API app Inventory (INVENTORY_API_URL) untuk modul pemakaian-stok. Yang ini
   membaca database-nya langsung untuk pelaporan.

   ENV:
     INVENTORY_DATABASE_URL = libsql://inventoystock-<org>.turso.io
     INVENTORY_AUTH_TOKEN   = token (idealnya read-only)
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
