// Buat/replace akun user di Upstash Redis.
// Pakai: node scripts/seed-user.mjs <username> <password> <role> "<Nama Lengkap>"
// Role: owner | pengawas | staff_admin | staff_sales | staff_marketing | staff_maintenance | staff_inspeksi
import { Redis } from '@upstash/redis';
import bcrypt from 'bcryptjs';
import { readFileSync, existsSync } from 'node:fs';

// muat .env.local sederhana
if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const [username, password, role, name] = process.argv.slice(2);
const ROLES = ['owner', 'pengawas', 'staff_admin', 'staff_sales', 'staff_marketing', 'staff_maintenance', 'staff_inspeksi'];

if (!username || !password || !ROLES.includes(role) || !name) {
  console.error('Pakai: node scripts/seed-user.mjs <username> <password> <role> "<Nama Lengkap>"');
  console.error('Role valid:', ROLES.join(' | '));
  process.exit(1);
}
if (password.length < 8) {
  console.error('Password minimal 8 karakter.');
  process.exit(1);
}

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
});

const passwordHash = bcrypt.hashSync(password, 10);
// Prefix miniapp: wajib - Upstash database ini dipakai bersama dashboard internal lain.
await redis.set(`miniapp:user:${username.toLowerCase()}`, {
  passwordHash,
  name,
  role,
  status: 'active',
  authProvider: 'password',
  createdAt: new Date().toISOString()
});
console.log(`OK: user "${username}" (${role}) dibuat/diperbarui.`);
