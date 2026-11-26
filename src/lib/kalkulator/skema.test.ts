import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { skemaInput, skemaSimpan, skemaHapus, parseData, hanyaOwner } from './skema';
import { DDL_KALKULATOR } from './skema-db';
import { SKENARIO_DEFAULT } from './default';
import type { SkenarioInput } from './tipe';

const salin = (): SkenarioInput => structuredClone(SKENARIO_DEFAULT);
const ditolak = (ubah: (s: any) => void, pesan: string) => {
  const s: any = salin();
  ubah(s);
  assert.equal(skemaInput.safeParse(s).success, false, pesan);
};

test('skenario default lolos validasi', () => {
  assert.equal(skemaInput.safeParse(SKENARIO_DEFAULT).success, true);
  assert.equal(skemaSimpan.safeParse({ nama: 'Dasar', data: SKENARIO_DEFAULT }).success, true);
  assert.equal(skemaSimpan.safeParse({ id: 3, nama: 'Dasar', data: SKENARIO_DEFAULT }).success, true);
  assert.equal(skemaHapus.safeParse({ id: 3, hapus: true }).success, true);
});

test('menolak angka di luar batas', () => {
  ditolak((s) => (s.tipeKamar[0].alatListrik[0].watt = -1), 'watt negatif');
  ditolak((s) => (s.tipeKamar[0].alatListrik[0].jamPerHari = 25), 'jam > 24');
  ditolak((s) => (s.tipeKamar[0].alatListrik[0].faktorPemakaian = 0), 'faktor 0');
  ditolak((s) => (s.umum.hariPerBulan = 32), 'hari 32');
  ditolak((s) => (s.tipeKamar[0].hargaSewa = 1e11), 'harga > 1e10');
  ditolak((s) => (s.tipeKamar[0].kamarTerisi = 26), 'terisi > jumlah kamar');
  ditolak((s) => (s.tipeKamar[0].jumlahKamar = 1001), 'kamar > 1000');
  ditolak((s) => (s.umum.tarifListrik = Number.NaN), 'NaN');
  ditolak((s) => (s.umum.tarifListrik = '1444'), 'string angka');
  ditolak((s) => (s.fasum = Array.from({ length: 51 }, () => s.fasum[0])), 'array 51 baris');
  ditolak((s) => (s.fasum[0].nama = 'x'.repeat(81)), 'nama baris 81 karakter');
});

test('menolak field asing', () => {
  ditolak((s) => (s.umum.rahasia = 1), 'field ekstra di umum');
  ditolak((s) => (s.ekstra = true), 'field ekstra di akar');
  assert.equal(skemaSimpan.safeParse({ nama: 'a', data: SKENARIO_DEFAULT, role: 'owner' }).success, false);
});

test('nama skenario 1–80 karakter', () => {
  assert.equal(skemaSimpan.safeParse({ nama: '', data: SKENARIO_DEFAULT }).success, false);
  assert.equal(skemaSimpan.safeParse({ nama: '   ', data: SKENARIO_DEFAULT }).success, false);
  assert.equal(skemaSimpan.safeParse({ nama: 'x'.repeat(81), data: SKENARIO_DEFAULT }).success, false);
  assert.equal(skemaSimpan.safeParse({ nama: 'x'.repeat(80), data: SKENARIO_DEFAULT }).success, true);
  assert.equal(skemaHapus.safeParse({ id: 0, hapus: true }).success, false);
  assert.equal(skemaHapus.safeParse({ id: 1.5, hapus: true }).success, false);
});

test('parseData membuang JSON rusak atau tidak valid', () => {
  assert.equal(parseData('{rusak'), null);
  assert.equal(parseData(JSON.stringify({ umum: {} })), null);
  assert.deepEqual(parseData(JSON.stringify(SKENARIO_DEFAULT)), SKENARIO_DEFAULT);
});

test('hanya owner', () => {
  assert.equal(hanyaOwner('owner'), true);
  for (const r of ['pengawas', 'admin_finance', 'sales', 'marketing', 'operasional', '']) assert.equal(hanyaOwner(r), false);
});

test('file migrasi 037 memuat DDL yang sama dengan kode', () => {
  const rapi = (s: string) => s.replace(/--.*$/gm, '').replace(/\s+/g, ' ').trim();
  const sql = rapi(fs.readFileSync(path.join(process.cwd(), 'db/schema/037_kalkulator_skenario.sql'), 'utf8'));
  for (const ddl of DDL_KALKULATOR) assert.ok(sql.includes(rapi(ddl)), `tidak ada di file: ${rapi(ddl).slice(0, 60)}`);
});
