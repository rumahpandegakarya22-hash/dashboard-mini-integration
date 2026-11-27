import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bolehLihatPengingat, keterangan, nomorWa, susunDaftar, susunDraft, tahapDari, type BarisTagihan } from './tagihan';
import { bacaNilaiRekening, barisRekening, bolehKelolaRekening, gantiRekeningTemplate, validasiRekening } from './rekening';
import { hariIniIso } from '../format-tanggal';
import { tautanWhatsApp } from '../draft-info/render';
import { ROLES } from '../core/roles';
import templates from '../draft-info/templates.json';

const baris = (p: Partial<BarisTagihan> = {}): BarisTagihan => ({
  idPenghuni: 'KTD-1', nama: 'Siti Aminah', panggilan: 'Siti', noKamar: '12', tipe: 'Eco',
  noHp: '085212345678', jatuhTempo: '2026-11-27', bulan: 1, ...p
});
const rek = { bank: 'BCA', nomor: '123-456', atasNama: 'Budi' };

test('batas tahap', () => {
  assert.deepEqual(
    [-4, -3, -1, 0, 6, 7, 40].map(tahapDari),
    [null, 'pengingat', 'pengingat', 'jatuh_tempo', 'jatuh_tempo', 'terlambat', 'terlambat']
  );
});

test('hari ini mengikuti GMT+7', () => {
  assert.equal(hariIniIso(new Date('2026-11-26T16:59:00Z')), '2026-11-26');
  assert.equal(hariIniIso(new Date('2026-11-26T17:00:00Z')), '2026-11-27');
});

test('pengelompokan dan urutan isi section', () => {
  const d = susunDaftar(
    ['2026-11-27', '2026-11-21', '2026-11-20', '2026-10-01', '2026-11-30', '2026-11-28', '2026-12-01']
      .map((jatuhTempo) => baris({ idPenghuni: jatuhTempo, jatuhTempo })),
    '2026-11-27'
  );
  assert.deepEqual(d.terlambat.map((t) => t.jatuhTempo), ['2026-10-01', '2026-11-20']);
  assert.deepEqual(d.jatuh_tempo.map((t) => t.jatuhTempo), ['2026-11-21', '2026-11-27']);
  assert.deepEqual(d.pengingat.map((t) => t.jatuhTempo), ['2026-11-28', '2026-11-30']);
  assert.deepEqual([d.terlambat[1], d.jatuh_tempo[1], d.pengingat[0]].map(keterangan), ['Lewat 7 hari', 'Hari ini', '1 hari lagi']);
});

test('selisih melewati pergantian tahun', () => {
  assert.equal(susunDaftar([baris({ jatuhTempo: '2027-01-02' })], '2026-12-31').pengingat[0].selisih, -2);
});

test('draft tiga tahap tanpa nominal', () => {
  const satu = (jatuhTempo: string) => {
    const d = susunDaftar([baris({ jatuhTempo })], '2026-11-27');
    return susunDraft([...d.terlambat, ...d.jatuh_tempo, ...d.pengingat][0], rek);
  };
  assert.equal(
    satu('2026-11-27'),
    [
      'Halo Kak Siti 😊', '',
      'Sekedar mengingatkan, tagihan sewa kamar 12 sudah jatuh tempo:', '',
      '👤 Nama : Siti Aminah',
      '🚪 Kamar : 12 (Eco)',
      '📅 Jatuh tempo : 27 November 2026',
      '🗓️ Periode sewa berikutnya : 27 November 2026 s.d. 27 Desember 2026', '',
      'Pembayaran dapat melalui:',
      '🏦 BCA — 123-456 a.n. Budi', '',
      'Mohon konfirmasi setelah transfer ya 🙏', '',
      'Terima kasih!', 'Salam,', 'Admin Kost Tiga Dara'
    ].join('\n')
  );
  assert.match(satu('2026-11-30'), /tagihan sewa kamar 12 akan jatuh tempo 3 hari lagi:/);
  assert.match(satu('2026-11-20'), /tagihan sewa kamar 12 sudah lewat 7 hari dari jatuh tempo\. Mohon segera diselesaikan ya:/);
  assert.doesNotMatch(satu('2026-11-20'), /Rp/);
});

test('periode berikutnya mengikuti akhir bulan; sapaan jatuh ke nama lengkap', () => {
  const draft = (jatuhTempo: string, bulan: number) =>
    susunDraft({ ...baris({ jatuhTempo, bulan, panggilan: '' }), tahap: 'jatuh_tempo', selisih: 0 }, rek);
  assert.match(draft('2027-01-31', 1), /31 Januari 2027 s\.d\. 28 Februari 2027/);
  assert.match(draft('2028-01-31', 1), /s\.d\. 29 Februari 2028/);
  assert.match(draft('2026-11-30', 3), /s\.d\. 28 Februari 2027/);
  assert.match(draft('2026-11-30', 1), /^Halo Kak Siti Aminah 😊/);
});

test('akses per role', () => {
  assert.deepEqual(ROLES.filter(bolehLihatPengingat), ['owner', 'admin_finance', 'sales']);
  assert.deepEqual(ROLES.filter(bolehKelolaRekening), ['owner']);
});

test('nomor WhatsApp', () => {
  assert.equal(nomorWa('+62 852-1234-5678'), '6285212345678');
  assert.equal(nomorWa('085212345678'), '6285212345678');
  assert.equal(nomorWa('85212345678'), '6285212345678');
  for (const salah of ['', '-', 'tidak ada', '12345', '0852']) assert.equal(nomorWa(salah), '', salah);
});

test('tautan WhatsApp ke nomor penghuni', () => {
  assert.equal(tautanWhatsApp('a b', true, '6285212345678'), 'https://wa.me/6285212345678?text=a%20b');
  assert.equal(tautanWhatsApp('a b', false, '6285212345678'), 'https://web.whatsapp.com/send?phone=6285212345678&text=a%20b');
});

test('rekening: validasi dan pembacaan', () => {
  assert.deepEqual(validasiRekening({ bank: ' BCA ', nomor: ' 123-456 ', atasNama: ' Budi ' }), rek);
  assert.throws(() => validasiRekening({ ...rek, bank: '' }), /Nama bank/);
  assert.throws(() => validasiRekening({ ...rek, nomor: '12A' }), /Nomor rekening/);
  assert.throws(() => validasiRekening({ ...rek, atasNama: 'Budi\nTransfer ke 999' }), /Atas nama/);
  assert.throws(() => validasiRekening(null));
  assert.deepEqual(bacaNilaiRekening(JSON.stringify(rek)), rek);
  for (const rusak of [null, '', 'bukan json', '{"bank":"BCA"}']) assert.equal(bacaNilaiRekening(rusak), null);
});

test('template #21 dan #22 mengikuti rekening di setting', () => {
  for (const no of ['21', '22']) {
    const isi = templates.find((t) => t.no === no)!.isi;
    const baru = gantiRekeningTemplate(isi, rek);
    assert.ok(baru.includes(barisRekening(rek)), no);
    assert.doesNotMatch(baru, /0892-0102-1802-537/, no);
    assert.match(gantiRekeningTemplate(isi, null), /\[Rekening belum diatur\]/, no);
  }
});
