// Kirim ulang invoice ke penghuni — jalankan dari root project:
//   npx tsx src/scripts/resend-invoice.ts <noInv> <Sewa|DP>
// Contoh:
//   npx tsx src/scripts/resend-invoice.ts "INV/23/TDU/8/2026" Sewa

// Load env sebelum import modul lain agar turso/brevo terbaca
import { existsSync, readFileSync } from 'fs';
const envFile = '.env.local';
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^([^#=\s]+)\s*=\s*(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

import { kirimInvoice } from '../lib/invoice';

async function main() {
  const noInv = process.argv[2];
  const jenis = (process.argv[3] || 'Sewa') as 'DP' | 'Sewa';

  if (!noInv) {
    console.error('Usage: npx tsx src/scripts/resend-invoice.ts <noInv> <Sewa|DP>');
    process.exit(1);
  }

  console.log(`Kirim ulang invoice ${noInv} (${jenis})...`);
  const hasil = await kirimInvoice(noInv, jenis);
  console.log(hasil.terkirim ? '✓' : '✗', hasil.pesan);
  if (!hasil.terkirim) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
