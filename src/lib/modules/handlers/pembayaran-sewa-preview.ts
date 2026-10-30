import { normalizePhone, normalizeRoomId, parseDateISO, parseRupiah, required } from '../../core/validate';
import { turso } from '../../core/turso';
import { getTenantByLabel, getInvoiceSewaMaster, getListrikByKamar } from '../../master';
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

/**
 * No. invoice = INV/{kamar}/{TDU|DPU}/{bulan}/{tahun}, bulan & tahun dari tanggal PERIODE
 * (awal sewa untuk Sewa, tanggal masuk untuk DP), bukan tanggal bayar. Kalau nomor yang sama
 * sudah ada (kamar & bulan periode sama), ditambah suffix urut: ...-2, ...-3.
 */
async function noInvUnik(kode: 'TDU' | 'DPU', noKamar: string, tanggalPeriode: string): Promise<string> {
  const base = `INV/${noKamar}/${kode}/${Number(tanggalPeriode.slice(5, 7))}/${tanggalPeriode.slice(0, 4)}`;
  const tabel = kode === 'TDU' ? 'invoice_sewa' : 'invoice_dp';
  const res = await turso().execute({
    sql: `SELECT no_inv FROM ${tabel} WHERE no_inv = ? OR no_inv LIKE ?`,
    args: [base, `${base}-%`]
  });
  if (res.rows.length === 0) return base;
  const urut = res.rows.map((r) => Number(String(r.no_inv).slice(base.length + 1)) || 1);
  return `${base}-${Math.max(1, ...urut) + 1}`;
}

/** DP: calon penghuni belum ada di active_tenant, jadi data diri diisi manual. */
async function previewDpManual(values: Record<string, unknown>, tanggalBayar: string, pajak: number, diskon: number) {
  const nama = required(values.namaDp, 'Nama').trim();
  const noHp = normalizePhone(required(values.noHpDp, 'Nomor WhatsApp'));
  const email = required(values.emailDp, 'Email').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error(`Email tidak valid: "${email}".`);
  const noKamar = normalizeRoomId(required(values.kamarDp, 'Nomor Kamar'));
  const tglMasuk = parseDateISO(String(values.tglMasukDp ?? ''));

  const k = await turso().execute({ sql: 'SELECT tipe_kamar, harga_bulan FROM kamar WHERE no_kamar = ?', args: [noKamar] });
  if (k.rows.length === 0) throw new Error(`Kamar ${noKamar} tidak ditemukan.`);
  const tipe = String(k.rows[0].tipe_kamar ?? '');
  const hargaKamar = Number(k.rows[0].harga_bulan ?? 0);
  if (!hargaKamar) throw new Error(`Harga kamar ${noKamar} kosong di tabel kamar.`);

  const dp = Math.round(hargaKamar / 2);
  const subtotal = dp;
  const grandTotal = subtotal - diskon + pajak;
  if (diskon > subtotal) throw new Error('Diskon tidak boleh melebihi subtotal.');
  if (grandTotal <= 0) throw new Error('Grand total tidak valid (harus lebih dari 0).');
  const noInv = await noInvUnik('DPU', noKamar, tglMasuk);

  return {
    raw: {
      jenisPembayaran: 'DP', manual: true, nama, noHp, email, noKamar, tipe, tglMasuk,
      tglPembayaran: tanggalBayar, hargaKamar, dp, subtotal, pajak, diskon, grandTotal, noInv
    },
    fields: [
      { label: 'No. Invoice', value: noInv },
      { label: 'Nama', value: nama },
      { label: 'No. WhatsApp', value: noHp },
      { label: 'Email tujuan', value: email },
      { label: 'No. Kamar', value: noKamar },
      { label: 'Tipe Kamar', value: tipe },
      { label: 'Tanggal Masuk', value: fmtTanggalId(tglMasuk) },
      { label: 'Harga Kamar (penuh)', value: rp(hargaKamar) },
      { label: 'Harga/unit (DP 50%)', value: rp(dp) },
      { label: 'Pajak', value: rp(pajak) },
      { label: 'Diskon', value: rp(diskon) },
      { label: 'Grand Total', value: rp(grandTotal) }
    ]
  };
}

export const previewPembayaranSewa: PreviewHandler = async (values) => {
  const jenisPembayaran = required(values.jenisPembayaran, 'Jenis Pembayaran');
  if (jenisPembayaran !== 'DP' && jenisPembayaran !== 'Sewa') throw new Error('Jenis Pembayaran tidak valid.');
  const tanggalBayar = parseDateISO(String(values.tanggalBayar ?? ''));
  const pajak = values.pajak ? parseRupiah(values.pajak as string | number) : 0;
  const diskon = values.diskon ? parseRupiah(values.diskon as string | number) : 0;

  if (jenisPembayaran === 'DP') return previewDpManual(values, tanggalBayar, pajak, diskon);

  const penghuniLabel = required(values.penghuni, 'Nama Penghuni');
  const tenant = await getTenantByLabel(penghuniLabel);
  if (!tenant) throw new Error(`Penghuni "${penghuniLabel}" tidak ditemukan.`);
  const noKamar = tenant.kamar;

  {
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
    if (diskon > subtotal) throw new Error('Diskon tidak boleh melebihi subtotal.');
    if (grandTotal <= 0) throw new Error('Grand total tidak valid (harus lebih dari 0).');
    const noInv = await noInvUnik('TDU', noKamar, periodeAwalSewa);

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
};
