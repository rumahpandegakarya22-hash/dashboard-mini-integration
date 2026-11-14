import test from 'node:test';
import assert from 'node:assert/strict';
import {
  agingTunggakan, collectionRate, renewalRate, hariKerjaSetelahAkhirBulan, revpar, rataVacancyHari,
  rataResponsLeadsMenit, cac, cplRata, pencapaianTargetLeads, engagementRate, konsistensiPosting, slaPatuh,
  tiketBerulang, kepatuhanPreventif, kepatuhanInspeksi, rataKamarSiapHari, kelengkapanDokumen,
  rataResponsPengaduanJam, rataSkorCsat, hariPeriode, tgl, type Invoice
} from './kpi-calc';

const hariIni = new Date(2026, 10, 14); // 14 Nov 2026
const inv = (idPenghuni: string, awal: string, akhir: string, bayar: string | null, total = 1200000, bulan = 1): Invoice => ({
  idPenghuni, awal, akhir, bayar, total, bulan
});
const nov = { from: new Date(2026, 10, 1), to: new Date(2026, 10, 30) };

test('agingTunggakan: kelompok 1-7, 8-14, 15-30, >30; hanya penghuni aktif; pakai invoice terakhir', () => {
  const aktif = new Set(['A', 'B', 'C', 'D', 'E']);
  const data = [
    inv('A', '2026-10-01', '2026-11-01', '2026-10-01'), // lama
    inv('A', '2026-11-01', '2026-12-01', '2026-11-01'), // A sudah lanjut -> tidak menunggak
    inv('B', '2026-10-14', '2026-11-13', '2026-10-14'), // telat 1 hari
    inv('C', '2026-10-01', '2026-11-04', '2026-10-01'), // telat 10 hari
    inv('D', '2026-09-01', '2026-10-24', '2026-09-01'), // telat 21 hari
    inv('E', '2026-08-01', '2026-09-30', '2026-08-01'), // telat 45 hari
    inv('X', '2026-08-01', '2026-09-01', '2026-08-01') // bukan aktif
  ];
  const a = agingTunggakan(data, aktif, hariIni);
  assert.deepEqual([a.hari1_7, a.hari8_14, a.hari15_30, a.lebih30, a.total], [1, 1, 1, 1, 4]);
  assert.equal(a.nominal, 4 * 1200000);
});

test('agingTunggakan: jatuh tempo hari ini masuk 1-7; belum jatuh tempo tidak dihitung; nominal dibagi jumlah bulan', () => {
  const a = agingTunggakan(
    [inv('A', '2026-08-14', '2026-11-14', '2026-08-14', 3600000, 3), inv('B', '2026-11-01', '2026-12-01', '2026-11-01')],
    new Set(['A', 'B']),
    hariIni
  );
  assert.equal(a.hari1_7, 1);
  assert.equal(a.total, 1);
  assert.equal(a.nominal, 1200000);
});

test('collectionRate: lanjutan dibayar sebelum/saat jatuh tempo = tepat waktu; telat atau belum = tidak', () => {
  const data = [
    inv('A', '2026-10-01', '2026-11-01', '2026-10-01'),
    inv('A', '2026-11-01', '2026-12-01', '2026-10-30'), // tepat waktu
    inv('B', '2026-10-05', '2026-11-05', '2026-10-05'),
    inv('B', '2026-11-05', '2026-12-05', '2026-11-08'), // telat
    inv('C', '2026-10-10', '2026-11-10', '2026-10-10') // belum lanjut
  ];
  assert.equal(collectionRate(data, new Set(['A', 'B', 'C']), nov, hariIni), 33.3);
  assert.equal(collectionRate([], new Set(), nov, hariIni), null);
});

test('renewalRate: yang keluar ikut penyebut', () => {
  const data = [
    inv('A', '2026-10-01', '2026-11-01', '2026-10-01'),
    inv('A', '2026-11-01', '2026-12-01', '2026-10-30'),
    inv('C', '2026-10-10', '2026-11-10', '2026-10-10')
  ];
  assert.equal(renewalRate(data, nov, hariIni), 50);
});

test('hariKerjaSetelahAkhirBulan: lewati Sabtu-Minggu; bulan yang sama = 0', () => {
  assert.equal(hariKerjaSetelahAkhirBulan('2026-10', '2026-11-02'), 0 + 1); // Senin 2 Nov: 31 Okt Sabtu -> 1 hari kerja
  assert.equal(hariKerjaSetelahAkhirBulan('2026-10', '2026-11-05'), 4);
  assert.equal(hariKerjaSetelahAkhirBulan('2026-10', '2026-10-30'), 0);
  assert.equal(hariKerjaSetelahAkhirBulan('x', '2026-10-30'), null);
});

test('revpar: pendapatan sewa / (kamar x hari)', () => {
  assert.equal(revpar(30 * 30 * 1000, 30, 30), 1000);
  assert.equal(revpar(100, 0, 30), null);
});

