// Fitur Edit Data per menu (Improvement v1.2 §"edit database"): daftar entri
// terakhir target modul → pilih → form terisi → simpan menimpa baris yang sama.
//
// Dua jenis store:
// - 'sheet'  : baris Google Sheets, di-update via nomor baris (readTableWithRowNum
//              → updateRange). Tulis pakai buildRow YANG SAMA dgn submit (satu
//              aturan validasi/normalisasi); sel null (kolom formula) dilewati
//              Google API sehingga formula tidak tertimpa.
// - 'turso'  : UPDATE by id.
//
// SENGAJA TIDAK ada edit utk: pembayaran-sewa & pindah-kamar (submitnya memicu
// efek berantai — invoice/email/payment, perpindahan atomik antar tabel — edit
// aman butuh proses void/koreksi sendiri) dan inspeksi-kebersihan (5 field form
// digabung jadi 4 kolom sheet — tidak bisa dibalik utuh).

import { readTableWithRowNum, updateRange, assertHeaders } from '../sheets';
import { turso, DIVISI_DB, TASK_STATUS } from '../turso';
import { getAccounts, getActiveTenants, getTenantByLabel, getRoomFresh } from '../master';
import { toISODateFlexible, parseDateISO, parseRupiah, normalizePhone, normalizeRoomId, required } from '../validate';
import { MODULES } from './registry';
import type { AppendConfig } from './handlers/helpers';
import { surveyAppendCfg } from './handlers/survey';
import { leadsAppendCfg } from './handlers/leads';
import { kontenAppendCfg } from './handlers/konten';
import { promosiAppendCfg } from './handlers/promosi';
import { KODE_KATEGORI } from './handlers/maintenance';
import { inspeksiFasilitasAppendCfg } from './handlers/inspeksi-fasilitas';
import { SHEETS } from '@/config/spreadsheets';

export interface EditEntry {
  ref: string; // sheet: nomor baris; turso: id
  label: string;
  values: Record<string, string>; // siap dimasukkan ke DynamicForm
}

const LIST_LIMIT = 20;

interface SheetEditCfg {
  kind: 'sheet';
  append: AppendConfig;
  /** Nama field form berurutan PERSIS dgn output buildRow; null = kolom formula/dilewati. */
  editFields: (string | null)[];
  /** Field yang dirangkai jadi label daftar. */
  labelFields: string[];
}

/** Modul dgn list/save bebas (Turso, sheet berkolom gabungan, atau butuh infer field). Save boleh return warning. */
interface CustomEditCfg {
  kind: 'custom';
  list: () => Promise<EditEntry[]>;
  save: (ref: string, values: Record<string, unknown>) => Promise<string | undefined | void>;
}

type EditCfg = SheetEditCfg | CustomEditCfg;

// ---- Turso: Tugas Harian ----

const dailyTaskEdit: CustomEditCfg = {
  kind: 'custom',
  list: async () => {
    const res = await turso().execute(
      `SELECT id, tanggal, task, pic, divisi, deadline, status FROM daily_tasks ORDER BY id DESC LIMIT ${LIST_LIMIT}`
    );
    return res.rows.map((r) => ({
      ref: String(r.id),
      label: `#${r.id} · ${r.tanggal} · ${r.task} (${r.pic})`,
      values: {
        tanggal: String(r.tanggal ?? ''),
        task: String(r.task ?? ''),
        pic: String(r.pic ?? ''),
        divisi: String(r.divisi ?? ''),
        deadline: String(r.deadline ?? ''),
        status: String(r.status ?? '')
      }
    }));
  },
  save: async (ref, values) => {
    const tanggal = parseDateISO(String(values.tanggal ?? ''));
    const task = required(values.task, 'Tugas');
    const pic = required(values.pic, 'PIC');
    const divisi = required(values.divisi, 'Divisi');
    const deadline = parseDateISO(String(values.deadline ?? ''));
    const status = required(values.status, 'Status');
    if (!(DIVISI_DB as readonly string[]).includes(divisi)) throw new Error(`Divisi tidak valid: "${divisi}".`);
    if (!(TASK_STATUS as readonly string[]).includes(status)) throw new Error(`Status tidak valid: "${status}".`);
    const res = await turso().execute({
      sql: 'UPDATE daily_tasks SET tanggal = ?, task = ?, pic = ?, divisi = ?, deadline = ?, status = ? WHERE id = ?',
      args: [tanggal, task, pic, divisi, deadline, status, Number(ref)]
    });
    if (res.rowsAffected === 0) throw new Error('Tugas tidak ditemukan (mungkin sudah dihapus).');
  }
};

