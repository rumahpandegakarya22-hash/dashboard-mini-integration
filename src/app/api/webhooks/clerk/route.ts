import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { clerkClient } from '@clerk/nextjs/server';

/**
 * Webhook Clerk: akun baru (user.created) → tandai status Mini App "pending"
 * secara eksplisit. OPSIONAL — tanpa webhook pun akun tanpa miniappStatus
 * diperlakukan 'pending' oleh getAuthState (default aman). Endpoint terpisah
 * dari webhook dashboard: tambah endpoint baru di Clerk Dashboard → Webhooks
 * utk domain Mini App, lalu isi CLERK_WEBHOOK_SIGNING_SECRET dgn secret-nya.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  if (!secret) return NextResponse.json({ error: 'Webhook belum dikonfigurasi.' }, { status: 503 });

  const svixId = req.headers.get('svix-id');
  const svixTimestamp = req.headers.get('svix-timestamp');
  const svixSignature = req.headers.get('svix-signature');
  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Header webhook tidak lengkap.' }, { status: 400 });
  }

  const body = await req.text();
  let evt: { type: string; data: { id: string; username?: string | null } };
  try {
    evt = new Webhook(secret).verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature
    }) as typeof evt;
  } catch (e: any) {
    return NextResponse.json({ error: 'Verifikasi webhook gagal: ' + (e?.message || '') }, { status: 400 });
  }

  if (evt.type === 'user.created') {
    try {
      const client = await clerkClient();
      await client.users.updateUserMetadata(evt.data.id, { publicMetadata: { miniappStatus: 'pending' } });
      console.log(`[clerk] akun baru "${evt.data.username || evt.data.id}" → miniappStatus pending, menunggu approval Owner.`);
    } catch (e) {
      console.error('[clerk] gagal set status pending:', e);
    }
  }
  return NextResponse.json({ ok: true });
}
