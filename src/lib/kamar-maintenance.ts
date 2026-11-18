import { turso } from './core/turso';
import { invalidateRoomsCache } from './master';
import {
  bukaMaintenance,
  selaraskanStatus,
  tutupMaintenance,
  tutupMaintenanceKamar,
  type StatusKamar,
  type SumberMaintenance
} from './kamar-maintenance-db';

export { KATEGORI_PENGADUAN_KERUSAKAN, nomorKamar, type SumberMaintenance } from './kamar-maintenance-db';

/* Pembungkus aplikasi: klien Turso asli + cache master kamar dibuang setelah status berubah. */

async function denganCache<T>(kerja: () => Promise<T>): Promise<T> {
  try {
    return await kerja();
  } finally {
    await invalidateRoomsCache().catch(() => undefined);
  }
}

export const bukaMaintenanceKamar = (p: { noKamar: string; sumber: SumberMaintenance; ref?: string; alasan?: string; oleh?: string }) =>
  denganCache(() => bukaMaintenance(turso(), p));

export const tutupMaintenanceRef = (p: { sumber: SumberMaintenance; ref: string; oleh?: string }) =>
  denganCache(() => tutupMaintenance(turso(), p));

export const tutupMaintenanceDiKamar = (p: { noKamar: string; sumber?: SumberMaintenance; oleh?: string }): Promise<StatusKamar> =>
  denganCache(() => tutupMaintenanceKamar(turso(), p));

/** Status kamar disesuaikan keadaan terkini (pemicu Maintenance + penghuni aktif). Dipakai checkout dan check-in. */
export const selaraskanStatusKamar = (noKamar: string): Promise<StatusKamar> => denganCache(() => selaraskanStatus(turso(), noKamar));

/**
 * Selaraskan pemicu Maintenance milik sebuah work order. Aktif hanya bila tujuan Maintenance,
 * ada kamar, dan belum Complete; selain itu pemicunya ditutup. Tutup-lalu-buka supaya
 * pergantian kamar saat edit ikut benar (buka berulang di kamar yang sama tidak dobel).
 */
export async function sinkronMaintenanceWo(p: {
  id: number | string;
  noKamar: string | null;
  tujuanDivisi: string;
  status: string;
  oleh?: string;
}): Promise<void> {
  const ref = String(p.id);
  const aktif = p.tujuanDivisi === 'Maintenance' && !!p.noKamar && p.status !== 'Complete';
  await tutupMaintenanceRef({ sumber: 'work_order', ref, oleh: p.oleh });
  if (aktif) {
    await bukaMaintenanceKamar({ noKamar: p.noKamar!, sumber: 'work_order', ref, alasan: `Work order WO-${ref}`, oleh: p.oleh });
  }
}
