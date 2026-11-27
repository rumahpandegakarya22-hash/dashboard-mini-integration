import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@libsql/client';
import { simpanKegiatanCleaning } from './kegiatan-cleaning';
import { DDL_KEGIATAN_CLEANING } from '../../kegiatan-cleaning/skema';
import { bacaFoto, serialisasiFoto, MAKS_FOTO } from '../../kegiatan-cleaning/foto';

// Transaksi libsql membuka koneksi baru; ':memory:' tidak dibagi antar koneksi → pakai berkas sementara.
const dbBaru = () => createClient({ url: `file:${join(mkdtempSync(join(tmpdir(), 'kc-')), 'uji.db')}` });

const URL1 = 'https://drive.google.com/file/d/AAAAAAAAAAAAAAAAAAAAAAAA/view';
const URL2 = 'https://drive.google.com/file/d/BBBBBBBBBBBBBBBBBBBBBBBB/view';

test('simpan: satu entri + foto berurutan, skema dibuat otomatis', async () => {
  const db = dbBaru();
  const id = await simpanKegiatanCleaning(db, {
    tanggal: '2026-11-27',
    petugas: 'Sari',
    catatan: null,
    oleh: 'sari',
    foto: [
      { jenis: 'Sapu', url: URL1 },
      { jenis: 'Pel', url: URL2 }
    ]
  });
  const h = (await db.execute({ sql: 'SELECT tanggal, petugas, dibuat_oleh FROM kegiatan_cleaning WHERE id = ?', args: [id] })).rows[0];
  assert.deepEqual({ ...h }, { tanggal: '2026-11-27', petugas: 'Sari', dibuat_oleh: 'sari' });
  const f = (await db.execute({ sql: 'SELECT jenis, urutan FROM kegiatan_cleaning_foto WHERE kegiatan_id = ? ORDER BY urutan', args: [id] })).rows;
  assert.deepEqual(f.map((r) => [r.jenis, Number(r.urutan)]), [['Sapu', 1], ['Pel', 2]]);
});

test('simpan: gagal di tengah → seluruh entri dibatalkan (tidak ada entri setengah jadi)', async () => {
  const db = dbBaru();
  await assert.rejects(
    simpanKegiatanCleaning(db, {
      tanggal: '2026-11-27',
      petugas: 'Sari',
      catatan: null,
      oleh: 'sari',
      foto: [
        { jenis: 'Sapu', url: URL1 },
        { jenis: 'Pel', url: null as unknown as string }
      ]
    })
  );
  assert.equal(Number((await db.execute('SELECT COUNT(*) AS n FROM kegiatan_cleaning')).rows[0].n), 0);
  assert.equal(Number((await db.execute('SELECT COUNT(*) AS n FROM kegiatan_cleaning_foto')).rows[0].n), 0);
});

test('DDL di kode sama dengan db/schema/038', () => {
  const norm = (t: string) => t.replace(/\s+/g, ' ').trim();
  const file = norm(readFileSync(new URL('../../../../db/schema/038_kegiatan_cleaning.sql', import.meta.url), 'utf8').replace(/^\s*--.*$/gm, ''));
  for (const ddl of DDL_KEGIATAN_CLEANING) assert.ok(file.includes(norm(ddl)), `DDL tidak sama: ${ddl.slice(0, 60)}`);
});

test('bacaFoto: nilai sah dibaca, jenis dirapikan', () => {
  const raw = serialisasiFoto([{ jenis: '  Cuci   karpet ', url: URL1 }]);
  assert.deepEqual(bacaFoto(raw), [{ jenis: 'Cuci karpet', url: URL1 }]);
});

test('bacaFoto: kosong, rusak, tanpa jenis, bukan Drive, atau kebanyakan → ditolak', () => {
  assert.throws(() => bacaFoto(''), /wajib diisi/);
  assert.throws(() => bacaFoto('bukan json'), /wajib diisi/);
  assert.throws(() => bacaFoto('[]'), /wajib diisi/);
  assert.throws(() => bacaFoto(JSON.stringify([{ jenis: '', url: URL1 }])), /jenis kegiatan/);
  assert.throws(() => bacaFoto(JSON.stringify([{ jenis: 'Sapu', url: 'https://evil.example/x.jpg' }])), /belum terunggah/);
  assert.throws(() => bacaFoto(JSON.stringify([{ jenis: 'Sapu', url: '' }])), /belum terunggah/);
  const banyak = Array.from({ length: MAKS_FOTO + 1 }, () => ({ jenis: 'Sapu', url: URL1 }));
  assert.throws(() => bacaFoto(JSON.stringify(banyak)), /Maksimal/);
});
