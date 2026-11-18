import { turso } from '../../core/turso';
import { normalizeRoomId, parseDateISO, required } from '../../core/validate';
import { sinkronMaintenanceWo } from '../../kamar-maintenance';
import type { SubmitHandler } from '../types';

const KATEGORI = [
  'Elektrikal dan Elektronik',
  'Sanitasi dan Plumbing',
  'Sipil dan Bangunan',
  'Furniture dan Interior',
  'Fasum dan Keamanan',
  'Kebersihan'
];
const PRIORITAS = ['Tinggi', 'Sedang', 'Rendah', 'Darurat'];

/**
 * Work Order (Mini App Improvement §2) → Turso work_orders, status awal Pending.
 * Muncul di joblist + notif divisi tujuan di home. Satu factory utk kedua divisi
 * asal (Inspeksi & Cleaning) — beda hanya divisi_asal & pilihan tujuan valid.
 */
function makeWorkOrderHandler(divisiAsal: 'Inspeksi' | 'Cleaning', tujuanValid: string[]): SubmitHandler {
  return async (values, ctx) => {
    const tanggalInput = parseDateISO(String(values.tanggalInput ?? ''));
    const petugas = required(values.petugas, 'Petugas');
    const lokasiItem = required(values.lokasiItem, 'Lokasi/Item');
    const kategori = required(values.kategori, 'Kategori');
    const deskripsi = required(values.deskripsi, 'Deskripsi');
    const prioritas = required(values.prioritas, 'Prioritas');
    const tujuanDivisi = required(values.tujuanDivisi, 'Tujuan Divisi');
    const targetDeadline = parseDateISO(String(values.targetDeadline ?? ''));
    const catatan = String(values.catatan ?? '').trim();
    const buktiFotoUrl = String(values.buktiFoto ?? '').trim();
    const kamarRaw = String(values.kamar ?? '').trim();
    const noKamar = kamarRaw ? normalizeRoomId(kamarRaw) : null;

    if (!KATEGORI.includes(kategori)) throw new Error(`Kategori tidak valid: "${kategori}".`);
    if (!PRIORITAS.includes(prioritas)) throw new Error(`Prioritas tidak valid: "${prioritas}".`);
    if (!tujuanValid.includes(tujuanDivisi)) throw new Error(`Tujuan divisi tidak valid: "${tujuanDivisi}".`);

    const res = await turso().execute({
      sql: `INSERT INTO work_orders
              (tanggal_input, petugas, divisi_asal, lokasi_item, kategori, deskripsi, prioritas,
               tujuan_divisi, target_deadline, catatan, bukti_foto_url, status, created_by, no_kamar)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?, ?)`,
      args: [
        tanggalInput,
        petugas,
        divisiAsal,
        lokasiItem,
        kategori,
        deskripsi,
        prioritas,
        tujuanDivisi,
        targetDeadline,
        catatan,
        buktiFotoUrl,
        ctx.user.username,
        noKamar
      ]
    });

    // WO ke Maintenance yang menyangkut satu kamar → kamar jadi Maintenance sampai WO Complete.
    const id = Number(res.lastInsertRowid ?? -1);
    let warning: string | undefined;
    try {
      await sinkronMaintenanceWo({ id, noKamar, tujuanDivisi, status: 'Pending', oleh: ctx.user.username });
    } catch (e) {
      console.error('[work-order] gagal set Maintenance kamar:', e instanceof Error ? e.message : e);
      warning = `Work order tersimpan, tapi status Maintenance kamar ${noKamar} gagal diubah — set lewat halaman Status Kamar.`;
    }

    return {
      target: `Turso → work_orders (${divisiAsal} → ${tujuanDivisi})`,
      row: id,
      data: values,
      ...(warning ? { warning } : {})
    };
  };
}

export const submitWoInspeksi = makeWorkOrderHandler('Inspeksi', ['Cleaning', 'Maintenance']);
export const submitWoCleaning = makeWorkOrderHandler('Cleaning', ['Maintenance', 'Inspeksi']);
