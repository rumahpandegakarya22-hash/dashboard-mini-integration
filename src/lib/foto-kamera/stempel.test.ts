import { test } from 'node:test';
import assert from 'node:assert/strict';
import { barisStempel, namaBerkasFoto, teksWaktuWib, ukuranKeluaran } from './stempel';

test('waktu stempel selalu WIB, tidak peduli zona perangkat', () => {
  // 07:32 UTC = 14:32 WIB
  assert.equal(teksWaktuWib(new Date('2026-11-27T07:32:05Z')), '27 Nov 2026 14:32 WIB');
});

test('lewat tengah malam WIB tanggalnya ikut maju', () => {
  // 18:10 UTC tgl 27 = 01:10 WIB tgl 28
  assert.equal(teksWaktuWib(new Date('2026-11-27T18:10:00Z')), '28 Nov 2026 01:10 WIB');
  assert.equal(teksWaktuWib(new Date('2026-12-31T17:00:00Z')), '01 Jan 2027 00:00 WIB');
});

test('baris stempel: waktu lalu nama; nama kosong tidak menambah baris', () => {
  const d = new Date('2026-11-27T07:32:05Z');
  assert.deepEqual(barisStempel(d, '  Sari   Wulandari '), ['27 Nov 2026 14:32 WIB', 'Sari Wulandari']);
  assert.deepEqual(barisStempel(d, '  '), ['27 Nov 2026 14:32 WIB']);
});

test('nama berkas memuat tanggal dan jam WIB', () => {
  assert.equal(namaBerkasFoto(new Date('2026-11-27T07:32:05Z')), 'foto-20261127-143205.jpg');
});

test('ukuran keluaran: dikecilkan proporsional, tidak pernah diperbesar', () => {
  assert.deepEqual(ukuranKeluaran(4000, 3000), { w: 1600, h: 1200 });
  assert.deepEqual(ukuranKeluaran(3000, 4000), { w: 1200, h: 1600 });
  assert.deepEqual(ukuranKeluaran(1280, 720), { w: 1280, h: 720 });
});
