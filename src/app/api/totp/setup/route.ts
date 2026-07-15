import { NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import QRCode from 'qrcode';
import { getClerkSessionUser } from '@/lib/auth';
import { generateTotpSecret } from '@/lib/totp';
import { rateLimitOk } from '@/lib/redis';

/** Mulai pendaftaran 2FA: buat secret baru (pending) + QR utk discan Google Authenticator. */
export async function POST() {
  const sess = await getClerkSessionUser();
  if (!sess) return NextResponse.json({ error: 'Belum login / akun belum aktif.' }, { status: 401 });
  if (!(await rateLimitOk(`totp:setup:${sess.user.id}`, 5, 300))) {
    return NextResponse.json({ error: 'Terlalu banyak percobaan. Tunggu beberapa menit.' }, { status: 429 });
  }

  const label = `Kost Tiga Dara Mini App (${sess.user.username || sess.user.id})`;
  const secret = generateTotpSecret(label);

  const client = await clerkClient();
  await client.users.updateUserMetadata(sess.user.id, { privateMetadata: { totpPendingSecret: secret.base32 } });

  const qrDataUrl = await QRCode.toDataURL(secret.otpauthUrl, { margin: 1, width: 220 });
  return NextResponse.json({ ok: true, secret: secret.base32, uri: secret.otpauthUrl, qrDataUrl });
}
