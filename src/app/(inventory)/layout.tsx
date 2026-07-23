import { redirect } from 'next/navigation';
import { getAuthState } from '@/lib/core/auth';
import { guardInventory } from '@/lib/core/routing';

/**
 * Layout route group Inventory Stock.
 *
 * `data-app="inventory"` mengikat theme-inventory.css ke subtree ini saja —
 * pola yang sama dengan Ops dan Dashboard. Chrome-nya (navbar, header, layout
 * halaman) dibawa masing-masing halaman hasil port, persis app aslinya, jadi
 * layout ini sengaja tidak menambahkan pembungkus apa pun selain gerbang akses.
 */
export default async function InventoryLayout({ children }: { children: React.ReactNode }) {
  const s = await getAuthState();
  const gate = guardInventory(s);
  if (gate !== true) redirect(gate);

  return <div data-app="inventory">{children}</div>;
}
