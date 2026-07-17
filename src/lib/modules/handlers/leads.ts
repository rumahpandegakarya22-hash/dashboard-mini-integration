import { createAppendHandler, type AppendConfig } from './helpers';
import { SHEETS } from '@/config/spreadsheets';
import { parseDateISO, parseRupiah, normalizePhone, required } from '../../validate';

// Sheet "Log Leads Harian" di Log Marketing. Header DIKONFIRMASI dari sheet asli yang dibuat user
// (8 Jul) — BUKAN lagi rancangan agregat-harian PRD awal (Tanggal/Kanal/Jumlah Leads/dst). Struktur
// nyata: per-lead (CRM-style), 12 kolom A:L.
const EXPECTED_HEADERS = [
  'Tanggal',
  'Nama Leads',
  'No. HP / WA',
  'Sumber Leads',
  'Platform',
  'Jenis Kamar Dicari',
  'Budget (Rp)',
  'Check-in Rencana',
  'Status Leads',
  'Tindak Lanjut',
  'PIC / CS',
  'Waktu Follow-up'
];

export const leadsAppendCfg: AppendConfig = {
  spreadsheetId: SHEETS.LOG_MARKETING,
  range: "'Log Leads Harian'!A:L",
  headerRange: "'Log Leads Harian'!A1:L1",
  expectedHeaders: EXPECTED_HEADERS,
  target: 'Log Marketing → Log Leads Harian',
  buildRow: (values) => {
    const tanggal = parseDateISO(String(values.tanggal ?? ''));
    const namaLeads = required(values.namaLeads, 'Nama Leads');
    const noHp = normalizePhone(String(values.noHp ?? ''));
    const sumberLeads = required(values.sumberLeads, 'Sumber Leads');
    const platform = String(values.platform ?? '').trim();
    const jenisKamarDicari = String(values.jenisKamarDicari ?? '').trim();
    const budget = values.budget ? parseRupiah(values.budget as string | number) : 0;
    const checkinRencana = values.checkinRencana ? parseDateISO(String(values.checkinRencana)) : '';
    const statusLeads = required(values.statusLeads, 'Status Leads');
    const tindakLanjut = String(values.tindakLanjut ?? '').trim();
    const picCs = String(values.picCs ?? '').trim();
    const waktuFollowUp = values.waktuFollowUp ? parseDateISO(String(values.waktuFollowUp)) : '';
    return [
      tanggal,
      namaLeads,
      `'${noHp}`, // apostrof: paksa Sheets simpan sebagai TEKS, bukan angka
      sumberLeads,
      platform,
      jenisKamarDicari,
      budget,
      checkinRencana,
      statusLeads,
      tindakLanjut,
      picCs,
      waktuFollowUp
    ];
  }
};

export const submitLeads = createAppendHandler(leadsAppendCfg);
