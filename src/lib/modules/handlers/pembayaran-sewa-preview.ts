import { parseDateISO, parseRupiah, required } from '../../validate';
import { getTenantByLabel, getInvoiceSewaMaster, getListrikByKamar, getInvoiceDpMaster } from '../../master';
import type { PreviewHandler } from '../types';

// Replika PERSIS logika buildInvoiceData_() di Apps Script Invoice Generator (Sewa & DP) — supaya angka
// yang ditampilkan di preview mini app SAMA dengan yang bakal ada di PDF/email sungguhan. Baca sumber
// data yg SAMA (spreadsheet INVOICE_SEWA/INVOICE_DP/DATABASE_PENGHUNI), BUKAN Room master Log Sales.

function addMonthsSewa(d: Date, n: number): Date {
  const r = new Date(d.getTime());
  const day = r.getDate();
  r.setMonth(r.getMonth() + n);
  if (r.getDate() < day) r.setDate(0); // jaga akhir bulan, sama seperti addMonths_ di Apps Script
  return r;
}

const BULAN_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli',
  'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

function fmtTanggalId(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getDate()} ${BULAN_ID[d.getMonth()]} ${d.getFullYear()}`;
}

function rp(n: number): string {
  const v = Math.round(n || 0);
  const s = Math.abs(v).toLocaleString('id-ID');
  return (v < 0 ? '-Rp' : 'Rp') + s;
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const previewPembayaranSewa: PreviewHandler = async (values) => {
  const jenisPembayaran = required(values.jenisPembayaran, 'Jenis Pembayaran');
  if (jenisPembayaran !== 'DP' && jenisPembayaran !== 'Sewa') throw new Error('Jenis Pembayaran tidak valid.');
  const penghuniLabel = required(values.penghuni, 'Nama Penghuni');
  const tanggalBayar = parseDateISO(String(values.tanggalBayar ?? ''));
  const pajak = values.pajak ? parseRupiah(values.pajak as string | number) : 0;
  const diskon = values.diskon ? parseRupiah(values.diskon as string | number) : 0;

  const tenant = await getTenantByLabel(penghuniLabel);
  if (!tenant) throw new Error(`Penghuni "${penghuniLabel}" tidak ditemukan.`);
  const noKamar = tenant.kamar;
  const tglBayarDate = new Date(`${tanggalBayar}T00:00:00`);

  if (jenisPembayaran === 'Sewa') {
    const lama = parseInt(String(values.jumlahBulan ?? ''), 10);
    if (!lama) throw new Error('Lama Sewa belum dipilih.');
    const periodeAwalSewa = parseDateISO(String(values.periodeAwalSewa ?? ''));
    const dendaPerUnit = values.biayaDendaPerUnit ? parseRupiah(values.biayaDendaPerUnit as string | number) : 0;
    const jumlahDenda = parseInt(String(values.jumlahDenda ?? '0'), 10) || 0;

    const { penghuni, harga } = await getInvoiceSewaMaster();
    const p = penghuni.find((x) => x.noKamar === noKamar);
    if (!p) {
      throw new Error(
        `Kamar ${noKamar} tidak ditemukan di master Invoice Generator Sewa. Pastikan sudah terdaftar di sheet Invoice Pembayaran Sewa → "Data".`
      );
    }
    const sewaPerBulan = harga[p.tipe]?.[lama] || 0;
    if (!sewaPerBulan) {
      throw new Error(`Harga untuk tipe "${p.tipe}" durasi ${lama} bulan tidak ditemukan di tabel harga Invoice Generator.`);
    }
    const listrikMap = await getListrikByKamar();
    const listrikPerBulan = listrikMap[noKamar] || 0;

    const periodeAwalDate = new Date(`${periodeAwalSewa}T00:00:00`);
    const periodeAkhirDate = addMonthsSewa(periodeAwalDate, lama);

    const totalSewa = sewaPerBulan * lama;
    const totalListrik = listrikPerBulan * lama;
    const totalDenda = dendaPerUnit * jumlahDenda;
    const subtotal = totalSewa + totalListrik + totalDenda;
    const grandTotal = subtotal - diskon + pajak;
    const noInv = `INV/${noKamar}/TDU/${tglBayarDate.getMonth() + 1}/${tglBayarDate.getFullYear()}`;

    const raw = {
      jenisPembayaran, nama: p.nama, email: p.email, noKamar, tipe: p.tipe, lamaSewa: lama,
      tglPembayaran: tanggalBayar, periodeAwal: periodeAwalSewa, periodeAkhir: toISO(periodeAkhirDate),
      sewaPerBulan, listrikPerBulan, totalSewa, totalListrik,
      dendaPerUnit, jumlahDenda, totalDenda, subtotal, pajak, diskon, grandTotal, noInv
    };

    return {
      raw,
      fields: [
        { label: 'No. Invoice', value: noInv },
        { label: 'Nama', value: p.nama },
        { label: 'No. Kamar', value: noKamar },
        { label: 'Tipe Kamar', value: p.tipe },
        { label: 'Email tujuan', value: p.email || '(kosong — cek data penghuni)' },
        { label: 'Harga/bulan', value: rp(sewaPerBulan) },
        { label: 'Tambahan Listrik/bulan', value: rp(listrikPerBulan) },
        { label: 'Periode', value: `${fmtTanggalId(periodeAwalSewa)} s.d ${fmtTanggalId(toISO(periodeAkhirDate))}` },
        { label: 'Total Sewa', value: rp(totalSewa) },
        { label: 'Total Listrik', value: rp(totalListrik) },
        { label: 'Total Denda', value: rp(totalDenda) },
        { label: 'Subtotal', value: rp(subtotal) },
        { label: 'Pajak', value: rp(pajak) },
        { label: 'Diskon', value: rp(diskon) },
        { label: 'Grand Total', value: rp(grandTotal) }
      ]
    };
  }

  // --- DP ---
  const list = await getInvoiceDpMaster();
  const p = list.find((x) => x.noKamar === noKamar);
  if (!p) {
    throw new Error(
      `Kamar ${noKamar} tidak ditemukan di master Invoice Generator DP. Pastikan sudah terdaftar di sheet Invoice Pembayaran DP → "Sheet1".`
    );
  }
  if (!p.hargaKamar) throw new Error(`Harga kamar untuk ${p.nama} kosong di sheet Invoice Pembayaran DP.`);

  const dp = Math.round(p.hargaKamar / 2);
  const subtotal = dp;
  const grandTotal = subtotal - diskon + pajak;
  const noInv = `INV/${noKamar}/DPU/${tglBayarDate.getMonth() + 1}/${tglBayarDate.getFullYear()}`;

  const raw = {
    jenisPembayaran, nama: p.nama, email: p.email, noKamar, tipe: p.tipe,
    tglPembayaran: tanggalBayar, hargaKamar: p.hargaKamar, dp, subtotal, pajak, diskon, grandTotal, noInv
  };

  return {
    raw,
    fields: [
      { label: 'No. Invoice', value: noInv },
      { label: 'Nama', value: p.nama },
      { label: 'No. Kamar', value: noKamar },
      { label: 'Tipe Kamar', value: p.tipe },
      { label: 'Email tujuan', value: p.email || '(kosong — cek data penghuni)' },
      { label: 'Harga Kamar (penuh)', value: rp(p.hargaKamar) },
      { label: 'Harga/unit (DP 50%)', value: rp(dp) },
      { label: 'Pajak', value: rp(pajak) },
      { label: 'Diskon', value: rp(diskon) },
      { label: 'Grand Total', value: rp(grandTotal) }
    ]
  };
};