test('rataVacancyHari: jeda keluar -> masuk berikutnya per kamar', () => {
  const h = [
    { kamar: '1', mulai: '2026-01-01', selesai: '2026-09-30' },
    { kamar: '1', mulai: '2026-10-10', selesai: null }, // jeda 10 hari
    { kamar: '2', mulai: '2026-01-01', selesai: '2026-10-01' },
    { kamar: '2', mulai: '2026-10-31', selesai: null } // jeda 30 hari
  ];
  assert.equal(rataVacancyHari(h, { from: new Date(2026, 9, 1), to: new Date(2026, 9, 31) }), 20);
  assert.equal(rataVacancyHari(h, { from: new Date(2026, 0, 1), to: new Date(2026, 0, 31) }), null);
});

test('rataResponsLeadsMenit: abaikan lead tanpa chat pertama atau urutan terbalik', () => {
  assert.equal(
    rataResponsLeadsMenit([
      { masuk: '2026-11-14 09:00', chat: '2026-11-14 09:10' },
      { masuk: '2026-11-14 10:00', chat: '2026-11-14 10:20' },
      { masuk: '2026-11-14 11:00', chat: null },
      { masuk: '2026-11-14 12:00', chat: '2026-11-14 11:00' }
    ]),
    15
  );
  assert.equal(rataResponsLeadsMenit([]), null);
});

test('CAC, CPL, pencapaian target, engagement', () => {
  assert.equal(cac(400000, 100000, 10), 50000);
  assert.equal(cac(1, 1, 0), null);
  assert.equal(cplRata([{ spend: 500000, leads: 20 }, { spend: 0, leads: 0 }]), 25000);
  assert.equal(pencapaianTargetLeads([{ leads: 8, target: 10 }, { leads: 5, target: 0 }]), 80);
  assert.equal(engagementRate([{ likes: 50, komentar: 10, share: 10, reach: 100 }, { likes: 9, komentar: 9, share: 9, reach: 0 }]), 70);
});

test('konsistensiPosting: Posted / (Posted + Terjadwal yang sudah lewat)', () => {
  const k = [
    { status: 'Posted', tanggal: '2026-11-01' },
    { status: 'Posted', tanggal: '2026-11-03' },
    { status: 'Terjadwal', tanggal: '2026-11-05' }, // lewat -> gagal tayang
    { status: 'Terjadwal', tanggal: '2026-11-20' }, // belum waktunya
    { status: 'Draft', tanggal: '2026-11-02' }
  ];
  assert.equal(konsistensiPosting(k, hariIni), 66.7);
});

test('slaPatuh memakai kolom sla OK/BREACH; tiketBerulang; hariPeriode', () => {
  assert.equal(slaPatuh([{ sla: 'OK' }, { sla: 'BREACH' }, { sla: '' }, { sla: undefined }]), 50);
  assert.equal(slaPatuh([]), null);
  assert.equal(
    tiketBerulang([
      { lokasi: 'AC K3', kategori: 'Elektrikal' },
      { lokasi: 'ac k3 ', kategori: 'elektrikal' },
      { lokasi: 'Keran', kategori: 'Sanitasi' }
    ]),
    1
  );
  assert.equal(hariPeriode({ from: new Date(2026, 10, 1), to: new Date(2026, 10, 30) }, hariIni), 14);
  assert.equal(hariPeriode({ from: new Date(2026, 9, 1), to: new Date(2026, 9, 31) }, hariIni), 31);
  assert.equal(hariPeriode({ from: null, to: null }, hariIni), 30);
});

test('kepatuhanPreventif dan kepatuhanInspeksi', () => {
  assert.equal(
    kepatuhanPreventif(
      [
        { jadwal: '2026-11-01', selesai: '2026-11-01' },
        { jadwal: '2026-11-05', selesai: null },
        { jadwal: '2026-11-30', selesai: null }
      ],
      hariIni
    ),
    50
  );
  const r = { from: new Date(2026, 10, 1), to: new Date(2026, 10, 30) };
  assert.equal(kepatuhanInspeksi(['2026-11-01', '2026-11-01 10:00', '2026-11-02', '2026-11-20'], r, hariIni), 14.3); // 2 dari 14 hari
});

test('rataKamarSiapHari, kelengkapanDokumen, respons pengaduan, csat', () => {
  assert.equal(rataKamarSiapHari([{ checkout: '2026-11-01', siap: '2026-11-02 10:00' }, { checkout: '2026-11-05', siap: null }]), 1);
  assert.equal(
    kelengkapanDokumen(['A', 'B'], [{ idPenghuni: 'A', jenis: 'KTP' }, { idPenghuni: 'A', jenis: 'Surat Kontrak' }, { idPenghuni: 'B', jenis: 'KTP' }], ['KTP', 'Surat Kontrak']),
    50
  );
  assert.equal(kelengkapanDokumen(['A'], [], []), null);
  assert.equal(rataResponsPengaduanJam([{ masuk: '2026-11-14 09:00', respons: '2026-11-14 10:30' }, { masuk: '2026-11-14 09:00', respons: null }]), 1.5);
  assert.equal(rataSkorCsat([5, 4, 4]), 4.3);
  assert.equal(rataSkorCsat([]), null);
});

test('tgl: tolak string non-tanggal', () => {
  assert.equal(tgl(''), null);
  assert.equal(tgl('abc'), null);
  assert.ok(tgl('2026-11-14 09:00'));
});
