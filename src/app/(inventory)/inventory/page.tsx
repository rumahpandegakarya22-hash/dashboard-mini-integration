import Link from 'next/link';
import { readInventory, isInventoryConfigured } from '@/lib/dashboard/inventory';

export default async function InventoryHome() {
  if (!isInventoryConfigured()) {
    return <p>Integrasi DB Inventory belum dikonfigurasi (INVENTORY_DATABASE_URL).</p>;
  }

  const { materials } = await readInventory();

  return (
    <>
      <h1>Stok Inventory</h1>
      <p>
        <Link href="/ops">← Beranda Ops</Link> · <Link href="/inventory/pembelian">Input Pembelian</Link>
      </p>
      <table>
        <thead>
          <tr>
            <th>Barang</th>
            <th>Kategori</th>
            <th>Stok</th>
            <th>Min</th>
          </tr>
        </thead>
        <tbody>
          {materials.map((m) => (
            <tr key={m.id}>
              <td>{m.name}</td>
              <td>{m.category}</td>
              <td>
                {m.current_stock} {m.unit}
              </td>
              <td>{m.min_stock}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
