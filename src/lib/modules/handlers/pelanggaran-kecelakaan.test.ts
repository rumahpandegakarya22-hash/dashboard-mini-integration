import test from 'node:test';
import assert from 'node:assert/strict';
import { MODULES } from '../registry';
import { canAccess } from '../../core/roles';
import { pelanggaranInsertCfg } from './pelanggaran-peraturan';
import { kecelakaanInsertCfg } from './kecelakaan-kerja';

test('pelanggaran: baris dibangun dan dirapikan, tindakan kosong jadi null', () => {
  const row = pelanggaranInsertCfg.buildRow({
    tanggal: '2026-06-08', penghuni: ' KTD-2606-001 ', jenis: 'Kebisingan', deskripsi: ' Musik malam ', tindakan: '  '
  });
  assert.deepEqual(row, { tanggal: '2026-06-08', id_penghuni: 'KTD-2606-001', jenis: 'Kebisingan', deskripsi: 'Musik malam', tindakan: null });
});

test('pelanggaran: penghuni, jenis, deskripsi, dan tanggal wajib', () => {
  const ok = { tanggal: '2026-06-08', penghuni: 'KTD-1', jenis: 'Kebisingan', deskripsi: 'x' };
  assert.doesNotThrow(() => pelanggaranInsertCfg.buildRow(ok));
  for (const k of ['penghuni', 'jenis', 'deskripsi'] as const) {
    assert.throws(() => pelanggaranInsertCfg.buildRow({ ...ok, [k]: '' }), Error, k);
  }
  assert.throws(() => pelanggaranInsertCfg.buildRow({ ...ok, tanggal: '' }));
});

test('kecelakaan: baris dibangun, lokasi/petugas/kronologi wajib', () => {
  const ok = { tanggal: '2026-06-10', lokasi: 'Dapur', petugas: 'Dewi', kronologi: 'Tersiram air panas', tindakan: 'Diobati' };
  assert.deepEqual(kecelakaanInsertCfg.buildRow(ok), { ...ok });
  assert.equal(kecelakaanInsertCfg.buildRow({ ...ok, tindakan: '' }).tindakan, null);
  for (const k of ['lokasi', 'petugas', 'kronologi'] as const) {
    assert.throws(() => kecelakaanInsertCfg.buildRow({ ...ok, [k]: ' ' }), Error, k);
  }
});

test('hak akses: pelanggaran admin+owner; kecelakaan admin+owner+operasional', () => {
  for (const [id, boleh] of [
    ['pelanggaran-peraturan', ['owner', 'admin_finance']],
    ['kecelakaan-kerja', ['owner', 'admin_finance', 'operasional']]
  ] as const) {
    for (const role of ['owner', 'admin_finance', 'operasional', 'sales', 'marketing'] as const) {
      assert.equal(canAccess(role, id), (boleh as readonly string[]).includes(role), `${id} / ${role}`);
    }
  }
});

test('registry: kedua modul siap, field wajib sesuai, jenis dari Settings', () => {
  const p = MODULES.find((m) => m.id === 'pelanggaran-peraturan');
  const k = MODULES.find((m) => m.id === 'kecelakaan-kerja');
  assert.ok(p?.ready && k?.ready);
  assert.equal(p!.fields!.find((f) => f.name === 'penghuni')?.master, 'penghuni-aktif');
  assert.equal(p!.fields!.find((f) => f.name === 'jenis')?.master, 'setting:JENIS_PELANGGARAN:SETTING:Jenis');
  assert.deepEqual(k!.fields!.filter((f) => f.required).map((f) => f.name), ['tanggal', 'lokasi', 'petugas', 'kronologi']);
});
