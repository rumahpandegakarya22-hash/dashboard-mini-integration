import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODULES } from './registry';

test('form Aktivitas Finansial tidak menawarkan Beban Non-Operasional (penyusutan lewat menu Aset Tetap)', () => {
  const mod = MODULES.find((m) => m.id === "aktivitas-finansial");
  assert.ok(mod, 'modul aktivitas-finansial ada');
  const tipe = mod!.fields!.find((f) => f.name === 'tipeAkun');
  assert.ok(tipe && 'options' in tipe && tipe.options);
  const nilai = (tipe!.options as { value: string }[]).map((o) => o.value);
  assert.ok(!nilai.includes('Beban Non-Operasional'));
  assert.ok(nilai.includes('Beban'));
});
