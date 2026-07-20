/* Verifikasi hidrasi Fase 4 langkah 4: jalankan hydrateDashboard() terhadap
   keluaran readComputedSheets() yang NYATA, lalu laporkan cakupan tiap bagian.
   Tujuannya membuktikan deteksi header fuzzy benar-benar mengenali tab yang
   dihasilkan sheet-map.ts — bukan sekadar lolos typecheck. */
import './_env';

(async () => {
  const { readComputedSheets } = await import('../src/lib/dashboard/source');
  const { hydrateDashboard } = await import('../src/lib/dashboard/views/hydrate');

  const sheets = await readComputedSheets();
  console.log('\nTab tersedia dari sheet-map:');
  for (const k of Object.keys(sheets)) console.log(`  - ${k} (${sheets[k].length - 1} baris)`);

  const d = hydrateDashboard(sheets);

  const rows: [string, number | string][] = [
    ['penghuni', d.penghuni.length],
    ['logbook', d.logbook.length],
    ['payments', d.payments.length],
    ['leads', d.leads.length],
    ['survey', d.survey.length],
    ['booking', d.booking.length],
    ['tiket', d.tiket.length],
    ['vendor', d.vendor.length],
    ['kamar', d.kamar.length],
    ['dokumen', d.dokumen.length],
    ['occupants', d.occupants.length],
    ['rooms', d.rooms.length],
    ['pembayaran', d.pembayaran.length]
  ];
  console.log('\nHasil hidrasi:');
  let kosong = 0;
  for (const [k, v] of rows) {
    const flag = v === 0 ? '  <-- KOSONG' : '';
    if (v === 0) kosong++;
    console.log(`  ${String(k).padEnd(12)} ${String(v).padStart(4)}${flag}`);
  }

  console.log('\nSTATS:', JSON.stringify(d.stats));
  console.log('RETENTION:', JSON.stringify(d.retention));
  console.log('TEMPO:', d.tempo ? `tunggakan=${d.tempo.tunggakan} jatuhTempo=${d.tempo.jatuhTempo} list=${d.tempo.list.length}` : 'null');

  // sanity: okupansi harus 0..100 dan occupied+kosong <= kapasitas
  const s = d.stats;
  const waras =
    s.okupansi >= 0 && s.okupansi <= 100 &&
    s.occupied + s.kosong <= s.kapasitas + 0 &&
    s.kapasitas > 0;
  console.log('\nSanity STATS:', waras ? 'WAJAR' : 'MENCURIGAKAN');
  console.log(`Bagian kosong: ${kosong} dari ${rows.length}`);
})().catch((e) => { console.error('GAGAL:', e); process.exit(1); });
