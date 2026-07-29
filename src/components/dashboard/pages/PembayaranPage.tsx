'use client';

import { useState } from 'react';
import Table from '@/components/ui/Table';
import { COLS } from '@/config/dashboard-cols';
import { pembayaranNames, filterPembayaran } from '@/lib/dashboard/views/pages';
import type { PembayaranRow } from '@/lib/dashboard/views/types';
import OriginSelect from '@/components/ui/OriginSelect';

/* PORT dari `pagePembayaran()` public/app.js.

   Dropdown filter nama penghuni dipertahankan; baris sudah urut terbaru→terlama
   dari `computeTempo()`. Di sumber, filter disimpan di variabel global
   `PAY_FILTER` dan memicu render ulang seluruh halaman lewat listener
   `document.addEventListener('change', …)`; di sini cukup state lokal. */

export default function PembayaranPage({
  pembayaran,
  period
}: {
  pembayaran: PembayaranRow[];
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
    </>
  );
}
