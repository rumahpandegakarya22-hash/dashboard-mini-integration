import type { BookingRow, LeadRow, Pill, SurveyRow } from './types';

export interface ProspekRow {
  check: boolean;
  name: string;
  tahap: Pill;
  wa: string;
  pertimbangan: string;
  asal: string;
  tanggal: string;
}

const hp = (v: unknown): string => {
  const d = String(v ?? '').replace(/\D/g, '');
  return d.startsWith('0') ? `62${d.slice(1)}` : d;
};
const nm = (v: unknown): string => String(v ?? '').trim().toLowerCase();
const batal = (s: unknown) => /batal|cancel/i.test(String(s ?? ''));

/**
 * Prospek = orang yang masih di corong sebelum booking: leads yang belum survey
 * ditambah yang sudah survey tetapi belum booking. Satu orang satu baris
 * (dicocokkan dari nomor HP); yang sudah punya booking aktif tidak ikut.
 */
export function buildProspek(leads: LeadRow[], survey: SurveyRow[], booking: BookingRow[]): ProspekRow[] {
  const sudahBooking = new Set(booking.filter((b) => !batal(b.status)).map((b) => nm(b.nama)));
  const surveyHp = new Set(survey.map((s) => hp(s.wa)).filter(Boolean));

  const dariSurvey: ProspekRow[] = survey
    .filter((s) => !sudahBooking.has(nm(s.nama)))
    .map((s) => ({
      check: false,
      name: s.nama,
      tahap: { t: 'Survey', c: 's-progress' },
      wa: s.wa,
      pertimbangan: s.pertimbangan,
      asal: s.asal,
      tanggal: s.tanggal
    }));

  const dariLeads: ProspekRow[] = leads
    .filter((l) => l.status.t !== 'Closing' && !sudahBooking.has(nm(l.name)) && !surveyHp.has(hp(l.wa)))
    .map((l) => ({
      check: false,
      name: l.name,
      tahap: { t: 'Leads', c: 's-leads' },
      wa: l.wa,
      pertimbangan: '',
      asal: l.asal,
      tanggal: l.tanggal
    }));

  return [...dariSurvey, ...dariLeads].sort((a, b) => String(b.tanggal).localeCompare(String(a.tanggal)));
}
