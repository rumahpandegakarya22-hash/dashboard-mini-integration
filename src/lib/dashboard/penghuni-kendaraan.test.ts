import test from 'node:test';
import assert from 'node:assert/strict';
import { derivePenghuni } from './source';
import { hydratePenghuni } from './views/hydrate';

const tables = {
  kamar: [{ no_kamar: 5, tipe_kamar: 'Eco (Non AC)' }],
  booking: [
    { no_booking: 'BK-1', id_penghuni: 'KTD-1', nama_penyewa: 'Rina', kamar_no: 5, tgl_masuk: '2026-07-01', durasi_bulan: 3, status_booking: 'Check-in', no_hp: '0812' }
  ],
  active_tenant: [
    { id_penghuni: 'KTD-1', nama_lengkap: 'Rina', no_kamar: '5', nopol: 'AB 1234 CD', nama_kendaraan: 'Honda Beat' },
    { id_penghuni: 'KTD-2', nama_lengkap: 'Sari', no_kamar: '6', nopol: 'B 99 XY', nama_kendaraan: 'Vario' }
  ]
};

test('daftar penghuni memuat nopol dan kendaraan (penghuni dari booking dan penghuni lama)', () => {
  const grid = derivePenghuni(tables as any);
  assert.ok(grid[0].includes('Nopol') && grid[0].includes('Kendaraan'));
  const out = hydratePenghuni({ 'PENGHUNI (dari Booking)': grid } as any);
  const rina = out.find((p) => p.nama === 'Rina')!;
  const sari = out.find((p) => p.nama === 'Sari')!;
  assert.equal(rina.nopol, 'AB 1234 CD');
  assert.equal(rina.kendaraan, 'Honda Beat');
  assert.equal(sari.nopol, 'B 99 XY');
});

test('penghuni tanpa kendaraan menghasilkan teks kosong', () => {
  const grid = derivePenghuni({ ...tables, active_tenant: [{ id_penghuni: 'KTD-1', nama_lengkap: 'Rina', no_kamar: '5' }] } as any);
  const out = hydratePenghuni({ 'PENGHUNI (dari Booking)': grid } as any);
  assert.equal(out[0].nopol, '');
});
