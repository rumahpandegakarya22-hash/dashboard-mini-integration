

import { StatGrid, type StatCardData } from '@/components/ui/StatCard';
import Reveal from '@/components/ui/Reveal';
import DataTablePage from '../pages/DataTablePage';
import { G } from '@/config/dashboard-palette';
import { COLS } from '@/config/dashboard-cols';
import { fmtRpShort } from '@/lib/dashboard/views/finance';
import type { InventoryOverviewData } from '@/lib/dashboard/views/pages';

export default function InventoryOverview({
  inv,
  period
}: {
  inv: InventoryOverviewData;
  period: string;
}) {
  const cards: StatCardData[] = [
    { label: 'Total Jenis Barang', value: String(inv.totalJenis), bg: G.opTeal },
    { label: 'Item di Bawah Min', value: String(inv.dibawahMin), bg: G.opRed, onDark: true },
    { label: 'Jumlah Transaksi', value: String(inv.jumlahTransaksi), bg: G.opAmber },
    { label: 'Biaya Pemakaian', value: fmtRpShort(inv.totalBiayaPemakaian), bg: G.opGreen }
  ];

  return (
    <div className="view">
      <StatGrid cards={cards} cols={4} />
      <Reveal tier={1}>
        <DataTablePage
          title="NOTIFIKASI STOK MENIPIS"
          titleRight
          cols={COLS.stokMenipis}
          data={inv.menipis}
          period={period}
        />
      </Reveal>
      <Reveal tier={2}>
        <DataTablePage
          title="PEMAKAIAN ITEM TERBANYAK"
          titleRight
          cols={COLS.stokTerpakai}
          data={inv.terpakai}
          period={period}
        />
      </Reveal>
    </div>
  );
}
