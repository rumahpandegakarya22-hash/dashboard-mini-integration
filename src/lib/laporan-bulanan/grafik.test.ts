import test from 'node:test';
import assert from 'node:assert/strict';
import { barKartu, barVertikalKartu, batasAtas, garisKartu, hariDalamPeriode, hitungKemunculan, jumlahPerKunci, kartuAngka, perHari, perMinggu } from './grafik';

const juni = { dari: '2026-06-01', sampai: '2026-06-30' };

test('hitungKemunculan: urut terbanyak, buang kosong, sisa digabung Lainnya', () => {
  assert.deepEqual(hitungKemunculan(['b', 'a', 'b', null, ' ', 'c']), [{ label: 'b', nilai: 2 }, { label: 'a', nilai: 1 }, { label: 'c', nilai: 1 }]);
  const banyak = hitungKemunculan(['a', 'a', 'b', 'c', 'd'], 3);
  assert.equal(banyak.length, 3);
  assert.deepEqual(banyak[2], { label: 'Lainnya', nilai: 2 });
});

test('jumlahPerKunci: jumlahkan per kunci, buang <= 0, kunci kosong jadi Lainnya', () => {
  assert.deepEqual(jumlahPerKunci([{ kunci: 'x', nilai: 5 }, { kunci: 'x', nilai: 3 }, { kunci: null, nilai: 2 }, { kunci: 'y', nilai: 0 }]), [{ label: 'x', nilai: 8 }, { label: 'Lainnya', nilai: 2 }]);
});

test('perHari dan perMinggu: 30 hari Juni, baris di luar periode diabaikan', () => {
  assert.equal(hariDalamPeriode(juni).length, 30);
  const baris = [{ tanggal: '2026-06-01' }, { tanggal: '2026-06-07' }, { tanggal: '2026-06-08' }, { tanggal: '2026-05-31' }, { tanggal: '2026-07-01' }, { tanggal: 'rusak' }];
  const harian = perHari(baris, juni);
  assert.equal(harian.length, 30);
  assert.equal(harian.reduce((s, t) => s + t.nilai, 0), 3);
  const minggu = perMinggu(baris, juni);
  assert.deepEqual(minggu.map(t => t.label), ['1–7', '8–14', '15–21', '22–28', '29–30']);
  assert.deepEqual(minggu.map(t => t.nilai), [2, 1, 0, 0, 0]);
});

test('perHari memakai nilai bila diberikan (mis. rupiah per hari)', () => {
  const t = perHari([{ tanggal: '2026-06-02', nilai: 1500 }, { tanggal: '2026-06-02', nilai: 500 }], juni);
  assert.equal(t[1].nilai, 2000);
});

test('batasAtas membulatkan ke 1/2/5 x 10^n', () => {
  assert.equal(batasAtas(0), 1);
  assert.equal(batasAtas(7), 10);
  assert.equal(batasAtas(130), 200);
  assert.equal(batasAtas(3_400_000), 5_000_000);
});

test('chart kosong menampilkan pesan, bukan SVG rusak atau NaN', () => {
  for (const h of [barKartu('Judul', []), barKartu('Judul', [{ label: 'a', nilai: 0 }]), barVertikalKartu('Judul', [{ label: 'a', nilai: 0 }]), garisKartu('Judul', [{ nama: 'x', warna: '#000', titik: [] }])]) {
    assert.match(h, /Belum ada data pada periode ini/);
    assert.ok(!h.includes('NaN') && !h.includes('<svg'));
  }
});

test('chart berisi: label di-escape dan tanpa NaN', () => {
  const bar = barKartu('Biaya <b>', [{ label: '<script>x</script>', nilai: 1_500_000 }, { label: 'Dapur', nilai: 500_000 }], { uang: true });
  assert.ok(!bar.includes('<script>') && !bar.includes('Biaya <b>'));
  assert.match(bar, /&lt;script&gt;/);
  assert.ok(!bar.includes('NaN'));
  const vert = barVertikalKartu('Arus', [{ label: 'Masuk', nilai: 100 }, { label: 'Bersih', nilai: -40 }]);
  assert.ok(vert.includes('<svg') && !vert.includes('NaN'));
  const garis = garisKartu('Tren', [{ nama: 'A', warna: '#c92d31', titik: perMinggu([{ tanggal: '2026-06-03' }, { tanggal: '2026-06-20' }], juni) }]);
  assert.ok(garis.includes('<polyline') && !garis.includes('NaN'));
});

test('kartuAngka meng-escape teks', () => {
  assert.ok(!kartuAngka([{ label: '<i>', nilai: '1' }]).includes('<i>'));
});
