import { redirect } from 'next/navigation';
import { getAuthState } from '@/lib/core/auth';
import { guardInventory } from '@/lib/core/routing';

/**
 * Layout route group Inventory Stock (Tahap 1 — kerangka).
 *
 * Sengaja memakai wrapper `data-app="ops"`, bukan tema sendiri: selama tampilan
 * Inventory belum beda dari Ops, file theme-inventory.css hanya duplikasi yang
 * bisa bocor. Ganti ke `data-app="inventory"` + theme-inventory.css saat
 * tampilannya benar-benar menyimpang.
 */
export default async function InventoryLayout({ children }: { children: React.ReactNode }) {
  const s = await getAuthState();
  const gate = guardInventory(s);
  if (gate !== true) redirect(gate);

  return (
    <div data-app="ops">
      <main className="content content--wide">{children}</main>
    </div>
  );
}
