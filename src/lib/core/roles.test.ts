import test from 'node:test';
import assert from 'node:assert/strict';
import { ROLES, DASHBOARD_ROLES, ROLE_LABEL, normalizeRole, canAccess, ROLE_DIVISI, MODULE_ACCESS } from './roles';

test('normalizeRole: kunci baru lolos, kunci lama diterjemahkan, sisanya null', () => {
  for (const r of ROLES) assert.equal(normalizeRole(r), r);
  const peta: Record<string, string> = {
    admin: 'admin_finance', staff_admin: 'admin_finance', staff_finance: 'admin_finance',
    staff_maintenance: 'operasional', staff_inspeksi: 'operasional', staff_cleaning: 'operasional',
    staff_sales: 'sales', staff_marketing: 'marketing'
  };
  for (const [lama, baru] of Object.entries(peta)) assert.equal(normalizeRole(lama), baru, lama);
  for (const v of ['', 'OWNER', 'tenant', null, undefined, 5]) assert.equal(normalizeRole(v), null);
});

test('label: Admin and Finance dan Operasional', () => {
  assert.equal(ROLE_LABEL.admin_finance, 'Admin and Finance');
  assert.equal(ROLE_LABEL.operasional, 'Operasional');
});

test('DASHBOARD_ROLES = semua role kecuali pengawas', () => {
  assert.deepEqual([...DASHBOARD_ROLES].sort(), ROLES.filter((r) => r !== 'pengawas').sort());
});

test('akses modul: operasional mewarisi maintenance + inspeksi + cleaning; admin_finance mewarisi admin + finance', () => {
  for (const m of ['perawatan-preventif', 'inspeksi-kebersihan', 'wo-cleaning', 'pemakaian-stok-cleaning', 'tambah-vendor']) {
    assert.equal(canAccess('operasional', m), true, m);
    assert.equal(canAccess('sales', m), false, m);
  }
  for (const m of ['pembayaran-sewa', 'pengeluaran', 'aktivitas-finansial']) assert.equal(canAccess('admin_finance', m), true, m);
  assert.equal(canAccess('owner', 'pembayaran-sewa'), true);
  assert.equal(canAccess('pengawas', 'pembayaran-sewa'), true);
  assert.equal(canAccess('marketing', 'pembayaran-sewa'), false);
});

test('setiap peran di MODULE_ACCESS valid', () => {
  for (const rs of Object.values(MODULE_ACCESS)) for (const r of rs) assert.ok((ROLES as readonly string[]).includes(r), r);
});

test('ROLE_DIVISI: nilai DB tidak digabung', () => {
  assert.deepEqual(ROLE_DIVISI.operasional, ['Maintenance', 'Inspeksi', 'Cleaning']);
  assert.deepEqual(ROLE_DIVISI.admin_finance, ['Admin', 'Finance']);
});

test('canUseInventory: Sales dan Marketing ditolak', async () => {
  const { canUseInventory } = await import('./roles');
  for (const r of ['owner', 'pengawas', 'admin_finance', 'operasional'] as const) assert.equal(canUseInventory(r), true, r);
  for (const r of ['sales', 'marketing'] as const) assert.equal(canUseInventory(r), false, r);
  assert.equal(canUseInventory(null), false);
});

test('canUsePreForm: hanya owner dan operasional', async () => {
  const { canUsePreForm } = await import('./roles');
  for (const r of ['owner', 'operasional'] as const) assert.equal(canUsePreForm(r), true, r);
  for (const r of ['pengawas', 'admin_finance', 'sales', 'marketing'] as const) assert.equal(canUsePreForm(r), false, r);
});
