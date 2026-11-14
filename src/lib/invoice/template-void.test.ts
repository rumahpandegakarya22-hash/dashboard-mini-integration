import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderInvoiceSewa } from './template';

const inv = {
  no_inv: 'INV-1', id_penghuni: 'KTD-1', nama: 'Tes', email: 'a@b.c', tanggal_pembayaran: '2026-11-01', periode_awal: '2026-11-01',
  periode_akhir: '2026-11-30', no_kamar: '5', tipe_kamar: 'Eco', jumlah_bulan: 1, jumlah_denda: 0, harga_sewa: 1000, tambahan_listrik: 0,
  denda: 0, total_sewa: 1000, total_listrik: 0, total_denda: 0, diskon: 0, pajak: 0, subtotal: 1000, grand_total: 1000
};

test('invoice biasa tidak bercap DIBATALKAN', () => {
  assert.ok(!renderInvoiceSewa(inv as never).includes('DIBATALKAN'));
});

test('invoice void bercap DIBATALKAN dan memuat alasan (di-escape)', () => {
  const html = renderInvoiceSewa(inv as never, 'salah <input>');
  assert.ok(html.includes('DIBATALKAN'));
  assert.ok(html.includes('salah &lt;input&gt;'));
});
