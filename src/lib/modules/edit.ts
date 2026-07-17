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
// aman butuh proses void/koreksi sendiri), penghuni-baru/checkout/pengeluaran
// (efek samping status kamar & jurnal DB; menyusul bertahap), inspeksi-kebersihan
// (5 field form digabung jadi 4 kolom sheet — tidak bisa dibalik utuh).

import { readTableWithRowNum, updateRange, assertHeaders } from '../sheets';
import { turso, DIVISI_DB, TASK_STATUS } from '../turso';
import { toISODateFlexible } from '../validate';
import { MODULES } from './registry';
import type { AppendConfig } from './handlers/helpers';
import { surveyAppendCfg } from './handlers/survey';
import { leadsAppendCfg } from './handlers/leads';
import { kontenAppendCfg } from './handlers/konten';
import { promosiAppendCfg } from './handlers/promosi';
import { perawatanPreventifAppendCfg } from './handlers/perawatan-preventif';
import { perbaikanKorektifAppendCfg } from './handlers/perbaikan-korektif';
import { inspeksiFasilitasAppendCfg } from './handlers/inspeksi-fasilitas';
import { parseDateISO, required } from '../validate';

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

interface TursoEditCfg {
  kind: 'turso';
  list: () => Promise<EditEntry[]>;
  save: (ref: string, values: Record<string, unknown>) => Promise<void>;
}

type EditCfg = SheetEditCfg | TursoEditCfg;

// ---- Turso: Tugas Harian ----

const dailyTaskEdit: TursoEditCfg = {
  kind: 'turso',
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

function workOrderEdit(divisiAsal: 'Inspeksi' | 'Cleaning'): TursoEditCfg {
  return {
    kind: 'turso',
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

// ---- Registry edit config ----

export const EDIT_CONFIGS: Record<string, EditCfg> = {
  'daily-task': dailyTaskEdit,
  'wo-inspeksi': workOrderEdit('Inspeksi'),
  'wo-cleaning': workOrderEdit('Cleaning'),
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
  'perawatan-preventif': {
    kind: 'sheet',
    append: perawatanPreventifAppendCfg,
    editFields: ['tanggalJadwal', 'tanggalSelesai', 'fasilitasItem', 'jenisPerawatan', 'kategori', 'penyebab', 'deskripsi', 'prioritas', 'pelaksana', 'vendor', 'biaya', 'status', 'catatan'],
    labelFields: ['tanggalJadwal', 'fasilitasItem', 'status']
  },
  'perbaikan-korektif': {
    kind: 'sheet',
    append: perbaikanKorektifAppendCfg,
    editFields: ['tanggalKerusakan', 'tanggalLapor', 'tanggalSelesai', 'sumberLaporan', 'lokasiItem', 'kategori', 'penyebab', 'deskripsi', 'prioritas', 'pelaksana', 'vendor', 'biaya', 'status', 'catatan'],
    labelFields: ['tanggalKerusakan', 'lokasiItem', 'status']
  },
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
  if (cfg.kind === 'turso') return cfg.list();

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

export async function saveEntry(moduleId: string, ref: string, values: Record<string, unknown>): Promise<void> {
  const cfg = EDIT_CONFIGS[moduleId];
  if (!cfg) throw new Error('Modul ini tidak punya fitur edit.');
  if (cfg.kind === 'turso') return cfg.save(ref, values);

  const rowNum = parseInt(ref, 10);
  if (!Number.isInteger(rowNum) || rowNum < 2) throw new Error('Referensi baris tidak valid.');
  await assertHeaders(cfg.append.spreadsheetId, cfg.append.headerRange, cfg.append.expectedHeaders);
  const row = cfg.append.buildRow(values); // validasi & normalisasi SAMA dgn submit
  for (const v of row) {
    // updateRange tidak punya penjaga anti-formula spt appendRow — terapkan aturan yang sama di sini.
    if (typeof v === 'string' && v.trim().startsWith('=')) throw new Error('Input tidak boleh diawali "=".');
  }
  const { sheetName, colStart, colEnd } = parseColRange(cfg.append.range);
  // Sel null (kolom formula) dilewati API update — formula di sheet tidak tertimpa.
  await updateRange(cfg.append.spreadsheetId, `'${sheetName}'!${colStart}${rowNum}:${colEnd}${rowNum}`, [row]);
}
