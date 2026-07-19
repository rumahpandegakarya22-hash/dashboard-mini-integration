import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { clerkClient } from '@clerk/nextjs/server';

/**
 * Webhook Clerk TERPADU (§5.2): akun baru (user.created) ditandai `pending` di
 * KEDUA namespace sekaligus — `status` (Dashboard) dan `miniappStatus` (Ops).
 * Menggantikan dua webhook terpisah milik Dashboard & Mini App.
 *
 * Tanpa webhook pun akun tanpa metadata sudah diperlakukan 'pending' oleh
 * getAuthState (default aman); webhook membuatnya eksplisit dan terlihat di
 * panel Kelola Akun.
 *
 * TINDAKAN USER saat cutover (§11.4): di Clerk Dashboard → Webhooks, arahkan
 * SATU endpoint ke {DOMAIN}/api/webhooks/clerk dan hapus endpoint lama milik
 * kedua app, lalu pastikan CLERK_WEBHOOK_SIGNING_SECRET cocok dgn endpoint itu.
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
      // Satu panggilan, dua namespace. Clerk melakukan DEEP MERGE, jadi ini
      // hanya menambah kunci — tidak menimpa metadata lain milik akun.
      // `role: null` mengikuti perilaku webhook Dashboard lama (server.js).
      await client.users.updateUserMetadata(evt.data.id, {
        publicMetadata: { role: null, status: 'pending', miniappStatus: 'pending' }
      });
      console.log(
        `[clerk] akun baru "${evt.data.username || evt.data.id}" → pending di Dashboard & Ops, menunggu approval Owner.`
      );
    } catch (e) {
      console.error('[clerk] gagal set status pending:', e);
    }
  }
  return NextResponse.json({ ok: true });
}