// ---- Turso: Work Order (Inspeksi & Cleaning) ----

function workOrderEdit(divisiAsal: 'Inspeksi' | 'Cleaning'): CustomEditCfg {
  return {
    kind: 'custom',
    list: async () => {
      const res = await turso().execute({
        sql: `SELECT id, tanggal_input, petugas, lokasi_item, kategori, deskripsi, prioritas, tujuan_divisi,
                     target_deadline, catatan, bukti_foto_url
              FROM work_orders WHERE divisi_asal = ? ORDER BY id DESC LIMIT ${LIST_LIMIT}`,
        args: [divisiAsal]
      });
      return res.rows.map((r) => ({
        ref: String(r.id),
        label: `WO-${r.id} · ${r.tanggal_input} · ${r.lokasi_item} → ${r.tujuan_divisi}`,
        values: {
          tanggalInput: String(r.tanggal_input ?? ''),
          petugas: String(r.petugas ?? ''),
          lokasiItem: String(r.lokasi_item ?? ''),
          kategori: String(r.kategori ?? ''),
          deskripsi: String(r.deskripsi ?? ''),
          prioritas: String(r.prioritas ?? ''),
          tujuanDivisi: String(r.tujuan_divisi ?? ''),
          targetDeadline: String(r.target_deadline ?? ''),
          catatan: String(r.catatan ?? ''),
          buktiFoto: String(r.bukti_foto_url ?? '')
        }
      }));
    },
    save: async (ref, values) => {
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
      // Status TIDAK diubah dari sini — alur status lewat tabel Work Order/List Job di home.
      const res = await turso().execute({
        sql: `UPDATE work_orders SET tanggal_input = ?, petugas = ?, lokasi_item = ?, kategori = ?, deskripsi = ?,
                     prioritas = ?, tujuan_divisi = ?, target_deadline = ?, catatan = ?, bukti_foto_url = ?,
                     updated_at = CURRENT_TIMESTAMP
              WHERE id = ? AND divisi_asal = ?`,
        args: [tanggalInput, petugas, lokasiItem, kategori, deskripsi, prioritas, tujuanDivisi, targetDeadline, catatan, buktiFotoUrl, Number(ref), divisiAsal]
      });
      if (res.rowsAffected === 0) throw new Error('Work order tidak ditemukan / bukan milik divisi ini.');
    }
  };
}

// ---- Turso: Maintenance (Perawatan Preventif & Perbaikan Korektif) ----
// Catatan pemetaan PM (sesuai isi data live, bukan nama kolom):
// sumber_laporan = fasilitas/item, lokasi_item = jenis perawatan.

const perawatanPreventifEdit: CustomEditCfg = {
  kind: 'custom',
  list: async () => {
    const res = await turso().execute(
      `SELECT id_tiket, tanggal_lapor, tanggal_selesai, sumber_laporan, lokasi_item, kategori, penyebab,
              deskripsi_kerusakan, prioritas, pelaksana, vendor, biaya, status, catatan_dokumentasi
       FROM maintenance_pm ORDER BY no_urut DESC LIMIT ${LIST_LIMIT}`
    );
    return res.rows.map((r) => ({
      ref: String(r.id_tiket),
      label: `${r.id_tiket} · ${r.tanggal_lapor} · ${r.sumber_laporan} (${r.status})`,
      values: {
        tanggalJadwal: String(r.tanggal_lapor ?? ''),
        tanggalSelesai: String(r.tanggal_selesai ?? ''),
        fasilitasItem: String(r.sumber_laporan ?? ''),
        jenisPerawatan: String(r.lokasi_item ?? ''),
        kategori: String(r.kategori ?? ''),
        penyebab: String(r.penyebab ?? ''),
        deskripsi: String(r.deskripsi_kerusakan ?? ''),
        prioritas: String(r.prioritas ?? ''),
        pelaksana: String(r.pelaksana ?? ''),
        vendor: String(r.vendor ?? ''),
        biaya: String(r.biaya ?? ''),
        status: String(r.status ?? ''),
        catatan: String(r.catatan_dokumentasi ?? '')
      }
    }));
  },
  save: async (ref, values) => {
    const kategori = required(values.kategori, 'Kategori');
    const kode = KODE_KATEGORI[kategori];
    if (!kode) throw new Error(`Kategori tidak valid: "${kategori}".`);
    const res = await turso().execute({
      sql: `UPDATE maintenance_pm SET tanggal_lapor = ?, tanggal_selesai = ?, sumber_laporan = ?, lokasi_item = ?,
                   kategori = ?, kode = ?, penyebab = ?, deskripsi_kerusakan = ?, prioritas = ?, pelaksana = ?,
                   vendor = ?, biaya = ?, status = ?, catatan_dokumentasi = ?
            WHERE id_tiket = ?`,
      args: [
        parseDateISO(String(values.tanggalJadwal ?? '')),
        values.tanggalSelesai ? parseDateISO(String(values.tanggalSelesai)) : null,
        required(values.fasilitasItem, 'Fasilitas/Item'),
        required(values.jenisPerawatan, 'Jenis Perawatan'),
        kategori,
        kode,
        String(values.penyebab ?? '').trim() || null,
        required(values.deskripsi, 'Deskripsi Pekerjaan'),
        required(values.prioritas, 'Prioritas'),
        required(values.pelaksana, 'Pelaksana'),
        String(values.vendor ?? '').trim() || null,
        values.biaya ? parseRupiah(values.biaya as string | number) : null,
        required(values.status, 'Status'),
        String(values.catatan ?? '').trim() || null,
        ref
      ]
    });
    if (res.rowsAffected === 0) throw new Error('Tiket tidak ditemukan (mungkin sudah dihapus).');
    return 'Catatan: kalau Biaya diubah dan joblist Admin sudah terlanjur dibuat, nominal di joblist TIDAK ikut berubah — koordinasikan dengan Admin.';
  }
};

