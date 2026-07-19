import { postUsage } from '../../inventory';
import { required } from '../../validate';
import type { SubmitHandler } from '../types';

/**
 * Pemakaian Stok (Improvement v1.3 §Rencana 2): staf cleaning/maintenance mencatat bahan
 * yang diambil dari stok. Stok berkurang LANGSUNG di app Inventory Stock (DB terpisah)
 * lewat API eksternal — bukan tulis DB lintas app (logika saldo+batch tetap satu tempat).
 * Tanpa jurnal otomatis — modul akuntansi menunggu validasi owner.
 */
function makePemakaianStokHandler(divisi: 'Cleaning' | 'Maintenance'): SubmitHandler {
  return async (values, ctx) => {
    const materialId = Number(required(values.material, 'Bahan'));
    if (!Number.isInteger(materialId) || materialId <= 0) throw new Error('Bahan tidak valid.');
    const jumlah = Number(String(values.jumlah ?? '').replace(',', '.'));
    if (!isFinite(jumlah) || jumlah <= 0) throw new Error('Jumlah harus angka lebih dari 0.');
    const catatan = String(values.catatan ?? '').trim();

    const notes = `${ctx.user.username} (${divisi})${catatan ? ` — ${catatan}` : ''}`;
    const res = await postUsage({ materialId, quantity: jumlah, notes });

    return {
      target: 'Inventory App → inventory_transactions (USAGE)',
      row: res.transactionId,
      data: {
        materialId,
        jumlah,
        catatan,
        sisaStok: res.newStock,
        biaya: res.totalCost ?? 'tidak diketahui (tanpa batch)'
      }
    };
  };
}

export const submitPemakaianStokCleaning = makePemakaianStokHandler('Cleaning');
export const submitPemakaianStokMaintenance = makePemakaianStokHandler('Maintenance');
