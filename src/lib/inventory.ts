// Klien API Inventory Stock (inventorystockktd.vercel.app) — server-to-server.
// Endpoint /api/external/usage di app Inventory, auth Bearer EXTERNAL_API_TOKEN (shared secret).
// Env Mini App: INVENTORY_API_URL + INVENTORY_API_TOKEN.

export interface InventoryMaterial {
  id: number;
  name: string;
  unit: string;
  currentStock: number;
}

function cfg(): { url: string; token: string } {
  const url = (process.env.INVENTORY_API_URL || '').replace(/\/$/, '');
  const token = process.env.INVENTORY_API_TOKEN || '';
  if (!url || !token) {
    throw new Error('Integrasi Inventory belum dikonfigurasi (INVENTORY_API_URL / INVENTORY_API_TOKEN).');
  }
  return { url, token };
}

export async function fetchMaterials(category: string): Promise<InventoryMaterial[]> {
  const { url, token } = cfg();
  const res = await fetch(`${url}/api/external/usage?category=${encodeURIComponent(category)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store'
  });
  if (!res.ok) throw new Error(`Gagal ambil daftar bahan dari app Inventory (HTTP ${res.status}).`);
  const json = await res.json();
  return (json.materials ?? []) as InventoryMaterial[];
}

export async function postUsage(p: {
  materialId: number;
  quantity: number;
  notes: string;
}): Promise<{ newStock: number; totalCost: number | null; transactionId: number }> {
  const { url, token } = cfg();
  const res = await fetch(`${url}/api/external/usage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(p)
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error || `Gagal catat pemakaian ke app Inventory (HTTP ${res.status}).`);
  }
  return json;
}
