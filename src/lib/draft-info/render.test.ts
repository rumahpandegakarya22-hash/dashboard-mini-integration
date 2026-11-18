import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daftarIsian, formatRupiah, jenisDari, susunPesan, tautanWhatsApp } from './render';
import { parseTemplateHtml, dekodeEntitas } from './parse-html';
import templates from './templates.json';

const cari = (no: string) => templates.find((t) => t.no === no)!;

test('jenis isian dikenali dari label di dokumen', () => {
  assert.equal(jenisDari('Hari'), 'hari');
  assert.equal(jenisDari('Tanggal'), 'tanggal');
  assert.equal(jenisDari('Hari, DD Bulan YYYY'), 'tanggal');
  assert.equal(jenisDari('Jam Mulai'), 'jam');
  assert.equal(jenisDari('HH:MM'), 'jam');
  assert.equal(jenisDari('Nama Bulan YYYY'), 'bulan');
  assert.equal(jenisDari('Jumlah DP'), 'rupiah');
  assert.equal(jenisDari('Tanggal / Jam'), 'teks');
  assert.equal(jenisDari('Area'), 'teks');
});

test('Jadwal AC: hari otomatis dari tanggal, jam diberi WIB, tanggal tanpa hari karena Hari terpisah', () => {
  const t = cari('1');
  const { teks, kosong } = susunPesan(t.isi, { tanggal: '2026-11-20', jam: '09:00' });
  assert.deepEqual(kosong, []);
  assert.match(teks, /Hari\/Tanggal: Jumat\/20 November 2026/);
  assert.match(teks, /Waktu: 09:00 WIB/);
  assert.match(teks, /^📢 \*JADWAL PERAWATAN RUTIN AC\* 📢/);
});

test('isian wajib yang kosong tampil sebagai [Label] dan terdaftar di kosong', () => {
  const { teks, kosong } = susunPesan(cari('1').isi, { tanggal: '2026-11-20' });
  assert.deepEqual(kosong, ['Jam']);
  assert.match(teks, /Waktu: \[Jam\]/);
});

test('Hari/Tanggal tanpa isian Hari terpisah memakai nama hari; rentang jam tidak diberi WIB di awal', () => {
  const p = susunPesan(cari('2').isi, { 'sebutkan fasilitas, misal: pompa air/wifi': 'Pompa Air', tanggal: '2026-11-21', 'jam mulai': '08:00', 'estimasi selesai': '12:00' });
  assert.deepEqual(p.kosong, []);
  assert.match(p.teks, /Hari\/Tanggal: Sabtu, 21 November 2026/);
  assert.match(p.teks, /08:00 s\/d 12:00/);
});

test('baris placeholder yang berdiri sendiri bersifat opsional dan dibuang bila kosong', () => {
  const t = cari('12');
  const isian = daftarIsian(t.isi);
  assert.equal(isian.find((i) => i.kunci === 'nama penghuni 2')!.opsional, true);
  assert.equal(isian.find((i) => i.kunci.startsWith('sebutkan lokasi'))!.petunjuk, 'misal: Meja Depan/Lobi');
  const { teks, kosong } = susunPesan(t.isi, { 'nama penghuni 1': 'Rina', 'sebutkan lokasi, misal: meja depan/lobi': 'Meja Depan' });
  assert.deepEqual(kosong, []);
  assert.match(teks, /atas nama:\n\nRina\n\nPaket sudah diletakkan di Meja Depan/);
});

test('label yang sama (beda huruf besar) menjadi satu isian; rupiah diberi titik ribuan', () => {
  assert.equal(daftarIsian(cari('16').isi).length, 1);
  assert.equal(formatRupiah('1200000'), '1.200.000');
  const p = susunPesan(cari('20').isi, { nama: 'Dina', 'jumlah dp': '600000' });
  assert.match(p.teks, /Cukup transfer DP Rp 600\.000/);
  assert.match(p.teks, /Halo Kak Dina/);
});

test('template tanpa isian dapat langsung dikirim; tautan WhatsApp memakai teks ter-encode', () => {
  const t = cari('10');
  const p = susunPesan(t.isi, {});
  assert.deepEqual(p.kosong, []);
  const url = tautanWhatsApp('Halo & selamat\n*malam*');
  assert.equal(url, 'https://wa.me/?text=Halo%20%26%20selamat%0A*malam*'.replace('*malam*', '*malam*'));
  assert.ok(url.startsWith('https://wa.me/?text='));
});

test('semua template terbaca dan isiannya terklasifikasi', () => {
  assert.equal(templates.length, 25);
  for (const t of templates) {
    assert.ok(t.isi.length > 20, `${t.no} kosong`);
    assert.ok(!t.isi.includes('&amp;') && !t.isi.includes('&#'), `${t.no} entitas belum didekode`);
    daftarIsian(t.isi); // tidak melempar
  }
});

test('parser: hanya tebal+biru tua dalam kurung siku yang jadi placeholder; entitas didekode', () => {
  assert.equal(dekodeEntitas('a &mdash; b &#128226; &amp;'), 'a — b 📢 &');
  const html = `<h1>BAB I — UJI</h1><h2>1. Uji</h2><table><tr><td><p><span>Banner</span></p></td></tr>
    <tr><td><p><span>Halo </span><span style="color:#1f4e79;font-weight:700">[Nama]</span><span> pukul [bukan placeholder]</span></p></td></tr></table>`;
  const [t] = parseTemplateHtml(html);
  assert.equal(t.isi, 'Halo {{Nama}} pukul [bukan placeholder]');
  assert.equal(t.judul, 'Uji');
});
