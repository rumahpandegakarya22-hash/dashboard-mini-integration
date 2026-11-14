/* =========================================================================
   Pindahkan akun Pengawas dari Mini App Ops ke Dashboard (Clerk).

   Yang diubah (hanya akun dengan role Pengawas):
     - publicMetadata.role         = 'pengawas'  (namespace Dashboard)
     - publicMetadata.status       = status Mini App-nya bila Dashboard belum aktif
     - publicMetadata.miniappRole  = dihapus      (akses Mini App Ops dicabut)
   miniappStatus tidak disentuh.

   Default DRY-RUN.
       npx tsx scripts/migrasi-pengawas-ke-dashboard.ts
       npx tsx scripts/migrasi-pengawas-ke-dashboard.ts --apply
   ========================================================================= */
import './_env';
import { createClerkClient } from '@clerk/nextjs/server';
import { normalizeRole } from '../src/lib/core/roles';

const apply = process.argv.includes('--apply');

async function main() {
  if (!process.env.CLERK_SECRET_KEY) {
    console.error('CLERK_SECRET_KEY belum di-set di .env.local.');
    process.exit(1);
  }
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

  const users = [];
  for (let offset = 0; ; offset += 100) {
    const { data } = await clerk.users.getUserList({ limit: 100, offset });
    users.push(...data);
    if (data.length < 100) break;
  }

  let ubah = 0;
  for (const u of users) {
    const m = (u.publicMetadata ?? {}) as Record<string, unknown>;
    const ops = normalizeRole(m.miniappRole);
    const dash = normalizeRole(m.role);
    if (ops !== 'pengawas' && dash !== 'pengawas') continue;

    const nama = u.username || u.emailAddresses[0]?.emailAddress || u.id;
    const patch: Record<string, unknown> = { role: 'pengawas', miniappRole: null };
    if (m.status !== 'active' && m.miniappStatus === 'active') patch.status = 'active';

    ubah++;
    console.log(`${apply ? 'UBAH' : 'akan ubah'} ${nama}: ${JSON.stringify({ role: m.role, miniappRole: m.miniappRole, status: m.status, miniappStatus: m.miniappStatus })} -> ${JSON.stringify(patch)}`);
    if (apply) await clerk.users.updateUserMetadata(u.id, { publicMetadata: patch });
  }

  console.log(`\nAkun: ${users.length} | Pengawas diubah: ${ubah}`);
  if (!apply) console.log('DRY-RUN: belum ada yang ditulis. Tambahkan --apply untuk menerapkan.');
}

main().catch((e) => { console.error(e); process.exit(1); });
