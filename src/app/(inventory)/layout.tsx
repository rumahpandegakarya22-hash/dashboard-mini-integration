import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAuthState } from '@/lib/core/auth';
import { guardInventory } from '@/lib/core/routing';
import { bolehKelola } from './akses';

/**
 * Layout route group Inventory Stock.
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

  const kelola = bolehKelola(s.user!.role);

  return (
    <div data-app="ops">
      <main className="content content--wide">
        <nav style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <Link href="/ops">← Ops</Link>
          <Link href="/inventory">Stok</Link>
          {kelola && (
            <>
              <Link href="/inventory/pembelian">Pembelian</Link>
              <Link href="/inventory/bahan">Kelola Bahan</Link>
              <Link href="/inventory/koreksi">Koreksi Stok</Link>
              <Link href="/inventory/opname">Opname</Link>
            </>
          )}
        </nav>
        {children}
      </main>
    </div>
  );
}
