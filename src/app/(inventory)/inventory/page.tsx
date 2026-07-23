import { listMaterials } from '@/lib/inventory-admin';
import { isInventoryConfigured } from '@/lib/dashboard/inventory';

export default async function InventoryHome() {
  if (!isInventoryConfigured()) {
    return <p>Integrasi DB Inventory belum dikonfigurasi (INVENTORY_DATABASE_URL).</p>;
  }

  const materials = await listMaterials();

  return (
    <>
      <h1>Stok Inventory</h1>
      <table>
        <thead>
          <tr>
            <th>Barang</th>
            <th>Kategori</th>
            <th>Stok</th>
            <th>Min</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {materials.map((m) => (
            <tr key={m.id}>
              <td>{m.name}</td>
              <td>{m.category}</td>
              <td>
                {m.currentStock} {m.unit}
              </td>
              <td>{m.minStock}</td>
              <td>{m.currentStock < m.minStock ? '⚠️ Menipis' : 'OK'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
