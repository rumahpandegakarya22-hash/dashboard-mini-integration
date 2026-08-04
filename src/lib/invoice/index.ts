import { kirimEmail } from '../core/email';
import { getInvoiceDp, getInvoiceSewa } from './data';
import { htmlKePdf } from './pdf';
import { renderInvoiceDp, renderInvoiceSewa, tanggalId } from './template';

export type HasilKirimInvoice = { terkirim: boolean; email?: string; pesan: string };

/**
 * Ambil invoice dari Turso → render HTML → ubah jadi PDF → kirim sebagai
 * lampiran email. Menggantikan pemanggilan Web App Apps Script; tidak ada
 * layanan luar selain Gmail API.
 *
 * Sengaja TIDAK melempar error: pemanggilnya (submit pembayaran) memperlakukan
 * pengiriman invoice sebagai best-effort — pembayaran tetap tercatat walau email gagal.
 */
export async function kirimInvoice(noInv: string, jenis: 'DP' | 'Sewa'): Promise<HasilKirimInvoice> {
  try {
    const inv = jenis === 'Sewa' ? await getInvoiceSewa(noInv) : await getInvoiceDp(noInv);
    if (!inv) {
      return { terkirim: false, pesan: `Invoice ${noInv} tidak ditemukan di database — invoice tidak dikirim.` };
    }
    if (!inv.email) {
      return { terkirim: false, pesan: `Email penghuni ${inv.nama} kosong di database — invoice tidak dikirim.` };
    }

    const html = jenis === 'Sewa' ? renderInvoiceSewa(inv as any) : renderInvoiceDp(inv as any);
    const pdf = await htmlKePdf(html);

    await kirimEmail({
      to: inv.email,
      subject: `Invoice ${jenis} Kost Tiga Dara Putri UGM — ${inv.no_inv}`,
      html: badanEmail(inv.nama, jenis === 'Sewa' ? (inv as any).periode_awal : null, jenis === 'Sewa' ? (inv as any).periode_akhir : null),
      // Nomor invoice memuat '/' yang tidak sah di nama file — diganti '-'.
      lampiran: [{ namaFile: `Invoice ${inv.no_inv.replace(/\//g, '-')}.pdf`, mime: 'application/pdf', isi: pdf }]
    });

    return { terkirim: true, email: inv.email, pesan: `Invoice ${inv.no_inv} terkirim ke ${inv.email}.` };
  } catch (e: any) {
    console.error('[invoice] gagal kirim:', e?.message);
    return { terkirim: false, pesan: `Gagal mengirim invoice: ${e?.message || 'unknown error'} — kirim ulang dari menu invoice.` };
  }
}

/**
 * Badan email — sekadar pengantar, karena invoicenya ada di lampiran PDF.
 * Kalimat periode hanya muncul untuk invoice Sewa; DP tidak punya periode.
 */
function badanEmail(nama: string, periodeAwal: string | null, periodeAkhir: string | null): string {
  const periode =
    periodeAwal && periodeAkhir
      ? ` untuk periode ${tanggalId(periodeAwal)} s.d ${tanggalId(periodeAkhir)}`
      : '';

  return `<!DOCTYPE html><html lang="id"><body style="margin:0;padding:0;">
  <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#3a3635;max-width:560px;padding:16px;">
    <p style="margin:0 0 16px;">Halo Kak ${escHtml(nama)} !</p>
    <p style="margin:0 0 16px;">Terima kasih atas pembayarannya ya! Terlampir invoice resmi${escHtml(periode)}. Mohon disimpan ya, Kak, siapa tahu suatu saat dibutuhkan.</p>
    <p style="margin:0;">Salam,<br>Pengelola Kost Tiga Dara Putri UGM</p>
  </div>
</body></html>`;
}

function escHtml(v: string): string {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
