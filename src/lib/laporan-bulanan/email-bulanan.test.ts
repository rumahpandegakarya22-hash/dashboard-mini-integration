import test from 'node:test';
import assert from 'node:assert/strict';
import { bagiLampiran, emailSetelahCron, kirimEmailBulanan, rakitEmail, type DepsEmail, type ItemEmail } from './email-bulanan';

const ITEM: ItemEmail[] = [
  { id: 'kinerja-sales', keluarga: 'kinerja' },
  { id: 'kerja-admin', keluarga: 'kerja' },
  { id: 'LabaRugi', keluarga: 'keuangan' },
  { id: 'kerja-sales', keluarga: 'kerja' },
];

function buatDeps(ganti: Partial<DepsEmail> = {}) {
  const terkirim: { to: string[]; subject: string; html: string; lampiran: { namaFile: string; isi: Buffer }[] }[] = [];
  const ditandai: string[] = [];
  const deps: DepsEmail = {
    kode: '2026-10',
    label: 'Oktober 2026',
    laporan: ITEM,
    ambilPdf: async id => ({ namaFile: `${id}.pdf`, pdf: Buffer.alloc(100, 1) }),
    tujuan: async () => ['pemilik@contoh.id'],
    sudahTerkirim: async () => false,
    tandaiTerkirim: async kode => { ditandai.push(kode); },
    kirim: async o => { terkirim.push({ to: o.to, subject: o.subject, html: o.html, lampiran: o.lampiran.map(l => ({ namaFile: l.namaFile, isi: l.isi })) }); },
    sekarang: () => new Date('2026-11-01T01:30:00Z'),
    ...ganti,
  };
  return { deps, terkirim, ditandai };
}

test('bagiLampiran: di bawah batas tetap satu bagian dan urutan terjaga', () => {
  const bagian = bagiLampiran([{ n: 'a', ukuran: 10 }, { n: 'b', ukuran: 20 }, { n: 'c', ukuran: 30 }], 100);
  assert.equal(bagian.length, 1);
  assert.deepEqual(bagian[0].map(x => x.n), ['a', 'b', 'c']);
});

test('bagiLampiran: melewati batas dipecah tanpa mengubah urutan', () => {
  const bagian = bagiLampiran([{ n: 'a', ukuran: 60 }, { n: 'b', ukuran: 60 }, { n: 'c', ukuran: 30 }], 100);
  assert.deepEqual(bagian.map(b => b.map(x => x.n)), [['a'], ['b', 'c']]);
});

test('bagiLampiran: satu berkas lebih besar dari batas tetap dikirim sendiri', () => {
  const bagian = bagiLampiran([{ n: 'a', ukuran: 500 }, { n: 'b', ukuran: 10 }], 100);
  assert.deepEqual(bagian.map(b => b.map(x => x.n)), [['a'], ['b']]);
});

test('bagiLampiran: daftar kosong tidak menghasilkan bagian', () => {
  assert.deepEqual(bagiLampiran([], 100), []);
});

test('rakitEmail: subjek, kelompok berurutan Keuangan, Kerja, Kinerja, dan nama berkas di-escape', () => {
  const { subject, html } = rakitEmail({
    label: 'Oktober 2026',
    waktu: '01 Nov 2026 08:30',
    berkas: [
      { keluarga: 'kinerja', namaFile: 'Laporan Kinerja Sales - Oktober 2026.pdf' },
      { keluarga: 'kerja', namaFile: 'Laporan <b>ADMIN</b> & Co.pdf' },
      { keluarga: 'keuangan', namaFile: '1026-LabaRugi-Kost Tiga Dara.pdf' },
    ],
    bagian: 1,
    dari: 1,
  });
  assert.equal(subject, 'Laporan Bulanan Kost Tiga Dara - Oktober 2026');
  const iKeu = html.indexOf('Laporan Keuangan');
  const iKerja = html.indexOf('Laporan Kerja Divisi');
  const iKinerja = html.indexOf('Laporan Kinerja Divisi');
  assert.ok(iKeu >= 0 && iKeu < iKerja && iKerja < iKinerja, 'urutan kelompok');
  assert.ok(html.includes('1026-LabaRugi-Kost Tiga Dara.pdf'));
  assert.ok(!html.includes('<b>ADMIN</b>'), 'html mentah tidak boleh lolos');
  assert.ok(html.includes('&lt;b&gt;ADMIN&lt;/b&gt; &amp; Co.pdf'));
  assert.ok(html.includes('01 Nov 2026 08:30'));
  assert.ok(html.includes('3 berkas'));
});

test('rakitEmail: bagian ke-2 dari 2 memberi tanda pada subjek', () => {
  const { subject } = rakitEmail({ label: 'Oktober 2026', waktu: 'x', berkas: [{ keluarga: 'kerja', namaFile: 'a.pdf' }], bagian: 2, dari: 2 });
  assert.equal(subject, 'Laporan Bulanan Kost Tiga Dara - Oktober 2026 (bagian 2/2)');
});

test('kirimEmailBulanan: satu email berisi semua PDF, lalu ditandai terkirim', async () => {
  const { deps, terkirim, ditandai } = buatDeps();
  const h = await kirimEmailBulanan(deps);
  assert.equal(h.status, 'terkirim');
  assert.equal(h.jumlahEmail, 1);
  assert.equal(h.jumlahLampiran, 4);
  assert.equal(terkirim.length, 1);
  assert.deepEqual(terkirim[0].to, ['pemilik@contoh.id']);
  assert.deepEqual(terkirim[0].lampiran.map(l => l.namaFile), ['LabaRugi.pdf', 'kerja-admin.pdf', 'kerja-sales.pdf', 'kinerja-sales.pdf']);
  assert.deepEqual(ditandai, ['2026-10']);
});