const perbaikanKorektifEdit: CustomEditCfg = {
  kind: 'custom',
  list: async () => {
    const res = await turso().execute(
      `SELECT id_tiket, tanggal_kerusakan, tanggal_lapor, tanggal_selesai, sumber_laporan, lokasi_item, kategori,
              penyebab, deskripsi_kerusakan, prioritas, pelaksana, vendor, biaya, status, catatan_dokumentasi
       FROM maintenance_cm ORDER BY no_urut DESC LIMIT ${LIST_LIMIT}`
    );
    return res.rows.map((r) => ({
      ref: String(r.id_tiket),
      label: `${r.id_tiket} · ${r.tanggal_kerusakan} · ${r.lokasi_item} (${r.status})`,
      values: {
        tanggalKerusakan: String(r.tanggal_kerusakan ?? ''),
        tanggalLapor: String(r.tanggal_lapor ?? ''),
        tanggalSelesai: String(r.tanggal_selesai ?? ''),
        sumberLaporan: String(r.sumber_laporan ?? ''),
        lokasiItem: String(r.lokasi_item ?? ''),
        kategori: String(r.kategori ?? ''),
        penyebab: String(r.penyebab ?? ''),
        deskripsi: String(r.deskripsi_kerusakan ?? ''),
        prioritas: String(r.prioritas ?? ''),
        pelaksana: String(r.pelaksana ?? ''),
        vendor: String(r.vendor ?? ''),
        biaya: String(r.biaya ?? ''),
        status: String(r.status ?? ''),
        catatan: String(r.catatan_dokumentasi ?? '')
      }
    }));
  },
  save: async (ref, values) => {
    const kategori = required(values.kategori, 'Kategori');
    const kode = KODE_KATEGORI[kategori];
    if (!kode) throw new Error(`Kategori tidak valid: "${kategori}".`);
    const res = await turso().execute({
      sql: `UPDATE maintenance_cm SET tanggal_kerusakan = ?, tanggal_lapor = ?, tanggal_selesai = ?, sumber_laporan = ?,
                   lokasi_item = ?, kategori = ?, kode = ?, penyebab = ?, deskripsi_kerusakan = ?, prioritas = ?,
                   pelaksana = ?, vendor = ?, biaya = ?, status = ?, catatan_dokumentasi = ?
            WHERE id_tiket = ?`,
      args: [
        parseDateISO(String(values.tanggalKerusakan ?? '')),
        parseDateISO(String(values.tanggalLapor ?? '')),
        values.tanggalSelesai ? parseDateISO(String(values.tanggalSelesai)) : null,
        required(values.sumberLaporan, 'Sumber Laporan'),
        required(values.lokasiItem, 'Lokasi/Item Rusak'),
        kategori,
        kode,
        String(values.penyebab ?? '').trim() || null,
        required(values.deskripsi, 'Deskripsi Kerusakan'),
        required(values.prioritas, 'Prioritas'),
        String(values.pelaksana ?? '').trim() || null,
        String(values.vendor ?? '').trim() || null,
        values.biaya ? parseRupiah(values.biaya as string | number) : null,
        required(values.status, 'Status'),
        String(values.catatan ?? '').trim() || null,
        ref
      ]
    });
    if (res.rowsAffected === 0) throw new Error('Tiket tidak ditemukan (mungkin sudah dihapus).');
    return 'Catatan: kalau Biaya diubah dan joblist Admin sudah terlanjur dibuat, nominal di joblist TIDAK ikut berubah — koordinasikan dengan Admin.';
  }
};

