import test from 'node:test';
import assert from 'node:assert/strict';
import { susunKerjaOperasional } from '../builders/operasional';
import { htmlKerjaOperasional } from './kerja-operasional';
import { parsePeriode } from '../periode';
import type { DailyTaskRow } from '../types';

const periode = parsePeriode('2026-06', new Date('2026-11-02'));
const dibuat = new Date('2026-07-06T08:03:00Z');

let n = 0;
const t = (divisi: string, status: DailyTaskRow['status'], deadline: string | null, o: Partial<DailyTaskRow> = {}): DailyTaskRow =>
  ({ id: ++n, tanggal: '2026-06-10', task: `Task ${n}`, pic: 'Dewi', divisi, deadline, status, ...o });

// 9 task, 4 Complete. Maintenance: 1/1/1 dengan 2 lewat deadline.
const sembilan = [
  t('Maintenance', 'Complete', '2026-06-12'), t('Maintenance', 'In Progress', '2026-06-20'), t('Maintenance', 'Pending', '2026-06-25'),
  t('Inspeksi', 'Complete', '2026-06-12'), t('Inspeksi', 'In Progress', null), t('Inspeksi', 'Pending', null),
  t('Cleaning', 'Complete', '2026-06-12'), t('Cleaning', 'Complete', '2026-06-13'), t('Cleaning', 'In Progress', '2026-08-01'),
];

test('kerja operasional: header, ringkasan 44% (4 dari 9), bagian A-C', () => {
  const h = htmlKerjaOperasional(susunKerjaOperasional(periode, dibuat, sembilan));
  assert.match(h, /LAPORAN KERJA DIVISI OPERASIONAL/);
  assert.match(h, /Kost Tiga Dara Putri UGM/);
  assert.ok(h.includes('Lingkup: Maintenance, Inspeksi, Kebersihan   |   Periode: Juni 2026   |   Dibuat: 06/07/2026 15:03'));
  assert.match(h, /Ringkasan Eksekutif/);
  assert.match(h, /<th>Divisi<\/th><th>Total Task<\/th><th>Complete<\/th><th>In Progress<\/th><th>Pending<\/th><th>Lewat Deadline<\/th>/);
  assert.match(h, /<tr><td>Maintenance<\/td><td>3<\/td><td>1<\/td><td>1<\/td><td>1<\/td><td>2<\/td><\/tr>/);
  assert.match(h, /<tr><td>Inspeksi<\/td><td>3<\/td><td>1<\/td><td>1<\/td><td>1<\/td><td>0<\/td><\/tr>/);
  assert.match(h, /<tr><td>Kebersihan<\/td><td>3<\/td><td>2<\/td><td>1<\/td><td>0<\/td><td>0<\/td><\/tr>/);
  assert.match(h, /<tr><td>TOTAL<\/td><td>9<\/td><td>4<\/td><td>3<\/td><td>2<\/td><td>2<\/td><\/tr>/);
  assert.ok(h.includes('Tingkat penyelesaian gabungan: 44% (4 dari 9 task).'));
  for (const s of ['A. Divisi Maintenance', 'B. Divisi Inspeksi', 'C. Divisi Kebersihan']) assert.ok(h.includes(s), s);
  assert.equal(h.split('Lewat Deadline (belum complete)').length - 1, 3);
  assert.match(h, /<th>Tanggal<\/th><th>Task<\/th><th>PIC<\/th><th>Deadline<\/th><th>Status<\/th>/);
  assert.match(h, /<td>10\/06\/2026<\/td><td>Task 1<\/td><td>Dewi<\/td><td>12\/06\/2026<\/td><td>Complete<\/td>/);
  assert.match(h, /<td>Lewat Deadline \(belum complete\)<\/td><td>2<\/td>/);
  assert.match(h, /Dibuat oleh,[\s\S]*Staf Divisi Operasional[\s\S]*Mengetahui,[\s\S]*Pengelola Kost/);
  assert.ok(!h.includes('Tidak ada task'));
});

test('kerja operasional: bulan kosong utuh, 0%', () => {
  const h = htmlKerjaOperasional(susunKerjaOperasional(periode, dibuat, []));
  assert.equal(h.split('Tidak ada task tercatat pada periode ini.').length - 1, 3);
  assert.ok(h.includes('Tingkat penyelesaian gabungan: 0% (0 dari 0 task).'));
  assert.match(h, /<tr><td>TOTAL<\/td><td>0<\/td><td>0<\/td><td>0<\/td><td>0<\/td><td>0<\/td><\/tr>/);
  assert.ok(!h.includes('NaN'));
});

test('kerja operasional: divisi lain diabaikan, pic kosong jadi -', () => {
  const d = susunKerjaOperasional(periode, dibuat, [t('Admin', 'Complete', null), t('Cleaning', 'Pending', null, { pic: null })]);
  assert.deepEqual(d.sub.map(s => s.tugas.length), [0, 0, 1]);
  assert.equal(d.sub[2].tugas[0].pic, '-');
});

test('kerja operasional: teks database di-escape', () => {
  const d = susunKerjaOperasional(periode, dibuat, [t('Maintenance', 'Pending', null, { task: '<script>x</script> & "y"', pic: '<b>Rina</b>' })]);
  const h = htmlKerjaOperasional(d);
  assert.ok(!h.includes('<script>') && !h.includes('<b>'));
  assert.match(h, /&lt;script&gt;x&lt;\/script&gt; &amp; &quot;y&quot;/);
});

test('kerja operasional: status dari database di-escape', () => {
  const d = susunKerjaOperasional(periode, dibuat, [t('Maintenance', '<i>x</i>' as DailyTaskRow['status'], null)]);
  const h = htmlKerjaOperasional(d);
  assert.ok(!h.includes('<i>x'));
  assert.match(h, /<td>&lt;i&gt;x&lt;\/i&gt;<\/td>/);
});

test('deadline teks bebas ter-escape dan tidak menjadi undefined', () => {
  const h = htmlKerjaOperasional(susunKerjaOperasional(periode, dibuat, [t('Maintenance', 'Pending', 'akhir bulan & "segera"')]));
  assert.ok(h.includes('akhir bulan &amp; &quot;segera&quot;'));
  assert.ok(!h.includes('undefined'));
});
