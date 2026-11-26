import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canOpenView, ROLE_NAV } from '../../config/dashboard-nav';
import { DASHBOARD_ROLES } from '../core/roles';

test('menu Kalkulator Bisnis hanya untuk owner', () => {
  assert.equal(canOpenView('owner', 'kalkulator'), true);
  for (const r of DASHBOARD_ROLES.filter((r) => r !== 'owner')) {
    assert.equal(canOpenView(r, 'kalkulator'), false, `${r} tidak boleh membuka kalkulator`);
  }
});

test('Pengawas tetap melihat halaman Owner lainnya', () => {
  const owner = ROLE_NAV.owner.pages.map((p) => p.id).filter((id) => id !== 'kalkulator');
  assert.deepEqual(ROLE_NAV.pengawas.pages.map((p) => p.id), owner);
});
