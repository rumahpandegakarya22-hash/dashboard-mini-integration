'use client';

import { useState } from 'react';
import Table from '@/components/ui/Table';
import { COLS } from '@/config/dashboard-cols';
import { pembayaranNames, filterPembayaran } from '@/lib/dashboard/views/pages';
import type { PembayaranRow, TransaksiRow } from '@/lib/dashboard/views/types';
import OriginSelect from '@/components/ui/OriginSelect';

export default function PembayaranPage({
  pembayaran,
  transaksi,
  period
}: {
  pembayaran: PembayaranRow[];
  transaksi: TransaksiRow[];
  period: string;
}) {
  const [nama, setNama] = useState('');
  const names = pembayaranNames(pembayaran);
  const rows = filterPembayaran(pembayaran, nama || undefined);

  return (
    <>
      {names.length > 0 && (
        <div style={{ margin: '0 0 10px' }}>
          <OriginSelect
            id="payTenantFilter"
            className="chip"
            ariaLabel="Filter penghuni"
            placeholder="Semua Penghuni"
            value={nama}
            onChange={setNama}
            options={[
              { value: '', label: 'Semua Penghuni' },
              ...names.map((n) => ({ value: n, label: n }))
            ]}
          />
        </div>
      )}
      <Table title="DATA PEMBAYARAN" cols={COLS.pembayaran} data={rows} periodLabel={period} />

      <div style={{ marginTop: '32px' }}>
        <Table title="TRANSAKSI" cols={COLS.transaksi} data={transaksi} periodLabel={period} />
      </div>
    </>
  );
}