// ---- Sheet custom: Penghuni Baru (Log Booking B:M) ----
// Kolom H (Tgl Keluar Est.) = formula & K (Alasan Cancel) diisi manual di sheet →
// dua-duanya null saat edit (dilewati API, tidak tertimpa). Validasi kamar-terisi &
// No. HP unik SENGAJA tidak diulang (akan bentrok dgn baris ini sendiri).

const penghuniBaruEdit: CustomEditCfg = {
  kind: 'custom',
  list: async () => {
    const rows = await readTableWithRowNum(SHEETS.LOG_SALES, "'Log Booking'!B:M");
    return rows
      .slice(-LIST_LIMIT)
      .reverse()
      .map(({ row, data }) => {
        const d = (k: string) => String(data[k] ?? '').trim();
        const values = {
          tanggalBooking: toISODateFlexible(d('Tanggal Booking')) ?? '',
          namaPenyewa: d('Nama Penyewa'),
          noHp: d('No. HP'),
          kamar: d('Kamar'),
          tglMasuk: toISODateFlexible(d('Tgl Masuk')) ?? '',
          durasiBulan: d('Durasi (bulan)').replace(/[^0-9]/g, ''),
          hargaDisepakati: d('Harga Disepakati (Rp)').replace(/[^0-9]/g, ''),
          statusBooking: d('Status Booking'),
          sumberLeads: d('Sumber Leads'),
          catatan: d('Catatan')
        };
        return { ref: String(row), label: `Baris ${row} · ${values.tanggalBooking} · ${values.namaPenyewa} · K${values.kamar}`, values };
      });
  },
  save: async (ref, values) => {
    const rowNum = parseInt(ref, 10);
    if (!Number.isInteger(rowNum) || rowNum < 2) throw new Error('Referensi baris tidak valid.');
    const tanggalBooking = parseDateISO(String(values.tanggalBooking ?? ''));
    const namaPenyewa = required(values.namaPenyewa, 'Nama Penyewa');
    const noHp = normalizePhone(String(values.noHp ?? ''));
    const kamarId = normalizeRoomId(String(values.kamar ?? ''));
    const tglMasuk = parseDateISO(String(values.tglMasuk ?? ''));
    const durasi = parseInt(String(values.durasiBulan ?? ''), 10);
    if (![1, 2, 3, 6, 9, 12].includes(durasi)) throw new Error('Durasi tidak valid.');
    const harga = parseRupiah(values.hargaDisepakati as string | number);
    // Pita kewajaran harga (sama dgn submit penghuni-baru): nego normal boleh, cegah
    // salah ketik ekstrem (nyaris 0 atau 10x lipat). Dilewati jika kamar tak ditemukan
    // di master (mis. booking lama yg kamarnya sudah berubah) — agar edit tetap bisa.
    const room = await getRoomFresh(kamarId);
    const listed = room ? parseRupiah(String(room.hargaBulan)) : 0;
    if (listed > 0 && (harga < listed * 0.5 || harga > listed * 2)) {
      throw new Error(
        'Harga disepakati (Rp' + harga + ') terlalu jauh dari harga kamar (Rp' + listed + '). Perlu persetujuan Owner.'
      );
    }
    const statusBooking = required(values.statusBooking, 'Status Booking');
    const sumberLeads = required(values.sumberLeads, 'Sumber Leads');
    const catatan = String(values.catatan ?? '').trim();
    await updateRange(SHEETS.LOG_SALES, `'Log Booking'!B${rowNum}:M${rowNum}`, [
      [tanggalBooking, namaPenyewa, `'${noHp}`, kamarId, tglMasuk, durasi, null, harga, statusBooking, null, sumberLeads, catatan]
    ]);
    return 'Catatan: status kamar TIDAK diubah otomatis dari edit — kalau kamarnya diganti, sesuaikan status kamar manual.';
  }
};

// ---- Sheet custom: Checkout (Log Checkout A:J) ----
// Kolom Kamar/Diinput Oleh/Timestamp dipertahankan dari baris lama (update A:H saja;
// kamar diambil ulang dari baris karena penghuninya sudah non-aktif pasca checkout).

