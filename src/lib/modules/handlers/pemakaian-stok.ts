import { postUsage } from '../../inventory';
import { turso } from '../../core/turso';
import { required } from '../../core/validate';
import type { SubmitHandler } from '../types';

/**
 * Pemakaian Stok (Improvement v1.3 §Rencana 2): staf cleaning/maintenance mencatat bahan
 * yang diambil dari stok. Stok berkurang langsung di DB Inventory (instance terpisah),
 * batch FIFO otomatis — lihat lib/inventory.ts.
 *
 * Tanpa jurnal otomatis: biayanya masuk joblist Admin dulu, sama seperti biaya
 * maintenance, supaya Admin yang memutuskan pencatatan pengeluarannya.
 */

/**
 * Biaya pemakaian > 0 → baris joblist divisi Admin untuk dikonversi jadi
 * pengeluaran. Best-effort: stok sudah berkurang di DB Inventory dan itu tidak
 * bisa dibatalkan dari sini, jadi gagal menulis WO hanya jadi peringatan —
 * bukan alasan menggagalkan submit yang sudah terjadi.
 */
async function biayaKeJoblistAdmin(p: {
  petugas: string;
  divisi: string;
  bahan: string;
  jumlah: number;
  biaya: number;
  transactionId: number;
}): Promise<string | undefined> {
  if (!p.biaya || p.biaya <= 0) return undefined;
  const tanggal = new Date().toISOString().slice(0, 10);
  try {
    await turso().execute({
      sql: `INSERT INTO work_orders
              (tanggal_input, petugas, divisi_asal, lokasi_item, kategori, deskripsi, prioritas,
               tujuan_divisi, status, created_by, nominal, ref_tiket)
            VALUES (?, ?, ?, 'Gudang', 'Pemakaian Stok', ?, 'Sedang', 'Admin', 'Pending', ?, ?, ?)`,
      args: [
        tanggal,
        p.petugas,
        p.divisi,
        `Pemakaian ${p.bahan} sebanyak ${p.jumlah} oleh ${p.petugas} (${p.divisi})`,
        p.petugas,
        p.biaya,
        `inv_tx_${p.transactionId}`
      ]
    });
    return undefined;
  } catch (e: unknown) {
    console.error('[pemakaian-stok] gagal tulis joblist Admin:', (e as Error)?.message);
    return `Pemakaian tercatat, tapi biayanya GAGAL masuk joblist Admin — laporkan ke Admin dengan referensi inv_tx_${p.transactionId}.`;
  }
}

function makePemakaianStokHandler(divisi: 'Cleaning' | 'Maintenance'): SubmitHandler {
  return async (values, ctx) => {
    const materialId = Number(required(values.material, 'Bahan'));
    if (!Number.isInteger(materialId) || materialId <= 0) throw new Error('Bahan tidak valid.');
    const jumlah = Number(String(values.jumlah ?? '').replace(',', '.'));
    if (!isFinite(jumlah) || jumlah <= 0) throw new Error('Jumlah harus angka lebih dari 0.');
    const catatan = String(values.catatan ?? '').trim();

    const notes = `${ctx.user.username} (${divisi})${catatan ? ` — ${catatan}` : ''}`;
    const res = await postUsage({ materialId, quantity: jumlah, notes });

    const warning =
      res.totalCost != null
        ? await biayaKeJoblistAdmin({
            petugas: ctx.user.username,
            divisi,
            bahan: `${res.materialName} (${res.unit})`,
            jumlah,
            biaya: res.totalCost,
            transactionId: res.transactionId
          })
        : undefined;

    return {
      target: 'DB Inventory → inventory_transactions (USAGE)',
      row: res.transactionId,
      // Biaya sengaja TIDAK dikembalikan ke staf: harga pokok bukan urusan
      // lapangan, dan angkanya muncul di tempat yang tepat — joblist Admin
      // untuk dicatat sebagai pengeluaran.
      data: {
        materialId,
        jumlah,
        catatan,
        sisaStok: res.newStock
      },
      warning
    };
  };
}

export const submitPemakaianStokCleaning = makePemakaianStokHandler('Cleaning');
export const submitPemakaianStokMaintenance = makePemakaianStokHandler('Maintenance');
