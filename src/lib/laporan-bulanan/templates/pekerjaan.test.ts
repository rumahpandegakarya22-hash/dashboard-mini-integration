import test from 'node:test';
import assert from 'node:assert/strict';
import { htmlPekerjaan } from './pekerjaan';
import { susunPekerjaan, type DataPekerjaan } from '../builders/pekerjaan';
import type { DailyTaskRow, Periode } from '../types';

const periode: Periode = { kode: '2026-06', dari: '2026-06-01', sampai: '2026-06-30', label: 'Juni 2026' };
const dibuat = new Date('2026-07-05T03:00:00Z');

function data(overrides: Partial<DataPekerjaan> = {}): DataPekerjaan {
  return {
    divisi: 'Admin',
    periode,
    dibuat,
    rows: [
      { tanggal: '2026-06-02', pekerjaan: 'Rekap absensi penghuni', pic: 'Rina', deadline: '2026-06-05', status: 'Selesai' },
      { tanggal: '2026-06-10', pekerjaan: 'Susun arsip kontrak', pic: 'Rina', deadline: null, status: 'Proses' },
      { tanggal: '2026-06-20', pekerjaan: 'Perbarui papan info', pic: 'Rina', deadline: '2026-06-25', status: 'Tertunda' },
    ],
    ...overrides,
  };
}

test('urutan judul, ringkasan, rincian, catatan, tanda tangan', () => {
  const h = htmlPekerjaan(data());
  const urut = [
    'LAPORAN PEKERJAAN BULANAN', 'DIVISI ADMIN — KOST TIGA DARA', 'Periode: Juni 2026',
    'Tanggal dibuat: 05/07/2026', 'A. RINGKASAN', 'Total Pekerjaan', 'Persentase Selesai', '33%',
    'B. RINCIAN PEKERJAAN', 'No', 'Tanggal', 'Pekerjaan', 'Bidang', 'PIC', 'Deadline', 'Status',
    'C. CATATAN / KENDALA', 'Dibuat oleh,', 'Staf ADMIN', 'Disetujui oleh,', 'Pengelola',
  ];
  let pos = 0;
  for (const s of urut) {
    const i = h.indexOf(s, pos);
    assert.ok(i >= 0, `tidak ditemukan berurutan: ${s}`);
    pos = i + s.length;
  }
  assert.ok(h.includes('.'.repeat(85)));
  assert.ok(!h.includes('.'.repeat(86)));
});

test('bulan kosong tetap utuh tanpa NaN', () => {
  const h = htmlPekerjaan(data({ rows: [] }));
  assert.ok(h.includes('(tidak ada data pada periode ini)'));
  assert.ok(h.includes('0%'));
  assert.ok(!h.includes('NaN'));
});

test('teks database di-escape', () => {
  const h = htmlPekerjaan(data({
    rows: [{ tanggal: '2026-06-02', pekerjaan: '<script>x</script>', pic: 'Rina', deadline: null, status: 'Selesai' }],
  }));
  assert.ok(!h.includes('<script>x</script>'));
  assert.ok(h.includes('&lt;script&gt;'));
});

test('susunPekerjaan memetakan Finance ke Keuangan', () => {
  const rowsDb: DailyTaskRow[] = [
    { id: 1, tanggal: '2026-06-03', task: 'Rekap kas kecil', pic: null, divisi: 'Finance', deadline: null, status: 'Complete' },
  ];
  const d = susunPekerjaan('Keuangan', periode, dibuat, rowsDb);
  assert.equal(d.rows[0].status, 'Selesai');
  assert.equal(d.rows[0].pic, '-');
  const h = htmlPekerjaan(d);
  assert.ok(h.includes('Keuangan'));
  assert.ok(h.includes('Staf KEUANGAN'));
  assert.ok(h.includes('DIVISI KEUANGAN'));
});

test('deadline teks bebas ter-escape dan tidak menjadi undefined', () => {
  const h = htmlPekerjaan(data({ rows: [{ tanggal: '2026-06-02', pekerjaan: 'x', pic: 'Rina', deadline: 'Jumat <depan>', status: 'Selesai' }] }));
  assert.ok(h.includes('Jumat &lt;depan&gt;'));
  assert.ok(!h.includes('undefined'));
});