const checkoutEdit: CustomEditCfg = {
  kind: 'custom',
  list: async () => {
    const rows = await readTableWithRowNum(SHEETS.CHECKOUT, "'Log Checkout'!A:J");
    return rows
      .slice(-LIST_LIMIT)
      .reverse()
      .map(({ row, data }) => {
        const d = (k: string) => String(data[k] ?? '').trim();
        const tunggakanText = d('Tunggakan?');
        const values = {
          tanggalCheckout: toISODateFlexible(d('Tanggal Checkout')) ?? '',
          penghuni: d('Penghuni'),
          tglMasuk: toISODateFlexible(d('Tgl Masuk')) ?? '',
          adaTunggakan: /^ya/i.test(tunggakanText) ? 'Ya' : tunggakanText ? 'Tidak' : '',
          nominalTunggakan: /^ya/i.test(tunggakanText) ? tunggakanText.replace(/[^0-9]/g, '') : '',
          pengembalianDeposit: d('Pengembalian Deposit').replace(/[^0-9]/g, ''),
          kondisiKamar: d('Kondisi Kamar'),
          catatanKerusakan: d('Catatan Kerusakan')
        };
        return { ref: String(row), label: `Baris ${row} · ${values.tanggalCheckout} · ${values.penghuni}`, values };
      });
  },
  save: async (ref, values) => {
    const rowNum = parseInt(ref, 10);
    if (!Number.isInteger(rowNum) || rowNum < 2) throw new Error('Referensi baris tidak valid.');
    const rows = await readTableWithRowNum(SHEETS.CHECKOUT, "'Log Checkout'!A:J");
    const existing = rows.find((r) => r.row === rowNum);
    if (!existing) throw new Error('Baris checkout tidak ditemukan lagi di sheet.');
    const kamar = String(existing.data['Kamar'] ?? '').trim(); // penghuni sudah non-aktif — kamar dari baris lama

    const tanggalCheckout = parseDateISO(String(values.tanggalCheckout ?? ''));
    const penghuni = required(values.penghuni, 'Penghuni');
    const tglMasuk = values.tglMasuk ? parseDateISO(String(values.tglMasuk)) : '';
    const adaTunggakan = required(values.adaTunggakan, 'Tunggakan?');
    if (adaTunggakan !== 'Ya' && adaTunggakan !== 'Tidak') throw new Error('Nilai Tunggakan? tidak valid.');
    const nominalTunggakan =
      adaTunggakan === 'Ya' && values.nominalTunggakan ? parseRupiah(values.nominalTunggakan as string | number) : 0;
    const pengembalianDeposit = values.pengembalianDeposit ? parseRupiah(values.pengembalianDeposit as string | number) : 0;
    const kondisiKamar = required(values.kondisiKamar, 'Kondisi Kamar');
    const catatanKerusakan = String(values.catatanKerusakan ?? '').trim();
    const tunggakanText = adaTunggakan === 'Ya' ? `Ya - Rp${nominalTunggakan.toLocaleString('id-ID')}` : 'Tidak';
    await updateRange(SHEETS.CHECKOUT, `'Log Checkout'!A${rowNum}:H${rowNum}`, [
      [tanggalCheckout, penghuni, kamar, tglMasuk, tunggakanText, pengembalianDeposit, kondisiKamar, catatanKerusakan]
    ]);
  }
};

// ---- Sheet custom: Pencatatan Pengeluaran (Transaksi A:F) ----
// tipeAkun tidak tersimpan di sheet (cuma pengarah dropdown) → di-infer balik dari
// nama akun debit via master Daftar Akun supaya dropdown dependen langsung hidup.

