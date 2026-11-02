import test from 'node:test';
import assert from 'node:assert/strict';
import { ringkasTugas, petaStatus, lewatDeadline } from './tugas';

test('ringkasTugas', () => {
  assert.deepEqual(ringkasTugas([]), { total: 0, selesai: 0, proses: 0, tertunda: 0, persen: 0 });
  assert.equal(ringkasTugas([{ status: 'Selesai' }, { status: 'Proses' }, { status: 'Tertunda' }]).persen, 33);
});
test('petaStatus', () => {
  assert.equal(petaStatus('Complete'), 'Selesai');
  assert.equal(petaStatus('In Progress'), 'Proses');
  assert.equal(petaStatus('Pending'), 'Tertunda');
});
test('lewatDeadline', () => {
  assert.equal(lewatDeadline({ status: 'Pending', deadline: '2026-06-25' }, '2026-07-06'), true);
  assert.equal(lewatDeadline({ status: 'Complete', deadline: '2026-06-25' }, '2026-07-06'), false);
  assert.equal(lewatDeadline({ status: 'Selesai', deadline: '2026-06-25' }, '2026-07-06'), false);
  assert.equal(lewatDeadline({ status: 'Pending', deadline: null }, '2026-07-06'), false);
});
