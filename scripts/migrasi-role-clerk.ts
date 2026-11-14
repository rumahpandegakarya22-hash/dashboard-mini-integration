/* =========================================================================
   Migrasi kunci role Clerk ke daftar role bersama (lib/core/roles.ts).

   Yang diubah: HANYA nilai publicMetadata.role (Dashboard) dan
   publicMetadata.miniappRole (Mini App Ops) yang masih memakai kunci lama
   (admin, staff_admin, staff_finance, staff_maintenance, staff_inspeksi,
   staff_cleaning, staff_sales, staff_marketing). Status (status/miniappStatus)
   TIDAK pernah disentuh, jadi tidak ada akun yang dibuka atau dikunci.

   Akun yang role Dashboard-nya beda dengan role Mini App-nya (setelah
   diterjemahkan) = KONFLIK. Konflik tidak ditebak: dilaporkan dan dilewati,
   kecuali diputuskan lewat --resolve <username>=<role>.

   Default DRY-RUN (tidak menulis apa pun).
       npx tsx scripts/migrasi-role-clerk.ts
       npx tsx scripts/migrasi-role-clerk.ts --resolve budi=sales
       npx tsx scripts/migrasi-role-clerk.ts --apply [--resolve budi=sales ...]
   ========================================================================= */
import './_env';
import { createClerkClient } from '@clerk/nextjs/server';
import { normalizeRole, isDashboardRole, ROLES, type Role } from '../src/lib/core/roles';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const resolusi = new Map<string, Role>();
for (let i = 0; i < args.length; i++) {
  if (args[i] !== '--resolve') continue;
  const [u, r] = String(args[i + 1] ?? '').split('=');
  if (!u || !(ROLES as readonly string[]).includes(r)) {
    console.error(`--resolve tidak valid: "${args[i + 1]}" (format: username=role, role salah satu: ${ROLES.join(', ')})`);
    process.exit(1);
  }
  resolusi.set(u.toLowerCase(), r as Role);
}

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

  let ubah = 0, sudah = 0, tanpaRole = 0;
  const konflik: string[] = [];

  for (const u of users) {
    const nama = u.username || u.emailAddresses[0]?.emailAddress || u.id;
    const m = (u.publicMetadata ?? {}) as Record<string, unknown>;
    const rawDash = typeof m.role === 'string' ? m.role : null;
    const rawOps = typeof m.miniappRole === 'string' ? m.miniappRole : null;
    if (!rawDash && !rawOps) { tanpaRole++; continue; }

    const dash = normalizeRole(rawDash);
    const ops = normalizeRole(rawOps);
    if ((rawDash && !dash) || (rawOps && !ops)) {
      console.log(`? ${nama}: role tidak dikenal (role=${rawDash}, miniappRole=${rawOps}), dilewati`);
      continue;
    }

    let target: Role | null = dash ?? ops;
    if (dash && ops && dash !== ops) {
      const pilihan = resolusi.get(nama.toLowerCase());
      if (!pilihan) {
        konflik.push(`${nama}: Dashboard=${rawDash} (${dash}) vs Mini App=${rawOps} (${ops})`);
        continue;
      }
      target = pilihan;
    }

    const patch: Record<string, string> = {};
    if (rawDash && target && isDashboardRole(target) && rawDash !== target) patch.role = target;
    if (rawOps && target && rawOps !== target) patch.miniappRole = target;
    if (rawDash && target && !isDashboardRole(target)) {
      console.log(`? ${nama}: role Dashboard=${rawDash} tapi target ${target} tidak berlaku di Dashboard, dilewati`);
      continue;
    }
    if (!Object.keys(patch).length) { sudah++; continue; }

    ubah++;
    console.log(`${apply ? 'UBAH' : 'akan ubah'} ${nama}: ${JSON.stringify({ role: rawDash, miniappRole: rawOps })} -> ${JSON.stringify(patch)}`);
    if (apply) await clerk.users.updateUserMetadata(u.id, { publicMetadata: patch });
  }

  console.log(`\nAkun: ${users.length} | diubah: ${ubah} | sudah benar: ${sudah} | tanpa role: ${tanpaRole} | konflik: ${konflik.length}`);
  if (konflik.length) {
    console.log('\nKONFLIK (dilewati, putuskan dengan --resolve username=role):');
    for (const k of konflik) console.log('  - ' + k);
  }
  if (!apply) console.log('\nDRY-RUN: belum ada yang ditulis. Tambahkan --apply setelah laporan ini kamu setujui.');
}

main().catch((e) => { console.error(e); process.exit(1); });