// Turso-only (arahan 2026-07-19): edit langsung ke jurnal_transaksi (ref = id), bukan sheet.
const pengeluaranEdit: CustomEditCfg = {
  kind: 'custom',
  list: async () => {
    const res = await turso().execute(
      `SELECT j.id, j.tanggal, j.nominal, j.keterangan, j.kategori,
              d.nama_akun AS debit_nama, d.tipe_akun AS debit_tipe, k.nama_akun AS kredit_nama
       FROM jurnal_transaksi j
       LEFT JOIN coa d ON d.kode = j.akun_debit_kode
       LEFT JOIN coa k ON k.kode = j.akun_kredit_kode
       ORDER BY j.id DESC LIMIT ${LIST_LIMIT}`
    );
    return res.rows.map((r) => ({
      ref: String(r.id),
      label: `#${r.id} · ${r.tanggal} · ${r.keterangan} · Rp${r.nominal}`,
      values: {
        tanggal: String(r.tanggal ?? ''),
        tipeAkun: String(r.debit_tipe ?? ''),
        akunDebit: String(r.debit_nama ?? ''),
        dibayarDari: String(r.kredit_nama ?? ''),
        nominal: String(r.nominal ?? ''),
        keterangan: String(r.keterangan ?? ''),
        kategori: String(r.kategori ?? '')
      }
    }));
  },
  save: async (ref, values) => {
    const tanggal = parseDateISO(String(values.tanggal ?? ''));
    const akunDebit = required(values.akunDebit, 'Kategori Pengeluaran');
    const akunKredit = required(values.dibayarDari, 'Dibayar Dari');
    const nominal = parseRupiah(values.nominal as string | number);
    const keterangan = required(values.keterangan, 'Keterangan');
    const kategori = required(values.kategori, 'Kategori');
    const db = turso();
    const kode = async (nama: string) => {
      const r = await db.execute({ sql: 'SELECT kode FROM coa WHERE nama_akun = ?', args: [nama] });
      return r.rows[0]?.kode ?? null;
    };
    const [kodeDebit, kodeKredit] = [await kode(akunDebit), await kode(akunKredit)];
    if (kodeDebit === null || kodeKredit === null) {
      const missing = [kodeDebit === null ? akunDebit : null, kodeKredit === null ? akunKredit : null].filter(Boolean);
      throw new Error(`Akun "${missing.join('", "')}" tidak ditemukan di COA.`);
    }
    const res = await db.execute({
      sql: `UPDATE jurnal_transaksi SET tanggal = ?, akun_debit_kode = ?, akun_kredit_kode = ?,
                   nominal = ?, keterangan = ?, kategori = ?
            WHERE id = ?`,
      args: [tanggal, kodeDebit, kodeKredit, nominal, keterangan, kategori, Number(ref)]
    });
    if (res.rowsAffected === 0) throw new Error('Transaksi tidak ditemukan (mungkin sudah dihapus).');
  }
};

// ---- Turso custom: Feedback (2 tabel — tenant_complain & feedback) ----

const isKomplain = (kategori: string) => /komplain|complain/i.test(kategori);