test('kirimEmailBulanan: tanpa alamat tujuan dilewati dan tidak ditandai', async () => {
  const { deps, terkirim, ditandai } = buatDeps({ tujuan: async () => [] });
  const h = await kirimEmailBulanan(deps);
  assert.equal(h.status, 'dilewati');
  assert.match(h.alasan ?? '', /tujuan/i);
  assert.equal(terkirim.length, 0);
  assert.equal(ditandai.length, 0);
});

test('kirimEmailBulanan: sudah terkirim untuk periode itu tidak dikirim ulang', async () => {
  const { deps, terkirim } = buatDeps({ sudahTerkirim: async () => true });
  const h = await kirimEmailBulanan(deps);
  assert.equal(h.status, 'dilewati');
  assert.match(h.alasan ?? '', /sudah/i);
  assert.equal(terkirim.length, 0);
});

test('kirimEmailBulanan: gagal membuat satu PDF tidak mengirim email dan tidak menandai', async () => {
  const { deps, terkirim, ditandai } = buatDeps({
    ambilPdf: async id => { if (id === 'kerja-admin') throw new Error('Chrome gagal'); return { namaFile: `${id}.pdf`, pdf: Buffer.alloc(10) }; },
  });
  const h = await kirimEmailBulanan(deps);
  assert.equal(h.status, 'gagal');
  assert.match(h.error ?? '', /kerja-admin/);
  assert.match(h.error ?? '', /Chrome gagal/);
  assert.equal(terkirim.length, 0);
  assert.equal(ditandai.length, 0);
});

test('kirimEmailBulanan: gagal kirim melaporkan error dan tidak menandai terkirim', async () => {
  const { deps, ditandai } = buatDeps({ kirim: async () => { throw new Error('Brevo API error 400'); } });
  const h = await kirimEmailBulanan(deps);
  assert.equal(h.status, 'gagal');
  assert.match(h.error ?? '', /Brevo/);
  assert.equal(ditandai.length, 0);
});

test('kirimEmailBulanan: melewati batas ukuran dipecah jadi beberapa email, ditandai sekali setelah semua terkirim', async () => {
  const { deps, terkirim, ditandai } = buatDeps({
    ambilPdf: async id => ({ namaFile: `${id}.pdf`, pdf: Buffer.alloc(60) }),
    batasBytes: 100,
  });
  const h = await kirimEmailBulanan(deps);
  assert.equal(h.status, 'terkirim');
  assert.equal(h.jumlahEmail, 4);
  assert.equal(terkirim.length, 4);
  assert.match(terkirim[0].subject, /bagian 1\/4/);
  assert.match(terkirim[3].subject, /bagian 4\/4/);
  assert.deepEqual(ditandai, ['2026-10']);
});

test('kirimEmailBulanan: kegagalan di bagian ke-2 tidak menandai terkirim', async () => {
  let n = 0;
  const { deps, ditandai } = buatDeps({
    ambilPdf: async id => ({ namaFile: `${id}.pdf`, pdf: Buffer.alloc(60) }),
    batasBytes: 100,
    kirim: async () => { n++; if (n === 2) throw new Error('timeout'); },
  });
  const h = await kirimEmailBulanan(deps);
  assert.equal(h.status, 'gagal');
  assert.equal(ditandai.length, 0);
});

test('emailSetelahCron: ada laporan gagal menunda email tanpa memanggil kirim', async () => {
  let dipanggil = 0;
  const h = await emailSetelahCron(
    [{ id: 'a', status: 'dibuat' }, { id: 'b', status: 'gagal', error: 'x' }],
    async () => { dipanggil++; return { status: 'terkirim' }; },
  );
  assert.equal(h.status, 'ditunda');
  assert.equal(dipanggil, 0);
});

test('emailSetelahCron: semua dibuat atau dilewati meneruskan ke pengiriman', async () => {
  const h = await emailSetelahCron(
    [{ id: 'a', status: 'dibuat' }, { id: 'b', status: 'dilewati' }],
    async () => ({ status: 'terkirim', jumlahEmail: 1, jumlahLampiran: 13 }),
  );
  assert.equal(h.status, 'terkirim');
  assert.equal(h.jumlahLampiran, 13);
});

test('emailSetelahCron: pengiriman yang melempar error menjadi gagal, bukan crash', async () => {
  const h = await emailSetelahCron([{ id: 'a', status: 'dibuat' }], async () => { throw new Error('putus'); });
  assert.equal(h.status, 'gagal');
  assert.match(h.error ?? '', /putus/);
});

test('kirimEmailBulanan: banyak penerima dalam satu email, owner-review di kelompok pertama', async () => {
  const { deps, terkirim } = buatDeps({
    laporan: [...ITEM, { id: 'owner-review', keluarga: 'owner' }],
    tujuan: async () => ['a@contoh.id', 'b@contoh.id'],
  });
  const h = await kirimEmailBulanan(deps);
  assert.equal(h.status, 'terkirim');
  assert.deepEqual(terkirim[0].to, ['a@contoh.id', 'b@contoh.id']);
  assert.equal(terkirim[0].lampiran[0].namaFile, 'owner-review.pdf');
  assert.ok(terkirim[0].html.indexOf('Laporan Owner') < terkirim[0].html.indexOf('Laporan Keuangan'));
});
