export type Lampiran = { namaFile: string; mime: string; isi: Buffer };

/**
 * Kirim email HTML (opsional dengan lampiran) lewat Brevo (Sendinblue) REST API.
 * Pengirim dikonfigurasi di Brevo dashboard sebagai verified sender.
 * Migrasi dari Gmail API — interface tidak berubah agar semua pemanggil tetap kompatibel.
 */
export async function kirimEmail(opts: {
  to: string | string[];
  subject: string;
  html: string;
  lampiran?: Lampiran[];
  cc?: string[];
}): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error('BREVO_API_KEY belum di-set di environment.');

  const senderEmail = process.env.BREVO_SENDER_EMAIL || 'noreply@kosttgadara.com';
  const senderName = process.env.BREVO_SENDER_NAME || 'Kost Tiga Dara';

  const tujuan = [...new Set((Array.isArray(opts.to) ? opts.to : [opts.to]).map((e) => sanitizeHeader(e)).filter(Boolean))];
  if (tujuan.length === 0) throw new Error('Alamat tujuan email kosong.');

  const body: Record<string, unknown> = {
    sender: { name: senderName, email: senderEmail },
    to: tujuan.map((email) => ({ email })),
    subject: opts.subject,
    htmlContent: opts.html
  };

  // Brevo menolak CC yang sama dengan penerima utama.
  const utama = new Set(tujuan.map((e) => e.toLowerCase()));
  const cc = [...new Set((opts.cc ?? []).map((e) => sanitizeHeader(e)).filter(Boolean))].filter(
    (e) => !utama.has(e.toLowerCase())
  );
  if (cc.length > 0) body.cc = cc.map((email) => ({ email }));

  if (opts.lampiran && opts.lampiran.length > 0) {
    body.attachment = opts.lampiran.map((l) => ({
      name: sanitizeHeader(l.namaFile),
      content: l.isi.toString('base64')
    }));
  }

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Brevo API error ${res.status}: ${detail}`);
  }
}

function sanitizeHeader(v: string): string {
  return v.replace(/[\r\n]/g, ' ').trim();
}