const feedbackEdit: CustomEditCfg = {
  kind: 'custom',
  list: async () => {
    const [fb, cmp, tenants] = await Promise.all([
      turso().execute('SELECT id_feedback, id_penghuni, category, deskripsi, status FROM feedback ORDER BY id_feedback DESC LIMIT 10'),
      turso().execute('SELECT id_complain, id_penghuni, category, description, status, reported_at FROM tenant_complain ORDER BY reported_at DESC LIMIT 10'),
      getActiveTenants()
    ]);
    const labelById: Record<string, string> = {};
    for (const t of tenants) labelById[t.id] = t.label;

    const out: EditEntry[] = [];
    for (const r of cmp.rows) {
      const tanggal = String(r.reported_at ?? '').slice(0, 10);
      out.push({
        ref: `cmp-${r.id_complain}`,
        label: `Komplain · ${tanggal} · ${labelById[String(r.id_penghuni)] ?? r.id_penghuni}`,
        values: {
          tanggal,
          sumber: labelById[String(r.id_penghuni)] ?? '',
          kategoriFeedback: 'Komplain',
          kategoriTerkait: String(r.category ?? ''),
          isi: String(r.description ?? ''),
          status: String(r.status ?? '')
        }
      });
    }
    for (const r of fb.rows) {
      // deskripsi tersimpan "[tanggal] [jenis] isi" (lihat submitFeedback) — parse balik utk form.
      const m = String(r.deskripsi ?? '').match(/^\[(\d{4}-\d{2}-\d{2})\] \[([^\]]+)\] ([\s\S]*)$/);
      out.push({
        ref: `fb-${r.id_feedback}`,
        label: `${m?.[2] ?? 'Feedback'} · ${m?.[1] ?? ''} · ${labelById[String(r.id_penghuni)] ?? r.id_penghuni}`,
        values: {
          tanggal: m?.[1] ?? '',
          sumber: labelById[String(r.id_penghuni)] ?? '',
          kategoriFeedback: m?.[2] ?? '',
          kategoriTerkait: String(r.category ?? ''),
          isi: m?.[3] ?? String(r.deskripsi ?? ''),
          status: String(r.status ?? '')
        }
      });
    }
    return out;
  },
  save: async (ref, values) => {
    const tanggal = parseDateISO(String(values.tanggal ?? ''));
    const sumber = required(values.sumber, 'Sumber');
    const kategoriFeedback = required(values.kategoriFeedback, 'Kategori Feedback');
    const kategoriTerkait = required(values.kategoriTerkait, 'Terkait');
    const isi = required(values.isi, 'Isi');
    const status = required(values.status, 'Status');
    const tenant = await getTenantByLabel(sumber);
    if (!tenant) throw new Error(`Penghuni "${sumber}" tidak ditemukan di Database Penghuni.`);

    if (ref.startsWith('cmp-')) {
      if (!isKomplain(kategoriFeedback)) {
        throw new Error('Entri ini tercatat sebagai Komplain — mengubah jenis ke Saran/Kritik tidak didukung dari edit. Input baru saja.');
      }
      const res = await turso().execute({
        sql: `UPDATE tenant_complain SET id_penghuni = ?, category = ?, title = ?, description = ?, status = ?, reported_at = ?
              WHERE id_complain = ?`,
        args: [tenant.id, kategoriTerkait, isi.slice(0, 100), isi, status, tanggal, ref.slice(4)]
      });
      if (res.rowsAffected === 0) throw new Error('Komplain tidak ditemukan (mungkin sudah dihapus).');
      return;
    }
    if (ref.startsWith('fb-')) {
      if (isKomplain(kategoriFeedback)) {
        throw new Error('Entri ini tercatat sebagai Saran/Kritik — mengubah jenis ke Komplain tidak didukung dari edit. Input baru saja.');
      }
      const res = await turso().execute({
        sql: `UPDATE feedback SET id_penghuni = ?, nama = ?, no_kamar = ?, category = ?, deskripsi = ?, status = ?
              WHERE id_feedback = ?`,
        args: [tenant.id, tenant.nama, tenant.kamar, kategoriTerkait, `[${tanggal}] [${kategoriFeedback}] ${isi}`, status, Number(ref.slice(3))]
      });
      if (res.rowsAffected === 0) throw new Error('Feedback tidak ditemukan (mungkin sudah dihapus).');
      return;
    }
    throw new Error('Referensi entri tidak dikenal.');
  }
};

// ---- Registry edit config ----

export const EDIT_CONFIGS: Record<string, EditCfg> = {
  'daily-task': dailyTaskEdit,
  'wo-inspeksi': workOrderEdit('Inspeksi'),
  'wo-cleaning': workOrderEdit('Cleaning'),
  'penghuni-baru': penghuniBaruEdit,
  checkout: checkoutEdit,
  pengeluaran: pengeluaranEdit,
  feedback: feedbackEdit,
  survey: {
    kind: 'sheet',
    append: surveyAppendCfg,
    editFields: ['tanggalSurvey', 'namaCalon', 'noHp', 'dariMana', 'kamarDitinjau', 'jamSurvey', 'durasiMnt', 'feedback', 'keberatan', 'hasilSurvey', 'tindakLanjut', 'pic', 'tanggalFu'],
    labelFields: ['tanggalSurvey', 'namaCalon', 'hasilSurvey']
  },
  leads: {
    kind: 'sheet',
    append: leadsAppendCfg,
    editFields: ['tanggal', 'namaLeads', 'noHp', 'sumberLeads', 'platform', 'jenisKamarDicari', 'budget', 'checkinRencana', 'statusLeads', 'tindakLanjut', 'picCs', 'waktuFollowUp'],
    labelFields: ['tanggal', 'namaLeads', 'statusLeads']
  },
  konten: {
    kind: 'sheet',
    append: kontenAppendCfg,
    editFields: ['tanggalPost', 'platform', 'jenisKonten', 'judulCaption', 'visual', 'linkPost', 'jamTayang', 'status', 'likes', 'komentar', 'shareSaves', 'reach', 'catatan'],
    labelFields: ['tanggalPost', 'platform', 'judulCaption']
  },
  promosi: {
    kind: 'sheet',
    append: promosiAppendCfg,
    editFields: ['tanggalMulai', 'tanggalSelesai', 'namaPromosi', 'platform', 'tipePromosi', 'budget', 'spendAktual', 'target', 'leadsAktual', 'bookingDariPromo', null /* ROI: formula */, 'status'],
    labelFields: ['tanggalMulai', 'namaPromosi', 'status']
  },
  'perawatan-preventif': perawatanPreventifEdit,
  'perbaikan-korektif': perbaikanKorektifEdit,
  'inspeksi-fasilitas': {
    kind: 'sheet',
    append: inspeksiFasilitasAppendCfg,
    editFields: ['tanggal', 'areaFasilitas', 'kondisiDitemukan', 'kategori', 'tindakLanjutPerlu', 'petugas', 'catatan'],
    labelFields: ['tanggal', 'areaFasilitas', 'kategori']
  }
};

