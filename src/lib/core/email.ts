import { gmailClient, withRetry } from './google';

export type Lampiran = { namaFile: string; mime: string; isi: Buffer };

/**
 * Kirim email HTML (opsional dengan lampiran) lewat Gmail API — pengganti
 * MailApp.sendEmail di Apps Script. Pengirimnya akun Google pemilik refresh
 * token (userId 'me'), sama dengan akun yang dulu menjalankan Apps Script,
 * jadi penghuni tidak melihat perubahan alamat.
 *
 * Butuh scope gmail.send pada refresh token — lihat catatan di core/google.ts.
 */
export async function kirimEmail(opts: {
  to: string;
  subject: string;
  html: string;
  lampiran?: Lampiran[];
}): Promise<void> {
  const raw = Buffer.from(buatMime(opts))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  await withRetry(() => gmailClient().users.messages.send({ userId: 'me', requestBody: { raw } }));
}

/**
 * Susun pesan RFC 2822. Subject di-encode base64 karena judul invoice bisa memuat
 * karakter non-ASCII (nama penghuni), dan header mentah hanya boleh ASCII.
 * Tanpa lampiran pesannya satu bagian text/html; dengan lampiran jadi
 * multipart/mixed dengan boundary tetap.
 */
function buatMime({
  to,
  subject,
  html,
  lampiran = []
}: {
  to: string;
  subject: string;
  html: string;
  lampiran?: Lampiran[];
}): string {
  const kepala = [
    `To: ${sanitizeHeader(to)}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
    'MIME-Version: 1.0'
  ];

  if (!lampiran.length) {
    kepala.push('Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64');
    return `${kepala.join('\r\n')}\r\n\r\n${base64Baris(Buffer.from(html))}`;
  }

  const batas = 'batas_invoice_ktd';
  kepala.push(`Content-Type: multipart/mixed; boundary="${batas}"`);

  const bagian = [
    `--${batas}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    base64Baris(Buffer.from(html))
  ];

  for (const l of lampiran) {
    bagian.push(
      `--${batas}`,
      `Content-Type: ${l.mime}; name="${sanitizeHeader(l.namaFile)}"`,
      `Content-Disposition: attachment; filename="${sanitizeHeader(l.namaFile)}"`,
      'Content-Transfer-Encoding: base64',
      '',
      base64Baris(l.isi)
    );
  }
  bagian.push(`--${batas}--`);

  return `${kepala.join('\r\n')}\r\n\r\n${bagian.join('\r\n')}`;
}

/** base64 dipecah per 76 karakter sesuai batas panjang baris MIME. */
function base64Baris(buf: Buffer): string {
  return (buf.toString('base64').match(/.{1,76}/g) || []).join('\r\n');
}

/** Buang CR/LF supaya nilai dari database tidak bisa menyisipkan header tambahan. */
function sanitizeHeader(v: string): string {
  return v.replace(/[\r\n]/g, ' ').trim();
}
