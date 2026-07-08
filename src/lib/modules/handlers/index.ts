import type { SubmitHandler, PreviewHandler } from '../types';
import { submitPenghuniBaru } from './penghuni-baru';
import { submitPengeluaran } from './pengeluaran';
import { submitPembayaranSewa } from './pembayaran-sewa';
import { previewPembayaranSewa } from './pembayaran-sewa-preview';
import { submitSurvey } from './survey';
import { submitPerawatanPreventif } from './perawatan-preventif';
import { submitPerbaikanKorektif } from './perbaikan-korektif';
import { submitInspeksiFasilitas } from './inspeksi-fasilitas';
import { submitPindahKamar } from './pindah-kamar';
import { submitCheckout } from './checkout';
import { submitFeedback } from './feedback';
import { submitInspeksiKebersihan } from './inspeksi-kebersihan';
import { submitLeads } from './leads';
import { submitKonten } from './konten';
import { submitPromosi } from './promosi';

/**
 * Handler konkret per modul, ditambahkan modul-per-modul (Tahap 3: penghuni-baru,
 * pembayaran-sewa, pengeluaran; lalu Tahap 4-5 modul lain).
 *
 * Kontrak tiap handler: validasi bisnis → assertHeaders (kontrak kolom target) →
 * withLock(resource spesifik-modul, mis. `kamar:${id}` atau `penghuni:${id}`) →
 * appendRow/updateRange. Idempotency (claimRequestId) dan audit log sudah ditangani
 * generik oleh /api/submit/[moduleId]/route.ts — handler tidak perlu mengurusnya.
 */
export const HANDLERS: Record<string, SubmitHandler> = {
  'penghuni-baru': submitPenghuniBaru,
  pengeluaran: submitPengeluaran,
  'pembayaran-sewa': submitPembayaranSewa,
  survey: submitSurvey,
  'perawatan-preventif': submitPerawatanPreventif,
  'perbaikan-korektif': submitPerbaikanKorektif,
  'inspeksi-fasilitas': submitInspeksiFasilitas,
  'pindah-kamar': submitPindahKamar,
  checkout: submitCheckout,
  feedback: submitFeedback,
  'inspeksi-kebersihan': submitInspeksiKebersihan,
  leads: submitLeads,
  konten: submitKonten,
  promosi: submitPromosi
};

/** Handler preview (hitung tanpa efek samping) — cuma modul dgn ModuleMeta.hasPreview:true perlu entry di sini. */
export const PREVIEW_HANDLERS: Record<string, PreviewHandler> = {
  'pembayaran-sewa': previewPembayaranSewa
};
