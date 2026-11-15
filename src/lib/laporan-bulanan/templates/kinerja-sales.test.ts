import test from 'node:test';
import assert from 'node:assert/strict';
import type { DataKinerjaSales } from '../builders/sales';
import { susunSales, klasifikasiBooking } from '../builders/sales';
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
    kpi: [
      { nama: 'Konversi Leads → Survey', nilai: '92,5 %', target: '≥ 90 %', status: 'tercapai' },
      { nama: 'Cancellation Rate', nilai: '33,3 %', target: '≤ 20 %', status: 'belum' },
      { nama: 'Waiting List (antrean saat ini)', nilai: '3 orang', target: '5 orang', status: 'info' },
    ],
  };
}

test('sales: header, periode, bagian dan label', () => {
  const h = htmlKinerjaSales(dasar());
  assert.match(h, /LAPORAN KINERJA SALES/);
  assert.match(h, /Kost Tiga Dara Putri UGM/);
  assert.ok(h.includes('Periode: Juni 2026   |   Dibuat: 05 Jul 2026 14:15'));
  for (const s of [
    'A. Indikator Kinerja Sales — Juni 2026', 'B. Aktivitas Booking — Juni 2026', 'Booking Check-in', 'Booking Konfirmasi', 'Booking Dibatalkan',
    'Nilai Booking (non-batal)', 'Sumber Leads Teratas',
  ]) assert.ok(h.includes(s), s);
  for (const hilang of ['Konversi Minat', 'Tertarik / Lanjut', 'Aktivitas Survey']) assert.ok(!h.includes(hilang), hilang);
  for (const k of ['Tgl', 'Nama', 'Kamar', 'Status', 'Harga', 'Sumber']) assert.ok(h.includes(`<th>${k}</th>`), k);
  assert.match(h, /<td>Sumber Leads Teratas<\/td><td>Mami Kos \(2\)<\/td>/);
  assert.match(h, /<td>Nilai Booking \(non-batal\)<\/td><td>Rp4\.000\.000<\/td>/);
  assert.match(h, /<td>Konversi Leads → Survey<\/td><td>92,5 %<\/td><td>≥ 90 %<\/td><td><span class="pil pil-baik">Tercapai<\/span><\/td>/);
  assert.match(h, /<td>Cancellation Rate<\/td><td>33,3 %<\/td><td>≤ 20 %<\/td><td><span class="pil pil-buruk">Belum tercapai<\/span><\/td>/);
  assert.match(h, /<td>Waiting List \(antrean saat ini\)<\/td><td>3 orang<\/td><td>5 orang<\/td><td><span class="pil pil-netral">–<\/span><\/td>/);
  assert.match(h, /<td>03 Jun 2026<\/td><td>Rina<\/td><td>5<\/td><td>Check-in<\/td><td>Rp2\.000\.000<\/td><td>Mami Kos<\/td>/);
  assert.match(h, /Dibuat oleh,[\s\S]*Staf Divisi[\s\S]*Mengetahui,[\s\S]*Pengelola Kost/);
});

test('sales: bulan kosong utuh, tanpa NaN', () => {
  const d = susunSales(periode, dibuat, []);
  const h = htmlKinerjaSales(d);
  assert.match(h, /Tidak ada booking pada periode ini\./);
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
