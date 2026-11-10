import test from 'node:test';
import assert from 'node:assert/strict';
import type { DataKinerjaSales } from '../builders/sales';
import { susunSales, klasifikasiBooking, hasilTertarik } from '../builders/sales';
import { htmlKinerjaSales } from './kinerja-sales';
import { parsePeriode } from '../periode';

const periode = parsePeriode('2026-06', new Date('2026-11-02'));
const dibuat = new Date('2026-07-05T07:15:00Z');

function dasar(): DataKinerjaSales {
  return {
    periode, dibuat,
    checkIn: 1, konfirmasi: 1, batal: 1, nilaiBooking: 4000000, sumberTeratas: 'Mami Kos (2)',
    booking: [
      { tanggal: '2026-06-03', nama: 'Rina', kamar: '5', status: 'Check-in', harga: 2000000, sumber: 'Mami Kos' },
      { tanggal: '2026-06-10', nama: 'Sari', kamar: '7', status: 'Konfirmasi', harga: 2000000, sumber: 'Mami Kos' },
      { tanggal: '2026-06-12', nama: 'Dewi', kamar: '9', status: 'Dibatalkan', harga: 1500000, sumber: 'Referral' },
    ],
    survey: { total: 4, tertarik: 3, konversiPersen: 75 },
  };
}

test('sales: header, periode, bagian dan label', () => {
  const h = htmlKinerjaSales(dasar());
  assert.match(h, /LAPORAN KINERJA SALES/);
  assert.match(h, /Kost Tiga Dara Putri UGM/);
  assert.ok(h.includes('Periode: Juni 2026   |   Dibuat: 05 Jul 2026 14:15'));
  for (const s of [
    'A. Aktivitas Booking — Juni 2026', 'Booking Check-in', 'Booking Konfirmasi', 'Booking Dibatalkan',
    'Nilai Booking (non-batal)', 'Sumber Leads Teratas',
    'B. Aktivitas Survey / Leads — Juni 2026', 'Total Survey', 'Tertarik / Lanjut', 'Konversi Minat',
  ]) assert.ok(h.includes(s), s);
  for (const k of ['Tgl', 'Nama', 'Kamar', 'Status', 'Harga', 'Sumber']) assert.ok(h.includes(`<th>${k}</th>`), k);
  assert.match(h, /<td>Sumber Leads Teratas<\/td><td>Mami Kos \(2\)<\/td>/);
  assert.match(h, /<td>Nilai Booking \(non-batal\)<\/td><td>Rp4\.000\.000<\/td>/);
  assert.match(h, /<td>Konversi Minat<\/td><td>75%<\/td>/);
  assert.match(h, /<td>03 Jun 2026<\/td><td>Rina<\/td><td>5<\/td><td>Check-in<\/td><td>Rp2\.000\.000<\/td><td>Mami Kos<\/td>/);
  assert.match(h, /Dibuat oleh,[\s\S]*Staf Divisi[\s\S]*Mengetahui,[\s\S]*Pengelola Kost/);
});

test('sales: bulan kosong utuh, 0% bukan NaN', () => {
  const d = susunSales(periode, dibuat, [], []);
  const h = htmlKinerjaSales(d);
  assert.match(h, /Tidak ada booking pada periode ini\./);
  assert.match(h, /Tidak ada survey pada periode ini\./);
  assert.match(h, /<td>Konversi Minat<\/td><td>0%<\/td>/);
  assert.match(h, /<td>Sumber Leads Teratas<\/td><td>-<\/td>/);
  assert.match(h, /<td>Nilai Booking \(non-batal\)<\/td><td>Rp0<\/td>/);
  assert.ok(!h.includes('NaN'));
});

test('sales: teks database di-escape', () => {
  const d = dasar();
  d.booking[0].nama = '<img src=x onerror=1>';
  d.sumberTeratas = '"<i>" (2)';
  const h = htmlKinerjaSales(d);
  assert.ok(!h.includes('<img'));
  assert.ok(!h.includes('<i>'));
  assert.match(h, /&lt;img src=x onerror=1&gt;/);
});

test('klasifikasiBooking: nilai status nyata', () => {
  assert.equal(klasifikasiBooking('Check-in'), 'checkIn');
  assert.equal(klasifikasiBooking('Check-In'), 'checkIn');
  assert.equal(klasifikasiBooking('Check-out'), 'checkIn');
  assert.equal(klasifikasiBooking('Konfirmasi'), 'konfirmasi');
  assert.equal(klasifikasiBooking('Dibatalkan'), 'batal');
  assert.equal(klasifikasiBooking('Cancel'), 'batal');
  assert.equal(klasifikasiBooking('Pending'), 'lain');
  assert.equal(klasifikasiBooking(null), 'lain');
});

test('hasilTertarik: nilai dropdown nyata', () => {
  assert.equal(hasilTertarik('Tertarik- Lanjut'), true);
  assert.equal(hasilTertarik('Booking di Tempat'), true);
  assert.equal(hasilTertarik('Dalam pertimbangan'), false);
  assert.equal(hasilTertarik('Tidak Jadi'), false);
  assert.equal(hasilTertarik('Tidak hadir'), false);
  assert.equal(hasilTertarik(null), false);
});

const b = (status: string, harga: number, sumber: string | null, tanggal = '2026-06-05') =>
  ({ tanggal, nama: 'Rina', kamar: 5, status, harga, sumber });

test('susunSales: hitung status, nilai non-batal, status tak dikenal tetap tampil', () => {
  const d = susunSales(periode, dibuat, [
    b('Check-in', 1000, 'Mami Kos'), b('Check-Out', 2000, 'Mami Kos'), b('Konfirmasi', 3000, 'Referral'),
    b('Dibatalkan', 9000, 'Referral'), b('Pending', 500, null),
  ], []);
  assert.equal(d.checkIn, 2);
  assert.equal(d.konfirmasi, 1);
  assert.equal(d.batal, 1);
  assert.equal(d.nilaiBooking, 6500);
  assert.deepEqual(d.booking.map(x => x.status), ['Check-in', 'Check-Out', 'Konfirmasi', 'Dibatalkan', 'Pending']);
  assert.equal(d.booking[4].sumber, '-');
  assert.equal(d.booking[0].kamar, '5');
});

test('susunSales: sumber teratas, seri diurut abjad', () => {
  const d = susunSales(periode, dibuat, [
    b('Check-in', 1, 'Referral'), b('Check-in', 1, 'Mami Kos'), b('Check-in', 1, 'Referral'), b('Check-in', 1, 'Mami Kos'),
  ], []);
  assert.equal(d.sumberTeratas, 'Mami Kos (2)');
  assert.equal(susunSales(periode, dibuat, [b('Check-in', 1, null)], []).sumberTeratas, '-');
});

test('susunSales: konversi minat dibulatkan, 0 bila tanpa survey', () => {
  const s = (hasil: string) => ({ hasil });
  const d = susunSales(periode, dibuat, [], [s('Tertarik- Lanjut'), s('Tidak Jadi'), s('Tidak hadir')]);
  assert.deepEqual(d.survey, { total: 3, tertarik: 1, konversiPersen: 33 });
  assert.equal(susunSales(periode, dibuat, [], []).survey.konversiPersen, 0);
});
