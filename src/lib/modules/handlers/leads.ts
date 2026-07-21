import { createInsertHandler, type InsertConfig } from './helpers';
import { parseDateISO, parseRupiahOptional, normalizePhone, required } from '../../core/validate';

/* Wave 2 migrasi Sheets → Turso: dulu append ke Log Marketing → 'Log Leads Harian'!A:L.
   Sekarang INSERT ke tabel `leads`. Pemetaan kolom sheet → Turso:
     Tanggal→tanggal, Nama Leads→nama_leads, No. HP / WA→no_hp_wa,
     Sumber Leads→sumber_leads, Platform→platform,
     Jenis Kamar Dicari→kamar_dicari, Budget (Rp)→budget,
     Check-in Rencana→checkin_rencana, Status Leads→status_leads,
     Tindak Lanjut→tindak_lanjut, PIC / CS→pic, Waktu Follow-up→tanggal_fu.
   Kolom `keterangan` tidak punya padanan field di modul — dibiarkan NULL. */
export const leadsInsertCfg: InsertConfig = {
  table: 'leads',
  target: 'Turso → leads',
  buildRow: (values) => ({
    tanggal: parseDateISO(String(values.tanggal ?? '')),
    nama_leads: required(values.namaLeads, 'Nama Leads'),
    no_hp_wa: normalizePhone(String(values.noHp ?? '')),
    sumber_leads: required(values.sumberLeads, 'Sumber Leads'),
    platform: String(values.platform ?? '').trim(),
    kamar_dicari: String(values.jenisKamarDicari ?? '').trim(),
    budget: parseRupiahOptional(values.budget),
    checkin_rencana: values.checkinRencana ? parseDateISO(String(values.checkinRencana)) : null,
    status_leads: required(values.statusLeads, 'Status Leads'),
    tindak_lanjut: String(values.tindakLanjut ?? '').trim(),
    pic: String(values.picCs ?? '').trim(),
    tanggal_fu: values.waktuFollowUp ? parseDateISO(String(values.waktuFollowUp)) : null
  })
};

export const submitLeads = createInsertHandler(leadsInsertCfg);
