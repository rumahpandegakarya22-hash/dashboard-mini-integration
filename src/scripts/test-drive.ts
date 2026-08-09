import { existsSync, readFileSync } from 'fs';
if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^([^#=\s]+)\s*=\s*(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

import { google } from 'googleapis';

async function main() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!;
  const key = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  const folderId = process.env.DRIVE_FOLDER_INVOICE_SEWA!;

  console.log('SA email:', email ? email.slice(0, 40) + '...' : '✗ tidak ada');
  console.log('Folder  :', folderId || '✗ tidak ada');

  const auth = new google.auth.JWT({ email, key, scopes: ['https://www.googleapis.com/auth/drive'] });
  const drive = google.drive({ version: 'v3', auth });

  try {
    const r = await drive.files.get({ fileId: folderId, fields: 'id,name', supportsAllDrives: true });
    console.log('✓ Service account bisa akses folder:', r.data.name);
  } catch (e: any) {
    console.log('✗ Gagal akses folder:', e.message);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