/** Modul yang punya fitur edit — dipakai halaman modul utk menampilkan panel. */
export function isEditable(moduleId: string): boolean {
  return moduleId in EDIT_CONFIGS;
}

// ---- Helper sheet ----

/** "'Log Survey'!A:M" → { sheetName: "Log Survey", colStart: "A", colEnd: "M" } */
function parseColRange(range: string): { sheetName: string; colStart: string; colEnd: string } {
  const m = range.match(/^'([^']+)'!([A-Z]+):([A-Z]+)$/);
  if (!m) throw new Error(`Format range tidak dikenal: ${range}`);
  return { sheetName: m[1], colStart: m[2], colEnd: m[3] };
}

/** Cocokkan header aktual sheet dgn header expected (normalisasi spasi + case, sama spt assertHeaders). */
function normHeader(h: string): string {
  return h.replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Ubah baris sheet (keyed header aktual) → values form, pakai urutan editFields + normalisasi tanggal/jam. */
function rowToValues(moduleId: string, cfg: SheetEditCfg, data: Record<string, string>): Record<string, string> {
  const actualByNorm: Record<string, string> = {};
  for (const k of Object.keys(data)) actualByNorm[normHeader(k)] = data[k];

  const fieldDefs = MODULES.find((m) => m.id === moduleId)?.fields ?? [];
  const typeOf = (name: string) => fieldDefs.find((f) => f.name === name)?.type;

  const values: Record<string, string> = {};
  cfg.editFields.forEach((fieldName, i) => {
    if (!fieldName) return; // kolom formula
    const header = cfg.append.expectedHeaders[i];
    let v = String(actualByNorm[normHeader(header)] ?? '').trim();
    const t = typeOf(fieldName);
    if (t === 'date' && v) v = toISODateFlexible(v) ?? '';
    if (t === 'time' && v) {
      const m = v.match(/(\d{1,2}):(\d{2})/);
      v = m ? `${m[1].padStart(2, '0')}:${m[2]}` : v;
    }
    if (t === 'number' && v) v = v.replace(/[^0-9-]/g, '');
    values[fieldName] = v;
  });
  return values;
}

// ---- API utama ----

export async function listEntries(moduleId: string): Promise<EditEntry[]> {
  const cfg = EDIT_CONFIGS[moduleId];
  if (!cfg) throw new Error('Modul ini tidak punya fitur edit.');
  if (cfg.kind === 'custom') return cfg.list();

  const rows = await readTableWithRowNum(cfg.append.spreadsheetId, cfg.append.range);
  return rows
    .slice(-LIST_LIMIT)
    .reverse()
    .map(({ row, data }) => {
      const values = rowToValues(moduleId, cfg, data);
      const label = `Baris ${row} · ${cfg.labelFields.map((f) => values[f]).filter(Boolean).join(' · ')}`;
      return { ref: String(row), label, values };
    });
}

/** Simpan perubahan entri; return warning non-blokir (mis. "jurnal DB tidak ikut berubah") bila ada. */
export async function saveEntry(moduleId: string, ref: string, values: Record<string, unknown>): Promise<string | undefined> {
  const cfg = EDIT_CONFIGS[moduleId];
  if (!cfg) throw new Error('Modul ini tidak punya fitur edit.');
  if (cfg.kind === 'custom') return (await cfg.save(ref, values)) || undefined;

  const rowNum = parseInt(ref, 10);
  if (!Number.isInteger(rowNum) || rowNum < 2) throw new Error('Referensi baris tidak valid.');
  await assertHeaders(cfg.append.spreadsheetId, cfg.append.headerRange, cfg.append.expectedHeaders);
  const row = cfg.append.buildRow(values); // validasi & normalisasi SAMA dgn submit (anti-formula dijaga updateRange)
  const { sheetName, colStart, colEnd } = parseColRange(cfg.append.range);
  // Sel null (kolom formula) dilewati API update — formula di sheet tidak tertimpa.
  await updateRange(cfg.append.spreadsheetId, `'${sheetName}'!${colStart}${rowNum}:${colEnd}${rowNum}`, [row]);
  return undefined;
}
